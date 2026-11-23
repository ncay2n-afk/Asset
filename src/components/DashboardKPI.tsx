import React from 'react';
import {
  Boxes,
  ArrowRightLeft,
  AlertTriangle,
  Wrench,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Link2,
  UploadCloud,
  Download,
  Loader2
} from 'lucide-react';
import { OfficeAsset, AssetTransaction } from '../types';

interface DashboardKPIProps {
  assets: OfficeAsset[];
  transactions: AssetTransaction[];
  isBridgeConnected: boolean;
  hasUnsavedChanges?: boolean;
  unsavedChangesCount?: number;
  isSyncing?: boolean;
  spreadsheetUrl: string | null;
  onUpdateDatabase?: () => void;
  onPullFromSheet?: () => void;
  onOpenWorkspace: () => void;
  onFilterStatus?: (status: string | null) => void;
  selectedStatusFilter: string | null;
  isMobileLayout?: boolean;
  canMutateAssets?: boolean;
  syncPhase?: string;
  lastSyncDurationMs?: number | null;
  syncError?: string | null;
  onQuickPull?: () => void;
}

export const DashboardKPI: React.FC<DashboardKPIProps> = ({
  assets,
  transactions: _transactions,
  isBridgeConnected,
  hasUnsavedChanges = false,
  unsavedChangesCount = 0,
  isSyncing = false,
  spreadsheetUrl,
  onUpdateDatabase,
  onPullFromSheet,
  onOpenWorkspace,
  onFilterStatus,
  selectedStatusFilter,
  isMobileLayout = false,
  canMutateAssets = true,
  syncPhase,
  lastSyncDurationMs = null,
  syncError = null,
  onQuickPull,
}) => {
  const totalAssetsCount = assets.length;
  const totalUnits = assets.reduce((acc, curr) => acc + (curr.totalStock || 0), 0);
  const totalAvailable = assets.reduce((acc, curr) => acc + (curr.availableStock || 0), 0);
  const totalBorrowed = assets.reduce((acc, curr) => acc + (curr.borrowedStock || 0), 0);
  const totalDamaged = assets.reduce(
    (acc, curr) =>
      acc +
      (curr.damagedStock || 0) +
      (curr.condition === 'Perlu Perbaikan' || curr.condition === 'Rusak Berat' ? 1 : 0),
    0
  );

  const totalValuation = assets.reduce(
    (acc, curr) => acc + (curr.purchasePrice || 0) * (curr.totalStock || 1),
    0
  );

  const criticalStockItems = assets.filter(
    (a) => a.availableStock <= 1 && a.totalStock > 0
  );

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className={isMobileLayout ? 'space-y-3' : 'space-y-4'}>
      {/* Spreadsheet Database Banner */}
      <div
        className={`border rounded-2xl text-white ${
          hasUnsavedChanges
            ? 'bg-slate-900 border-amber-500/60'
            : 'bg-slate-900 border-slate-800'
        } ${isMobileLayout ? 'p-3.5' : 'p-4'}`}
      >
        <div
          className={`flex justify-between gap-3 ${
            isMobileLayout ? 'flex-col' : 'flex-col sm:flex-row sm:items-center'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2 rounded-xl bg-slate-800 border border-slate-700 shrink-0 ${
                hasUnsavedChanges ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  Database Google Spreadsheet &amp; Drive
                </h2>
                <span aria-hidden="true" className="text-slate-600 text-xs">
                  ·
                </span>
                {isSyncing ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{syncPhase || 'Menyinkronkan data dari Spreadsheet...'}</span>
                  </span>
                ) : syncError ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Gagal memuat otomatis</span>
                    {onQuickPull && (
                      <button
                        type="button"
                        onClick={onQuickPull}
                        className="underline text-amber-300 hover:text-amber-200 cursor-pointer ml-1"
                      >
                        Muat Ulang
                      </button>
                    )}
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      Ada {unsavedChangesCount} perubahan belum disimpan ke Spreadsheet
                    </span>
                  </span>
                ) : isBridgeConnected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Bridge Online Aktif
                      {lastSyncDurationMs
                        ? ` · ${(lastSyncDurationMs / 1000).toFixed(1)} dtk`
                        : ' (Semua Device Sinkron)'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Belum Terhubung Bridge (Atur untuk Sync Semua Device)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                {isMobileLayout
                  ? 'Database 11 tab Spreadsheet & foto Google Drive tanpa login Google.'
                  : 'Seluruh inventaris, mutasi, servis, stock opname, BAPA, master data, & akun tersimpan di Google Spreadsheet serta semua foto di Google Drive tanpa perlu login Google.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasUnsavedChanges && canMutateAssets && onUpdateDatabase && (
              <button
                type="button"
                onClick={onUpdateDatabase}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] shadow-sm"
              >
                {isSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>Update Database ({unsavedChangesCount})</span>
              </button>
            )}

            {isBridgeConnected && onPullFromSheet && (
              <button
                type="button"
                onClick={onPullFromSheet}
                disabled={isSyncing}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl transition whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Tarik Sheet</span>
              </button>
            )}

            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl transition whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Buka Sheet</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            <button
              type="button"
              onClick={onOpenWorkspace}
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] flex-1 sm:flex-initial"
            >
              <span>{isBridgeConnected ? 'Kelola Bridge' : 'Hubungkan Bridge'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {isSyncing && assets.length === 0 ? (
        <div
          className={
            isMobileLayout
              ? 'grid grid-cols-2 gap-2.5'
              : 'grid grid-cols-2 lg:grid-cols-5 gap-3.5'
          }
        >
          {[0, 1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className={`${
                idx === 0
                  ? isMobileLayout
                    ? 'col-span-2 p-3.5'
                    : 'col-span-2 lg:col-span-1 p-4'
                  : isMobileLayout
                  ? 'p-3.5'
                  : 'p-4'
              } bg-white rounded-2xl border border-slate-200 animate-pulse space-y-2.5`}
            >
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-28 bg-slate-200 rounded" />
              <div className="h-2.5 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
      <div
        className={
          isMobileLayout
            ? 'grid grid-cols-2 gap-2.5'
            : 'grid grid-cols-2 lg:grid-cols-5 gap-3.5'
        }
      >
        {/* Total Nilai Aset */}
        <div
          className={`${
            isMobileLayout ? 'col-span-2 p-3.5' : 'col-span-2 lg:col-span-1 p-4'
          } bg-white rounded-2xl border border-slate-200 flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Nilai Aset</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight tabular-nums">
              {formatIDR(totalValuation)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600 inline shrink-0" />
              <span>Kapitalisasi inventaris aktif</span>
            </p>
          </div>
        </div>

        {/* Total Unit & Item */}
        <button
          type="button"
          onClick={() => onFilterStatus && onFilterStatus(null)}
          className={`text-left bg-white ${
            isMobileLayout ? 'p-3.5' : 'p-4'
          } rounded-2xl border flex flex-col justify-between transition cursor-pointer min-h-[88px] ${
            selectedStatusFilter === null
              ? 'border-blue-600 ring-2 ring-blue-600/15'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 w-full">
            <span className="text-xs font-semibold">Total Barang</span>
            <Boxes className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
              {totalUnits}{' '}
              <span className="text-xs font-normal text-slate-500">
                unit · {totalAssetsCount} item
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              Tersedia: <span className="font-semibold text-emerald-700">{totalAvailable} unit</span>
            </p>
          </div>
        </button>

        {/* Sedang Dipinjam */}
        <button
          type="button"
          onClick={() => onFilterStatus && onFilterStatus('Sedang Dipinjam')}
          className={`text-left bg-white ${
            isMobileLayout ? 'p-3.5' : 'p-4'
          } rounded-2xl border flex flex-col justify-between transition cursor-pointer min-h-[88px] ${
            selectedStatusFilter === 'Sedang Dipinjam'
              ? 'border-indigo-600 ring-2 ring-indigo-600/15'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 w-full">
            <span className="text-xs font-semibold">Dipinjam</span>
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-indigo-700 tabular-nums">
              {totalBorrowed}{' '}
              <span className="text-xs font-normal text-slate-500">unit</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Dipakai staf kantor</p>
          </div>
        </button>

        {/* Butuh Perbaikan / Rusak */}
        <button
          type="button"
          onClick={() => onFilterStatus && onFilterStatus('Dalam Perbaikan')}
          className={`text-left bg-white ${
            isMobileLayout ? 'p-3.5' : 'p-4'
          } rounded-2xl border flex flex-col justify-between transition cursor-pointer min-h-[88px] ${
            selectedStatusFilter === 'Dalam Perbaikan'
              ? 'border-amber-600 ring-2 ring-amber-600/15'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 w-full">
            <span className="text-xs font-semibold">Butuh Servis</span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-amber-700 tabular-nums">
              {totalDamaged}{' '}
              <span className="text-xs font-normal text-slate-500">unit</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Perlu perawatan</p>
          </div>
        </button>

        {/* Stok Kritis */}
        <button
          type="button"
          onClick={() => onFilterStatus && onFilterStatus('Stok Kritis')}
          className={`text-left bg-white ${
            isMobileLayout ? 'p-3.5' : 'p-4'
          } rounded-2xl border flex flex-col justify-between transition cursor-pointer min-h-[88px] ${
            selectedStatusFilter === 'Stok Kritis'
              ? 'border-rose-600 ring-2 ring-rose-600/15'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 w-full">
            <span className="text-xs font-semibold">Stok Kritis</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-rose-700 tabular-nums">
              {criticalStockItems.length}{' '}
              <span className="text-xs font-normal text-slate-500">item</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Sisa &le; 1 unit</p>
          </div>
        </button>
      </div>
      )}
    </div>
  );
};
