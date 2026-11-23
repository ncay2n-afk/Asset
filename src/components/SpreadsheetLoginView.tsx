import React, { useState, useEffect } from 'react';
import {
  Boxes,
  FileSpreadsheet,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  HelpCircle,
  Loader2,
  UserPlus,
  QrCode,
  Link2,
  Share2,
  Check,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { AppUserAccount, MasterCompanySettings, WorkspaceConfig } from '../types';
import { generateSaltHex, hashPassword, verifyPassword } from '../services/passwordCrypto';
import {
  buildMultiDeviceShareUrl,
  isValidBridgeUrl
} from '../services/cloudBridgeService';
import { handleDriveImageError, normalizeDriveImageUrl } from '../services/driveService';

interface SpreadsheetLoginViewProps {
  users: AppUserAccount[];
  companySettings: MasterCompanySettings;
  logoFallbackUrl?: string;
  workspaceConfig: WorkspaceConfig;
  isSyncingUsers: boolean;
  onRefreshUsersFromSheet: () => Promise<void>;
  onConnectBridge: (bridgeUrl: string, bridgeKey?: string, sheetId?: string) => Promise<void>;
  onLoginSuccess: (account: AppUserAccount) => void;
  onActivateInvitedUser: (account: AppUserAccount) => void;
  onFirstSuperAdminCreated: (account: AppUserAccount) => void;
  onOpenBridgeHelp: () => void;
  hasQrParam?: boolean;
  onOpenQrResult?: () => void;
  isPrefetchingDb?: boolean;
  prefetchReady?: boolean;
  lastSyncDurationMs?: number | null;
}

const ROLE_LABELS: Record<AppUserAccount['role'], string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin Aset',
  OPERATOR: 'Operator / Staf GA',
  AUDITOR: 'Auditor (Read-Only)',
};

export const SpreadsheetLoginView: React.FC<SpreadsheetLoginViewProps> = ({
  users,
  companySettings,
  logoFallbackUrl,
  workspaceConfig,
  isSyncingUsers,
  onRefreshUsersFromSheet,
  onConnectBridge,
  onLoginSuccess,
  onActivateInvitedUser,
  onFirstSuperAdminCreated,
  onOpenBridgeHelp,
  hasQrParam = false,
  onOpenQrResult,
  isPrefetchingDb = false,
  prefetchReady = false,
  lastSyncDurationMs = null,
}) => {
  // Login credentials state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // First-run Super Admin setup OR Invited user password claim state
  const [setupUsername, setSetupUsername] = useState('superadmin');
  const [setupFullName, setSetupFullName] = useState('Super Admin');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupDept, setSetupDept] = useState('IT & General Affairs');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');

  // Pending claim for a user row added directly in Google Sheets with empty passwordHash
  const [pendingClaimUser, setPendingClaimUser] = useState<AppUserAccount | null>(null);

  // Bottom "Options" collapsible menu (hidden until Options button is clicked)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showConnectionPanel, setShowConnectionPanel] = useState(
    !workspaceConfig.cloudBridgeUrl && !workspaceConfig.spreadsheetId
  );
  const [bridgeUrlInput, setBridgeUrlInput] = useState(workspaceConfig.cloudBridgeUrl || '');
  const [bridgeKeyInput, setBridgeKeyInput] = useState(workspaceConfig.cloudBridgeKey || '');
  const [sheetIdInput, setSheetIdInput] = useState(workspaceConfig.spreadsheetId || '');
  const [copiedShare, setCopiedShare] = useState(false);

  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [companySettings.logoUrl, logoFallbackUrl]);

  useEffect(() => {
    setBridgeUrlInput(workspaceConfig.cloudBridgeUrl || '');
    setBridgeKeyInput(workspaceConfig.cloudBridgeKey || '');
    setSheetIdInput(workspaceConfig.spreadsheetId || '');
  }, [workspaceConfig.cloudBridgeUrl, workspaceConfig.cloudBridgeKey, workspaceConfig.spreadsheetId]);

  const isBridgeConnected = isValidBridgeUrl(workspaceConfig.cloudBridgeUrl);
  const hasPublicSheetOnly = !isBridgeConnected && Boolean(workspaceConfig.spreadsheetId);
  const effectiveLogoSrc = normalizeDriveImageUrl(companySettings.logoUrl) || logoFallbackUrl || '';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const normalized = identifier.trim().toLowerCase();
    if (!normalized) {
      setErrorMsg('Masukkan username atau email terdaftar.');
      return;
    }

    const matched = users.find(
      (u) =>
        u.username.trim().toLowerCase() === normalized ||
        (u.email && u.email.trim().toLowerCase() === normalized)
    );

    if (!matched) {
      setErrorMsg(
        'Akun tidak ditemukan di daftar pengguna (tab Master_Pengguna). Periksa kembali atau buka Options di bawah lalu klik Refresh User.'
      );
      return;
    }

    if (!matched.isActive) {
      setErrorMsg('Akun ini sedang berstatus Nonaktif di tab Master_Pengguna Spreadsheet.');
      return;
    }

    // If admin added the row directly in Google Sheets without setting a password hash yet
    if (!matched.passwordHash || !matched.passwordSalt) {
      setPendingClaimUser(matched);
      setSetupPassword('');
      setSetupConfirm('');
      return;
    }

    if (!password) {
      setErrorMsg('Masukkan kata sandi akun Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await verifyPassword(password, matched.passwordSalt, matched.passwordHash);
      if (!ok) {
        setErrorMsg('Kata sandi salah. Periksa kembali password Anda.');
        return;
      }
      onLoginSuccess({
        ...matched,
        lastLoginAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan saat memverifikasi password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingClaimUser) return;
    setErrorMsg(null);

    if (setupPassword.length < 6) {
      setErrorMsg('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      const salt = generateSaltHex();
      const hash = await hashPassword(setupPassword, salt);
      const updated: AppUserAccount = {
        ...pendingClaimUser,
        passwordHash: hash,
        passwordSalt: salt,
        lastLoginAt: new Date().toISOString(),
      };
      setPendingClaimUser(null);
      onActivateInvitedUser(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengatur kata sandi awal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFirstSuperAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = setupUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Username minimal 3 karakter tanpa spasi.');
      return;
    }
    if (!setupFullName.trim()) {
      setErrorMsg('Nama lengkap wajib diisi.');
      return;
    }
    if (setupPassword.length < 6) {
      setErrorMsg('Kata sandi Super Admin minimal 6 karakter.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      const salt = generateSaltHex();
      const hash = await hashPassword(setupPassword, salt);
      const now = new Date().toISOString();
      const superAdmin: AppUserAccount = {
        id: 'USR-001',
        username: cleanUsername,
        fullName: setupFullName.trim(),
        email: setupEmail.trim(),
        role: 'SUPER_ADMIN',
        department: setupDept.trim() || 'IT & General Affairs',
        isActive: true,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
        lastLoginAt: now,
      };
      onFirstSuperAdminCreated(superAdmin);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membuat akun Super Admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    await onConnectBridge(
      bridgeUrlInput.trim(),
      bridgeKeyInput.trim(),
      sheetIdInput.trim()
    );
    setShowConnectionPanel(false);
  };

  const handleCopyShareUrl = async () => {
    const shareUrl = buildMultiDeviceShareUrl(
      workspaceConfig.cloudBridgeUrl,
      workspaceConfig.spreadsheetId,
      workspaceConfig.cloudBridgeKey
    );
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center">
            {effectiveLogoSrc && !logoLoadFailed ? (
              <img
                src={effectiveLogoSrc}
                alt={companySettings.companyName || 'Logo Perusahaan'}
                onError={(e) =>
                  handleDriveImageError(e, companySettings.logoUrl, logoFallbackUrl, () =>
                    setLogoLoadFailed(true)
                  )
                }
                className="w-16 h-16 rounded-2xl bg-white p-1.5 border border-slate-200 object-contain shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                <Boxes className="w-7 h-7 text-blue-400" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {companySettings.companyName || 'AsetKantor Enterprise'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Login dari Spreadsheet Aktif (<code>Master_Pengguna</code>) &bull; Tanpa Login Google
            </p>
            {(isSyncingUsers || isPrefetchingDb) ? (
              <p className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-700">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{isSyncingUsers ? 'Memuat daftar akun & branding...' : 'Menyiapkan cache database agar login instan...'}</span>
              </p>
            ) : prefetchReady ? (
              <p className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  Database siap instan
                  {lastSyncDurationMs ? ` (${(lastSyncDurationMs / 1000).toFixed(1)} dtk)` : ''}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        {/* QR Scan Banner if launched from QR URL */}
        {hasQrParam && onOpenQrResult && (
          <button
            type="button"
            onClick={onOpenQrResult}
            className="w-full p-3 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-2xl flex items-center justify-between text-left transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-cyan-700 shrink-0" />
              <div>
                <p className="text-xs font-bold text-cyan-950">Kode QR Aset Terdeteksi di URL</p>
                <p className="text-[11px] text-cyan-800">Ketuk untuk melihat detail label aset yang dipindai</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-cyan-700 px-2.5 py-1 bg-white rounded-lg border border-cyan-200">
              Lihat Detail
            </span>
          </button>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {(isSyncingUsers || isPrefetchingDb) && (
            <div className="h-1 w-full bg-slate-100 overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 animate-pulse rounded-full" />
            </div>
          )}
          <div className="p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Case A: Pending Password Activation for Invited Sheet Row */}
            {pendingClaimUser ? (
              <form onSubmit={handleClaimPasswordSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span>Aktivasi Akun Baru ({pendingClaimUser.username})</span>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Akun <strong>{pendingClaimUser.fullName}</strong> ({ROLE_LABELS[pendingClaimUser.role]}) terdaftar di Spreadsheet tetapi belum memiliki kata sandi. Buat kata sandi Anda untuk mengaktifkan akun ini.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kata Sandi Baru (min. 6 karakter)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ulangi Kata Sandi
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={setupConfirm}
                    onChange={(e) => setSetupConfirm(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingClaimUser(null)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Aktifkan &amp; Masuk</span>
                  </button>
                </div>
              </form>
            ) : users.length === 0 ? (
              /* Case B: First-Run Super Admin Registration */
              <form onSubmit={handleFirstSuperAdminSubmit} className="space-y-3.5">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-amber-700" />
                    <span>Setup Akun Super Admin Pertama</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Belum ada daftar pengguna di tab <code>Master_Pengguna</code>. Jika perusahaan sudah memiliki Spreadsheet aktif di perangkat lain, klik tombol <strong>Options</strong> di bawah lalu hubungkan Cloud Bridge &amp; muat user. Jika baru memulai, buat akun Super Admin pertama Anda di bawah ini.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={setupUsername}
                      onChange={(e) => setSetupUsername(e.target.value)}
                      placeholder="superadmin"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Divisi / Jabatan
                    </label>
                    <input
                      type="text"
                      value={setupDept}
                      onChange={(e) => setSetupDept(e.target.value)}
                      placeholder="IT & General Affairs"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={setupFullName}
                    onChange={(e) => setSetupFullName(e.target.value)}
                    placeholder="Nama Pengelola Utama"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email (Opsional — untuk notifikasi &amp; login alternatif)
                  </label>
                  <input
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="admin@perusahaan.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kata Sandi *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ulangi Sandi *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={setupConfirm}
                      onChange={(e) => setSetupConfirm(e.target.value)}
                      placeholder="Konfirmasi sandi"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Buat Akun Super Admin &amp; Masuk</span>
                </button>
              </form>
            ) : (
              /* Case C: Standard Spreadsheet User Login */
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username atau Email (dari Spreadsheet)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="contoh: superadmin atau nama@kantor.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password akun..."
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Tampilkan atau sembunyikan password"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Jika akun baru ditambahkan langsung di tab <code>Master_Pengguna</code> tanpa password, kosongkan sandi lalu klik Masuk untuk membuat password baru.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                  )}
                  <span>Masuk dengan Akun Spreadsheet</span>
                </button>
              </form>
            )}

            {/* Bottom Options Toggle Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOptionsMenu((v) => !v)}
                aria-expanded={showOptionsMenu}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between transition cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Options</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                      isBridgeConnected
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : hasPublicSheetOnly
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isBridgeConnected
                          ? 'bg-emerald-500'
                          : hasPublicSheetOnly
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    {users.length} Akun
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      showOptionsMenu ? 'rotate-180' : ''
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          {/* Collapsible Bridge & Spreadsheet Menu (Revealed below when Options is clicked) */}
          {showOptionsMenu && (
            <div className="bg-slate-900 text-white p-4 space-y-3 border-t border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet
                    className={`w-4 h-4 shrink-0 ${
                      isBridgeConnected
                        ? 'text-emerald-400'
                        : hasPublicSheetOnly
                        ? 'text-blue-400'
                        : 'text-amber-400'
                    }`}
                  />
                  <span className="text-xs font-semibold truncate">
                    {isBridgeConnected
                      ? `Bridge Online (${workspaceConfig.spreadsheetName || 'Spreadsheet Aktif'})`
                      : hasPublicSheetOnly
                      ? 'Mode Read-Only Publik Spreadsheet'
                      : 'Spreadsheet Online Belum Terhubung'}
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 shrink-0">
                  {users.length} Akun
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowConnectionPanel((v) => !v)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Link2 className="w-3 h-3 text-blue-400" />
                    <span>{isBridgeConnected ? 'Atur Bridge' : 'Hubungkan Spreadsheet'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenBridgeHelp}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Panduan &amp; Code.gs</span>
                  </button>
                  {isBridgeConnected && (
                    <button
                      type="button"
                      onClick={handleCopyShareUrl}
                      title="Salin link agar HP / device lain langsung terhubung"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedShare ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
                      <span>{copiedShare ? 'Link Tersalin' : 'Share Device'}</span>
                    </button>
                  )}
                </div>

                {(isBridgeConnected || workspaceConfig.spreadsheetId) && (
                  <button
                    type="button"
                    onClick={onRefreshUsersFromSheet}
                    disabled={isSyncingUsers}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingUsers ? 'animate-spin' : ''}`} />
                    <span>Refresh User</span>
                  </button>
                )}
              </div>

              {showConnectionPanel && (
                <form
                  onSubmit={handleConnectSubmit}
                  className="space-y-2 pt-2 border-t border-slate-800 text-[11px]"
                >
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      URL Web App Cloud Bridge (Apps Script <code>/exec</code>)
                    </label>
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={bridgeUrlInput}
                      onChange={(e) => setBridgeUrlInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono placeholder:text-slate-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder="Kunci Bridge (opsional)"
                      value={bridgeKeyInput}
                      onChange={(e) => setBridgeKeyInput(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono placeholder:text-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="ID/URL Sheet (opsional)"
                      value={sheetIdInput}
                      onChange={(e) => setSheetIdInput(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={onOpenBridgeHelp}
                      className="text-amber-300 hover:underline text-[11px] cursor-pointer"
                    >
                      Cara buat URL Bridge gratis (2 menit) &rarr;
                    </button>
                    <button
                      type="submit"
                      disabled={isSyncingUsers}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isSyncingUsers && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Hubungkan &amp; Muat User</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500">
          Daftar pengguna &amp; peran (Super Admin, Admin, Operator, Auditor) tersinkron langsung dengan tab{' '}
          <code>Master_Pengguna</code> Google Spreadsheet.
        </p>
      </div>
    </div>
  );
};
