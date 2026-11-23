import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Copy,
  Check,
  Code2,
  Share2,
  KeyRound,
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import {
  generateAppsScriptCode,
  buildMultiDeviceShareUrl,
  isValidBridgeUrl
} from '../services/cloudBridgeService';

interface SpreadsheetBridgeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridgeUrl: string;
  bridgeKey: string;
  spreadsheetId: string | null;
  onApplyBridgeConfig?: (bridgeUrl: string, bridgeKey: string) => void;
}

export const SpreadsheetBridgeHelpModal: React.FC<SpreadsheetBridgeHelpModalProps> = ({
  isOpen,
  onClose,
  bridgeUrl,
  bridgeKey,
  spreadsheetId,
  onApplyBridgeConfig,
}) => {
  const [keyInput, setKeyInput] = useState(bridgeKey || '');
  const [urlInput, setUrlInput] = useState(bridgeUrl || '');
  const [copiedField, setCopiedField] = useState<'code' | 'share' | null>(null);

  const generatedCode = useMemo(() => generateAppsScriptCode(keyInput), [keyInput]);
  const shareUrl = useMemo(
    () => buildMultiDeviceShareUrl(urlInput.trim() || bridgeUrl, spreadsheetId, keyInput.trim()),
    [urlInput, bridgeUrl, spreadsheetId, keyInput]
  );

  if (!isOpen) return null;

  const copyText = async (text: string, field: 'code' | 'share') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">
                Panduan Koneksi Spreadsheet Online Semua Device (Tanpa Login Google)
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Menggunakan Google Apps Script Cloud Bridge (<code>Code.gs</code>)
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
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed">
            Dengan <strong>Cloud Bridge Apps Script</strong>, HP, tablet, dan laptop seluruh staf cukup login memakai{' '}
            <strong>Username &amp; Kata Sandi dari tab Master_Pengguna</strong> — tanpa perlu login akun Google atau OAuth pop-up.
          </div>

          {/* 3-Step Setup */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              3 Langkah Menghubungkan Google Spreadsheet Aktif:
            </h4>

            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <p className="font-bold text-slate-900">
                1. Buka Google Spreadsheet Anda &rarr; Ekstensi &rarr; Apps Script
              </p>
              <p className="text-slate-600 leading-relaxed">
                Buka file Google Spreadsheet yang ingin dijadikan database utama, lalu klik menu{' '}
                <strong>Ekstensi (Extensions) &rarr; Apps Script</strong>.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-blue-600" />
                    <span>2. Salin &amp; Tempel Kode Cloud Bridge ke File Code.gs</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hapus kode bawaan di <code>Code.gs</code>, lalu tempel kode di bawah dan klik Simpan (Ctrl+S).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(generatedCode, 'code')}
                  className="shrink-0 min-h-[36px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'code' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kode Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Kode Code.gs</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 shrink-0">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>Kunci Akses Opsional:</span>
                </div>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="cth: rahasia-kantor-2026 (boleh dikosongkan)"
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono"
                />
              </div>

              <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 text-[10px] font-mono overflow-x-auto max-h-44 leading-relaxed">
                {generatedCode}
              </pre>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
              <p className="font-bold text-slate-900">
                3. Terapkan (Deploy) sebagai Aplikasi Web &amp; Salin URL (/exec)
              </p>
              <p className="text-slate-600 leading-relaxed">
                Di editor Apps Script klik <strong>Terapkan (Deploy) &rarr; Deployment baru &rarr; Aplikasi web</strong>.
                Atur <em>Jalankan sebagai</em> = <strong>Saya (Pemilik Sheet)</strong> dan <em>Yang memiliki akses</em> ={' '}
                <strong>Siapa saja (Anyone)</strong>. Izinkan akses saat diminta, lalu salin URL Web App yang berakhiran{' '}
                <code>/exec</code>.
              </p>
            </div>
          </div>

          {/* Apply & Multi-device Share Box */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/60 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span>Hubungkan Sekarang &amp; Bagikan ke Semua Device</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
              />
              {onApplyBridgeConfig && (
                <button
                  type="button"
                  disabled={!isValidBridgeUrl(urlInput)}
                  onClick={() => {
                    onApplyBridgeConfig(urlInput.trim(), keyInput.trim());
                    onClose();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pakai URL Bridge Ini</span>
                </button>
              )}
            </div>

            {isValidBridgeUrl(urlInput || bridgeUrl) && (
              <div className="bg-white border border-blue-200 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase text-blue-700 block">
                    Link Akses Online Semua Device (HP / Laptop Lain)
                  </span>
                  <code className="text-[10px] font-mono text-slate-700 break-all line-clamp-2">
                    {shareUrl}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(shareUrl, 'share')}
                  className="shrink-0 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'share' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>
              </div>
            )}
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
        </div>
      </div>
    </div>
  );
};
