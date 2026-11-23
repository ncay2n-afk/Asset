import { GoogleUserProfile } from '../types';

export const DEFAULT_GOOGLE_OAUTH_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined) ||
  '609727150180-vhnshdh0ugds3n7pnpgsihfihekq9m3t.apps.googleusercontent.com';

const CUSTOM_CLIENT_ID_STORAGE_KEY = 'aset_kantor_google_oauth_client_id';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
];

// Strictly in-memory session & token storage (never saved to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: GoogleUserProfile | null = null;
let authSuccessListener: ((user: GoogleUserProfile, token: string) => void) | null = null;
let authFailureListener: (() => void) | null = null;

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export class AuthSignInError extends Error {
  code: string;
  hostname: string;
  origin: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthSignInError';
    this.code = code;
    this.hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    this.origin = typeof window !== 'undefined' ? window.location.origin : '';
  }
}

export function getEffectiveGoogleClientId(): string {
  try {
    const custom = localStorage.getItem(CUSTOM_CLIENT_ID_STORAGE_KEY);
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch {}
  return DEFAULT_GOOGLE_OAUTH_CLIENT_ID;
}

export function setCustomGoogleClientId(clientId: string): void {
  try {
    if (clientId.trim()) {
      localStorage.setItem(CUSTOM_CLIENT_ID_STORAGE_KEY, clientId.trim());
    } else {
      localStorage.removeItem(CUSTOM_CLIENT_ID_STORAGE_KEY);
    }
  } catch {}
}

async function ensureGsiScriptLoaded(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://accounts.google.com/gsi/client"]'
    );

    const startTime = Date.now();
    const waitForReady = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      if (Date.now() - startTime > 12000) {
        reject(
          new AuthSignInError(
            'auth/gsi-load-timeout',
            'Gagal memuat Google Identity Services. Pastikan koneksi internet aktif dan tidak diblokir ad-blocker.'
          )
        );
        return;
      }
      setTimeout(waitForReady, 100);
    };

    if (existing) {
      waitForReady();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => waitForReady();
    script.onerror = () =>
      reject(
        new AuthSignInError(
          'auth/gsi-script-error',
          'Tidak dapat memuat skrip login Google (accounts.google.com/gsi/client).'
        )
      );
    document.head.appendChild(script);
  });
}

async function fetchGoogleDriveUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink,permissionId)',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new AuthSignInError(
      'auth/profile-fetch-failed',
      `Berhasil login Google tetapi gagal membaca profil akun (${res.status}): ${errText}`
    );
  }

  const data = await res.json();
  const u = data?.user || {};
  return {
    uid: u.permissionId || u.emailAddress || `google-${Date.now()}`,
    email: u.emailAddress || null,
    displayName: u.displayName || u.emailAddress || 'Pengguna Google',
    photoURL: u.photoLink || null,
  };
}

export const initAuth = (
  onAuthSuccess?: (user: GoogleUserProfile, token: string) => void,
  onAuthFailure?: () => void
) => {
  authSuccessListener = onAuthSuccess || null;
  authFailureListener = onAuthFailure || null;

  if (cachedUser && cachedAccessToken) {
    authSuccessListener?.(cachedUser, cachedAccessToken);
  } else {
    authFailureListener?.();
  }

  return () => {
    authSuccessListener = null;
    authFailureListener = null;
  };
};

export const googleSignIn = async (
  overrideClientId?: string
): Promise<{ user: GoogleUserProfile; accessToken: string }> => {
  await ensureGsiScriptLoaded();

  const clientId = (overrideClientId || getEffectiveGoogleClientId()).trim();
  if (!clientId) {
    throw new AuthSignInError(
      'auth/missing-client-id',
      'Google OAuth Client ID belum dikonfigurasi.'
    );
  }

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new AuthSignInError(
      'auth/gsi-unavailable',
      'Google Identity Services belum siap. Silakan muat ulang halaman lalu coba lagi.'
    );
  }

  const accessToken = await new Promise<string>((resolve, reject) => {
    try {
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        prompt: 'select_account',
        callback: (response) => {
          if (response.error) {
            if (response.error === 'access_denied') {
              reject(
                new AuthSignInError(
                  'auth/access-denied',
                  'Izin akses Google Sheets, Drive, dan Gmail ditolak. Pastikan Anda menyetujui semua izin yang diminta.'
                )
              );
              return;
            }
            reject(
              new AuthSignInError(
                `auth/${response.error}`,
                response.error_description || `Login Google OAuth gagal (${response.error}).`
              )
            );
            return;
          }

          if (!response.access_token) {
            reject(
              new AuthSignInError(
                'auth/missing-token',
                'Gagal mendapatkan token akses Google OAuth. Pastikan popup selesai dan izin Drive/Sheets disetujui.'
              )
            );
            return;
          }

          resolve(response.access_token);
        },
        error_callback: (err) => {
          const errType = err?.type || 'unknown';
          if (errType === 'popup_failed_to_open') {
            reject(
              new AuthSignInError(
                'auth/popup-blocked',
                'Popup login Google diblokir oleh browser. Izinkan popup untuk situs ini lalu klik Hubungkan Google lagi.'
              )
            );
            return;
          }
          if (errType === 'popup_closed') {
            reject(
              new AuthSignInError(
                'auth/popup-closed-by-user',
                'Jendela login Google ditutup sebelum selesai. Silakan coba masuk kembali.'
              )
            );
            return;
          }
          reject(
            new AuthSignInError(
              'auth/unauthorized-domain',
              err?.message ||
                `Origin "${typeof window !== 'undefined' ? window.location.origin : ''}" belum didaftarkan di Authorized JavaScript Origins Google Cloud OAuth Client.`
            )
          );
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (initErr: any) {
      reject(
        new AuthSignInError(
          'auth/init-failed',
          initErr?.message || 'Gagal membuka jendela otorisasi Google OAuth.'
        )
      );
    }
  });

  const userProfile = await fetchGoogleDriveUserProfile(accessToken);
  cachedAccessToken = accessToken;
  cachedUser = userProfile;
  authSuccessListener?.(userProfile, accessToken);

  return { user: userProfile, accessToken };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): GoogleUserProfile | null => {
  return cachedUser;
};

export const logout = async () => {
  const tk = cachedAccessToken;
  cachedAccessToken = null;
  cachedUser = null;
  if (tk && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(tk);
    } catch {}
  }
  authFailureListener?.();
};
