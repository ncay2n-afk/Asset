import React, { useState } from 'react';
import { X, ShieldAlert, Copy, Check, ExternalLink, Globe, KeyRound } from 'lucide-react';
import { getEffectiveGoogleClientId, setCustomGoogleClientId } from '../services/auth';

interface AuthDomainHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorCode: string;
  errorMessage: string;
  onRetrySignIn: () => void;
}

export const AuthDomainHelpModal: React.FC<AuthDomainHelpModalProps> = ({
  isOpen,
  onClose,
  errorCode,
  errorMessage,
  onRetrySignIn,
}) => {
  const [copiedField, setCopiedField] = useState<'origin' | 'clientId' | null>(null);
  const [customClientId, setCustomClientId] = useState(() => getEffectiveGoogleClientId());
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'USERNAME.github.io';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://USERNAME.github.io';
  const isGitHubPages = hostname.endsWith('github.io');
  const activeClientId = customClientId.trim() || getEffectiveGoogleClientId();

  const copyValue = async (val: string, field: 'origin' | 'clientId') => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handleSaveClientId = () => {
    setCustomGoogleClientId(customClientId.trim());
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">
                Solusi Koneksi Google Sheets &amp; Drive (OAuth Langsung)
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Kode Status: <span className="font-mono text-amber-300">{errorCode}</span> &bull; Mode Non-Firebase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-slate-400 hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-700">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-medium">
            {errorMessage}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Origin Aktif Saat Ini {isGitHubPages ? '(GitHub Pages Terdeteksi)' : ''}</span>
            </div>

            <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Authorized JavaScript Origin (Google Cloud Console)
                </span>
                <code className="font-mono font-bold text-slate-900 break-all">{origin}</code>
              </div>
              <button
                type="button"
                onClick={() => copyValue(origin, 'origin')}
                className="shrink-0 min-h-[34px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedField === 'origin' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'origin' ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Google OAuth Client ID Aktif (Opsional Ganti Milik Sendiri)
                </span>
                <button
                  type="button"
                  onClick={() => copyValue(activeClientId, 'clientId')}
                  className="text-[11px] font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'clientId' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'clientId' ? 'Tersalin' : 'Salin ID'}</span>
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveClientId}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                >
                  {savedNotice ? 'Tersimpan' : 'Pakai ID'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              2 Langkah Pengaturan Google Cloud OAuth (Tanpa Firebase):
            </h4>

            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <p className="font-bold text-slate-900">1. Daftarkan Origin di Google Cloud OAuth Client</p>
              <p className="text-slate-600 leading-relaxed">
                Buka Google Cloud Console &rarr; <strong>APIs &amp; Services</strong> &rarr; <strong>Credentials</strong> &rarr; pilih OAuth 2.0 Client ID Anda lalu tambahkan{' '}
                <code className="font-mono font-bold text-blue-700">{origin}</code> di bagian <strong>Authorized JavaScript origins</strong>.
              </p>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline pt-0.5"
              >
                <span>Buka Google Cloud Credentials</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <p className="font-bold text-slate-900">2. Pastikan API Sheets, Drive, Gmail &amp; Consent Screen Aktif</p>
              <p className="text-slate-600 leading-relaxed">
                Aktifkan <strong>Google Sheets API</strong>, <strong>Google Drive API</strong>, dan <strong>Gmail API</strong>. Pada menu <strong>OAuth consent screen</strong>, pastikan status sudah <strong>Published</strong> atau email pengguna ditambahkan di <strong>Test users</strong>.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
            <strong>Koneksi Langsung Google Identity:</strong> Aplikasi ini sudah menonaktifkan autentikasi Firebase dan menggunakan login Google OAuth langsung ke Google Spreadsheet &amp; Google Drive Anda.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onRetrySignIn();
            }}
            className="min-h-[40px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Hubungkan Google Lagi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
