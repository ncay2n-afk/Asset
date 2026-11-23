import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  HardDrive,
  Mail,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Send,
  Loader2,
  Download,
  HelpCircle,
  Database,
  Clock,
  UploadCloud,
  Share2,
  Copy,
  Check,
  Link2,
  Layers
} from 'lucide-react';
import { WorkspaceConfig, OfficeAsset } from '../types';
import { SpreadsheetConfirmAction } from './SpreadsheetConfirmModal';
import {
  buildMultiDeviceShareUrl,
  extractSpreadsheetId,
  isValidBridgeUrl,
  sendEmailViaBridge
} from '../services/cloudBridgeService';
import {
  TAB_ASSETS,
  TAB_TRANSACTIONS,
  TAB_MAINTENANCE,
  TAB_OPNAME,
  TAB_DISPOSAL,
  TAB_LOCATIONS,
  TAB_VENDORS,
  TAB_DIVISIONS,
  TAB_SUB_KELOMPOKS,
  TAB_SETTINGS,
  TAB_USERS
} from '../services/sheetsService';

interface GoogleWorkspaceSettingsProps {
  workspaceConfig: WorkspaceConfig;
  onUpdateConfig: (newConfig: Partial<WorkspaceConfig>) => void;
  assets: OfficeAsset[];
  hasUnsavedChanges?: boolean;
  unsavedChangesCount?: number;
  onUpdateDatabase: () => void;
  onPullFromSheet: () => void;
  onRequestSpreadsheetAction?: (action: SpreadsheetConfirmAction) => void;
  onTestBridgeConnection?: (
    bridgeUrl: string,
    bridgeKey?: string,
    spreadsheetId?: string | null
  ) => Promise<void>;
  onDisableAutoSync?: () => void;
  onOpenBridgeHelp?: () => void;
  isSyncing: boolean;
  currentUserEmail?: string | null;
}

const SYNCED_TABS_LABELS = [
  TAB_ASSETS,
  TAB_TRANSACTIONS,
  TAB_MAINTENANCE,
  TAB_OPNAME,
  TAB_DISPOSAL,
  TAB_LOCATIONS,
  TAB_VENDORS,
  TAB_DIVISIONS,
  TAB_SUB_KELOMPOKS,
  TAB_SETTINGS,
  TAB_USERS,
];

export const GoogleWorkspaceSettings: React.FC<GoogleWorkspaceSettingsProps> = ({
  workspaceConfig,
  onUpdateConfig,
  assets,
  hasUnsavedChanges = false,
  unsavedChangesCount = 0,
  onUpdateDatabase,
  onPullFromSheet,
  onRequestSpreadsheetAction,
  onTestBridgeConnection,
  onDisableAutoSync,
  onOpenBridgeHelp,
  isSyncing,
  currentUserEmail,
}) => {
  const [bridgeUrlInput, setBridgeUrlInput] = useState(workspaceConfig.cloudBridgeUrl || '');
  const [bridgeKeyInput, setBridgeKeyInput] = useState(workspaceConfig.cloudBridgeKey || '');
  const [customSheetId, setCustomSheetId] = useState(workspaceConfig.spreadsheetId || '');
  const [isTestingBridge, setIsTestingBridge] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    setBridgeUrlInput(workspaceConfig.cloudBridgeUrl || '');
    setBridgeKeyInput(workspaceConfig.cloudBridgeKey || '');
    setCustomSheetId(workspaceConfig.spreadsheetId || '');
  }, [
    workspaceConfig.cloudBridgeUrl,
    workspaceConfig.cloudBridgeKey,
    workspaceConfig.spreadsheetId,
  ]);

  const isBridgeConnected = isValidBridgeUrl(workspaceConfig.cloudBridgeUrl);
  const isAutoSyncActive = Boolean(
    isBridgeConnected && workspaceConfig.autoSyncSpreadsheet
  );

  const shareUrl = useMemo(
    () =>
      buildMultiDeviceShareUrl(
        bridgeUrlInput.trim() || workspaceConfig.cloudBridgeUrl,
        customSheetId.trim() || workspaceConfig.spreadsheetId,
        bridgeKeyInput.trim() || workspaceConfig.cloudBridgeKey
      ),
    [
      bridgeUrlInput,
      workspaceConfig.cloudBridgeUrl,
      customSheetId,
      workspaceConfig.spreadsheetId,
      bridgeKeyInput,
      workspaceConfig.cloudBridgeKey,
    ]
  );

  const handleSaveAndTestBridge = async () => {
    const cleanUrl = bridgeUrlInput.trim();
    const cleanKey = bridgeKeyInput.trim();
    const cleanSheet = extractSpreadsheetId(customSheetId);

    if (!isValidBridgeUrl(cleanUrl)) {
      setFeedbackMsg({
        type: 'error',
        text: 'Masukkan URL Web App Google Apps Script yang valid (https://script.google.com/macros/s/.../exec).',
      });
      return;
    }

    onUpdateConfig({
      cloudBridgeUrl: cleanUrl,
      cloudBridgeKey: cleanKey || undefined,
      ...(cleanSheet
        ? {
            spreadsheetId: cleanSheet,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanSheet}/edit`,
          }
        : {}),
    });

    if (onTestBridgeConnection) {
      setIsTestingBridge(true);
      setFeedbackMsg(null);
      try {
        await onTestBridgeConnection(cleanUrl, cleanKey, cleanSheet);
        setFeedbackMsg({
          type: 'success',
          text: 'Cloud Bridge terhubung ke Google Spreadsheet aktif! Anda kini bisa Update Database atau Muat Ulang di semua perangkat.',
        });
      } catch (err: any) {
        setFeedbackMsg({
          type: 'error',
          text: err?.message || 'Gagal menghubungi URL Web App Bridge.',
        });
      } finally {
        setIsTestingBridge(false);
      }
    }
  };

  const handleSaveCustomSheetId = () => {
    const cleanId = extractSpreadsheetId(customSheetId);
    if (!cleanId) return;

    onUpdateConfig({
      spreadsheetId: cleanId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
    });

    setFeedbackMsg({
      type: 'success',
      text: 'ID Google Spreadsheet berhasil ditautkan.',
    });
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  const handleSendTestEmail = async () => {
    if (!workspaceConfig.cloudBridgeUrl) {
      setTestEmailStatus('Hubungkan URL Cloud Bridge Apps Script terlebih dahulu.');
      return;
    }
    const targetEmail = workspaceConfig.notificationEmail || currentUserEmail;
    if (!targetEmail) {
      setTestEmailStatus('Alamat email tujuan belum diisi.');
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailStatus(null);

    try {
      await sendEmailViaBridge(
        workspaceConfig.cloudBridgeUrl,
        {
          to: targetEmail,
          subject: '[AsetKantor] Uji Coba Notifikasi Email Cloud Bridge',
          htmlBody: `
            <div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
              <h2 style="color: #0f172a; margin-top: 0;">Notifikasi Email AsetKantor Aktif!</h2>
              <p style="color: #334155; font-size: 14px;">
                Email ini dikirim melalui Google Apps Script Cloud Bridge (tanpa memerlukan login Google pengguna).
              </p>
              <p style="color: #64748b; font-size: 13px;">
                Setiap kali terjadi peminjaman barang, laporan kerusakan, atau peringatan stok kritis, pemberitahuan akan dikirim ke alamat ini.
              </p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
              <p style="font-size: 11px; color: #94a3b8;">Waktu Uji Coba: ${new Date().toLocaleString('id-ID')}</p>
            </div>
          `,
        },
        workspaceConfig.cloudBridgeKey
      );

      setTestEmailStatus(`Berhasil terkirim ke ${targetEmail}! Silakan periksa inbox Anda.`);
    } catch (err: any) {
      setTestEmailStatus(`Gagal mengirim: ${err.message || 'Pastikan deployment Apps Script memiliki izin MailApp.'}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Overview & Cloud Bridge Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Database Spreadsheet Online &amp; Google Drive (Tanpa Login Google)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Semua data 11 tab, akun login (<code>Master_Pengguna</code>), gambar Google Drive, dan email berjalan lewat Cloud Bridge Apps Script — bisa online di semua HP &amp; laptop.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isBridgeConnected ? (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Bridge Online Terhubung</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Bridge Belum Terhubung</span>
              </span>
            )}
            {onOpenBridgeHelp && (
              <button
                type="button"
                onClick={onOpenBridgeHelp}
                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Panduan &amp; Kode Code.gs</span>
              </button>
            )}
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Cloud Bridge Web App URL Inputs */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                URL Web App Cloud Bridge (Google Apps Script <code>/exec</code>)
              </label>
              <input
                type="url"
                value={bridgeUrlInput}
                onChange={(e) => setBridgeUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Kunci Akses Bridge (Opsional)
              </label>
              <input
                type="text"
                value={bridgeKeyInput}
                onChange={(e) => setBridgeKeyInput(e.target.value)}
                placeholder="Sesuai ACCESS_KEY di Code.gs"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSaveAndTestBridge}
              disabled={isTestingBridge || isSyncing}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isTestingBridge ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Tes &amp; Hubungkan Bridge</span>
            </button>

            {onOpenBridgeHelp && (
              <button
                type="button"
                onClick={onOpenBridgeHelp}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Belum punya URL Bridge? Salin Kode Code.gs &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Share Link for All Devices */}
        {isBridgeConnected && (
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Tautan Akses Online Semua Device (HP / Tablet / Laptop Lain)</span>
              </div>
              <p className="text-[11px] text-blue-800">
                Bagikan tautan ini ke staf agar perangkat mereka langsung terhubung ke Spreadsheet aktif tanpa mengetik URL Bridge lagi.
              </p>
              <code className="block text-[10px] font-mono text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200/80 truncate mt-1">
                {shareUrl}
              </code>
            </div>
            <button
              type="button"
              onClick={handleCopyShareUrl}
              className="shrink-0 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedShare ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedShare ? 'Link Tersalin!' : 'Salin Link Device'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. Google Sheets Full Database Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  1. Google Spreadsheet (Database Utama 11 Tab)
                </h4>
                {isAutoSyncActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <Database className="w-3 h-3" />
                    Auto-Sync Aktif
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200">
                    {unsavedChangesCount} Perubahan Belum Di-Update
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Seluruh aset, mutasi, pemeliharaan, stock opname, BAPA, lokasi, vendor, pengaturan, &amp; akun pengguna disimpan di 11 tab Spreadsheet.
              </p>
            </div>
          </div>

          {workspaceConfig.spreadsheetUrl && (
            <a
              href={workspaceConfig.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-200 transition shrink-0"
            >
              <span>Buka Spreadsheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* 11 Tabs Overview */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-700">11 Tab Database Tersinkronisasi:</span>
            {workspaceConfig.lastSyncedAt && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <Clock className="w-3 h-3" />
                Terakhir update: {new Date(workspaceConfig.lastSyncedAt).toLocaleString('id-ID')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SYNCED_TABS_LABELS.map((tabName) => (
              <span
                key={tabName}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-mono text-slate-700"
              >
                {tabName}
              </span>
            ))}
          </div>
        </div>

        {/* Spreadsheet Connection & Actions */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                ID atau URL Google Spreadsheet (Opsional jika Bridge terpasang langsung di Spreadsheet)
              </label>
              <input
                type="text"
                placeholder="Tempel URL atau ID Spreadsheet..."
                value={customSheetId}
                onChange={(e) => setCustomSheetId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveCustomSheetId}
              disabled={!customSheetId.trim()}
              className="px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition cursor-pointer"
            >
              Tautkan ID
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onUpdateDatabase}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 ${
                hasUnsavedChanges
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              <span>
                Update Database Sekarang ({assets.length} Aset
                {hasUnsavedChanges && unsavedChangesCount > 0 ? ` · ${unsavedChangesCount} perubahan` : ''})
              </span>
            </button>

            <button
              type="button"
              onClick={onPullFromSheet}
              disabled={isSyncing || !isBridgeConnected}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Muat Ulang dari Spreadsheet</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onRequestSpreadsheetAction
                  ? onRequestSpreadsheetAction('init_db')
                  : onUpdateDatabase()
              }
              disabled={isSyncing || !isBridgeConnected}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Inisialisasi 11 Tab</span>
            </button>
          </div>

          {/* Real-Time Auto-Sync Toggle */}
          <div className="pt-2 border-t border-slate-200/80">
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                workspaceConfig.autoSyncSpreadsheet
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-white border-slate-200'
              } ${!isBridgeConnected ? 'opacity-60' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={Boolean(workspaceConfig.autoSyncSpreadsheet)}
                disabled={!isBridgeConnected || isSyncing}
                onChange={(e) => {
                  if (e.target.checked) {
                    if (onRequestSpreadsheetAction) {
                      onRequestSpreadsheetAction('enable_auto_sync');
                    } else {
                      onUpdateConfig({ autoSyncSpreadsheet: true });
                    }
                  } else {
                    onDisableAutoSync?.();
                  }
                }}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <div className="font-bold text-slate-900">
                  Mode Database Real-Time (Auto-Sync Setiap Perubahan)
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Jika dimatikan, Anda bekerja offline/lokal cepat dan mengklik tombol <strong>Update Database</strong> kapan pun siap mengirim semua perubahan ke Spreadsheet. Jika diaktifkan, setiap perubahan otomatis dikirim ke Spreadsheet setelah jeda singkat.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Google Drive Photo Storage Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              2. Google Drive (Penyimpanan Semua Gambar &amp; Dokumen Visual)
            </h4>
            <p className="text-xs text-slate-500">
              Foto aset, foto kondisi mutasi, tanda tangan BAST, nota servis, dan logo perusahaan diunggah otomatis ke Google Drive melalui Cloud Bridge.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <span>Skema Penataan Folder Google Drive:</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 space-y-1">
            <p className="text-indigo-600 font-bold">📁 AsetKantor_Dokumentasi_Foto</p>
            <p className="pl-4 text-slate-700">├── 📁 _COMPANY_BRANDING / LOGO_INSTANSI.png</p>
            <p className="pl-4 text-slate-700">├── 📁 01_14_001_001_26 (Kode Aset)</p>
            <p className="pl-8 text-slate-600">├── 📁 2026-11-22 / INITIAL / KONDISI.jpg</p>
            <p className="pl-8 text-slate-600">├── 📁 BAST_Signatures / TTD_BAST_TRX.png</p>
            <p className="pl-8 text-slate-500">└── 📁 Maintenance_Invoices / NOTA_MTC.jpg</p>
          </div>
          <p className="text-[11px] text-slate-500">
            Seluruh tautan gambar Google Drive otomatis disimpan ke dalam sel Google Spreadsheet yang sesuai.
          </p>
        </div>
      </div>

      {/* 3. Email Notification Settings Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              3. Notifikasi Email Otomatis (via Bridge MailApp)
            </h4>
            <p className="text-xs text-slate-500">
              Kirim email alert otomatis untuk peminjaman, kerusakan barang, dan peringatan stok kritis melalui Apps Script.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Penerima Notifikasi Utama (Default PIC / Manajer)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="manajer.aset@kantor.com"
                value={workspaceConfig.notificationEmail || currentUserEmail || ''}
                onChange={(e) => onUpdateConfig({ notificationEmail: e.target.value })}
                className="w-full max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail || !isBridgeConnected}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {isSendingTestEmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Kirim Tes Email</span>
              </button>
            </div>
            {testEmailStatus && (
              <p className="text-xs text-blue-700 mt-1 font-medium">{testEmailStatus}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={workspaceConfig.autoSendEmailOnLoan}
                onChange={(e) => onUpdateConfig({ autoSendEmailOnLoan: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Peminjaman Aset Baru</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={workspaceConfig.autoSendEmailOnDamage}
                onChange={(e) => onUpdateConfig({ autoSendEmailOnDamage: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Kerusakan / Servis</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={workspaceConfig.autoSendEmailOnLowStock}
                onChange={(e) => onUpdateConfig({ autoSendEmailOnLowStock: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Peringatan Stok Kritis</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
