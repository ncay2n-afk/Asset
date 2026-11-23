/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  OfficeAsset,
  AssetTransaction,
  WorkspaceConfig,
  MaintenanceRecord,
  StockOpnameSession,
  DisposalRecord,
  AssetCondition,
  MasterBuildingLocation,
  MasterVendor,
  MasterCompanySettings,
  AppUserAccount
} from './types';
import { INITIAL_COMPANY_SETTINGS } from './data/mockInitialData';
import {
  KODE_DIVISI_LIST,
  KODE_SUB_KELOMPOK_LIST,
  CodeItem,
  dedupeCodeItems
} from './data/assetCodeGenerator';
import { Navbar, AppTab } from './components/Navbar';
import {
  MobileTopBar,
  MobileBottomBar,
  MobileMenuSheet
} from './components/MobileNavigation';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardKPI } from './components/DashboardKPI';
import { AssetList } from './components/AssetList';
import { TransactionModal } from './components/TransactionModal';
import { AddAssetModal } from './components/AddAssetModal';
import { EditAssetModal } from './components/EditAssetModal';
import { TransactionHistory } from './components/TransactionHistory';
import { ReportsView } from './components/ReportsView';
import { MaintenanceView } from './components/MaintenanceView';
import { StockOpnameView } from './components/StockOpnameView';
import { DisposalView } from './components/DisposalView';
import { MasterSettingsView } from './components/MasterSettingsView';
import { GoogleWorkspaceSettings } from './components/GoogleWorkspaceSettings';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { AssetLabelModal } from './components/AssetLabelModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { BastModal } from './components/BastModal';
import { DepreciationCalculatorModal } from './components/DepreciationCalculatorModal';
import { BatchLabelModal } from './components/BatchLabelModal';
import { BatchImportModal } from './components/BatchImportModal';
import { WarrantyAlertsBanner } from './components/WarrantyAlertsBanner';
import { SpreadsheetBridgeHelpModal } from './components/SpreadsheetBridgeHelpModal';
import { SpreadsheetLoginView } from './components/SpreadsheetLoginView';
import {
  SpreadsheetConfirmModal,
  SpreadsheetConfirmAction
} from './components/SpreadsheetConfirmModal';
import { FullSpreadsheetDatabase } from './services/sheetsService';
import {
  DEFAULT_CLOUD_BRIDGE_URL,
  DEFAULT_CLOUD_BRIDGE_KEY,
  extractSpreadsheetId,
  isValidBridgeUrl,
  fetchUsersViaBridge,
  pullFullDatabaseViaBridge,
  saveFullDatabaseViaBridge,
  initDatabaseViaBridge,
  fetchPublicSheetUsersFallback,
  uploadImageViaBridge,
  BridgeCompanyBranding
} from './services/cloudBridgeService';
import { dataUrlToBlob } from './services/driveService';
import {
  CheckCircle2,
  AlertCircle,
  Monitor,
  Smartphone,
  Laptop,
  ShieldAlert
} from 'lucide-react';

const LOCAL_STORAGE_ASSETS_KEY = 'aset_kantor_assets_v3';
const LOCAL_STORAGE_TRX_KEY = 'aset_kantor_trx_v3';
const LOCAL_STORAGE_MTC_KEY = 'aset_kantor_mtc_v3';
const LOCAL_STORAGE_SO_KEY = 'aset_kantor_so_v3';
const LOCAL_STORAGE_DSP_KEY = 'aset_kantor_dsp_v3';
const LOCAL_STORAGE_LOC_KEY = 'aset_kantor_loc_v3';
const LOCAL_STORAGE_VND_KEY = 'aset_kantor_vnd_v3';
const LOCAL_STORAGE_COMPANY_KEY = 'aset_kantor_company_v3';
const LOCAL_STORAGE_DIV_KEY = 'aset_kantor_div_v3';
const LOCAL_STORAGE_SUB_KEY = 'aset_kantor_sub_v3';
const LOCAL_STORAGE_USERS_KEY = 'aset_kantor_users_v3';
const LOCAL_STORAGE_CONFIG_KEY = 'aset_kantor_config_v3';
const LOCAL_STORAGE_VIEW_MODE_KEY = 'aset_kantor_view_mode';
const LOCAL_STORAGE_DIRTY_KEY = 'aset_kantor_dirty_count_v1';
const LOCAL_STORAGE_LOGO_FALLBACK_KEY = 'aset_kantor_logo_fallback_v1';
const LOCAL_STORAGE_TAB_HASHES_KEY = 'aset_kantor_tab_hashes_v1';

type ViewMode = 'auto' | 'web' | 'mobile';

function loadInitialWorkspaceConfig(): WorkspaceConfig {
  let savedConfig: Partial<WorkspaceConfig> = {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) savedConfig = JSON.parse(raw);
  } catch {}

  let urlBridge = '';
  let urlSheet = '';
  let urlKey = '';
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      urlBridge = params.get('bridge')?.trim() || '';
      urlSheet = extractSpreadsheetId(params.get('sheet')) || '';
      urlKey = params.get('key')?.trim() || '';
    }
  } catch {}

  const effectiveSheetId = urlSheet || savedConfig.spreadsheetId || null;

  return {
    spreadsheetId: effectiveSheetId,
    spreadsheetName: savedConfig.spreadsheetName || 'AsetKantor_Database_Inventaris',
    spreadsheetUrl:
      savedConfig.spreadsheetUrl ||
      (effectiveSheetId
        ? `https://docs.google.com/spreadsheets/d/${effectiveSheetId}/edit`
        : null),
    cloudBridgeUrl: urlBridge || savedConfig.cloudBridgeUrl || DEFAULT_CLOUD_BRIDGE_URL || '',
    cloudBridgeKey: urlKey || savedConfig.cloudBridgeKey || DEFAULT_CLOUD_BRIDGE_KEY || '',
    driveFolderId: savedConfig.driveFolderId || null,
    driveFolderName: savedConfig.driveFolderName || 'AsetKantor_Dokumentasi_Foto',
    notificationEmail: savedConfig.notificationEmail || '',
    autoSendEmailOnLoan: savedConfig.autoSendEmailOnLoan ?? true,
    autoSendEmailOnDamage: savedConfig.autoSendEmailOnDamage ?? true,
    autoSendEmailOnLowStock: savedConfig.autoSendEmailOnLowStock ?? true,
    lowStockThreshold: savedConfig.lowStockThreshold ?? 1,
    autoSyncSpreadsheet: savedConfig.autoSyncSpreadsheet ?? false,
    lastSyncedAt: savedConfig.lastSyncedAt,
  };
}

export default function App() {
  // Navigation Tabs: 'assets' | 'transactions' | 'opname' | 'maintenance' | 'disposal' | 'reports' | 'settings' | 'workspace'
  const [currentTab, setCurrentTab] = useState<AppTab>('assets');

  // Dual Experience Mode: Auto (responsive), Web Desktop, or Mobile App
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_VIEW_MODE_KEY);
      if (saved === 'web' || saved === 'mobile' || saved === 'auto') return saved;
    } catch {}
    return 'auto';
  });
  const [isViewportMobile, setIsViewportMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isForcedMobilePreview = !isViewportMobile && viewMode === 'mobile';
  const effectiveIsMobile = viewMode === 'mobile' || (viewMode === 'auto' && isViewportMobile);

  // Active Spreadsheet App User Session (in-memory only; zero Google OAuth)
  const [currentAppUser, setCurrentAppUser] = useState<AppUserAccount | null>(null);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);

  const [appUsers, setAppUsers] = useState<AppUserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 11-Tab Database Entities
  const [assets, setAssets] = useState<OfficeAsset[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ASSETS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [transactions, setTransactions] = useState<AssetTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TRX_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MTC_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stockOpnameSessions, setStockOpnameSessions] = useState<StockOpnameSession[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SO_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [disposalRecords, setDisposalRecords] = useState<DisposalRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DSP_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [locations, setLocations] = useState<MasterBuildingLocation[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LOC_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [vendors, setVendors] = useState<MasterVendor[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_VND_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [companySettings, setCompanySettings] = useState<MasterCompanySettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COMPANY_KEY);
      return saved ? JSON.parse(saved) : INITIAL_COMPANY_SETTINGS;
    } catch {
      return INITIAL_COMPANY_SETTINGS;
    }
  });

  const [logoFallbackDataUrl, setLogoFallbackDataUrl] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_LOGO_FALLBACK_KEY) || undefined;
    } catch {
      return undefined;
    }
  });

  const [customDivisions, setCustomDivisions] = useState<CodeItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DIV_KEY);
      return saved ? dedupeCodeItems(JSON.parse(saved)) : KODE_DIVISI_LIST;
    } catch {
      return KODE_DIVISI_LIST;
    }
  });

  const [customSubKelompoks, setCustomSubKelompoks] = useState<CodeItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SUB_KEY);
      return saved ? dedupeCodeItems(JSON.parse(saved)) : KODE_SUB_KELOMPOK_LIST;
    } catch {
      return KODE_SUB_KELOMPOK_LIST;
    }
  });

  // Spreadsheet & Cloud Bridge Configuration
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig>(
    loadInitialWorkspaceConfig
  );

  // Dirty Change Tracking ("Update Database" button visibility)
  const [unsavedChangesCount, setUnsavedChangesCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_DIRTY_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const hasUnsavedChanges = unsavedChangesCount > 0;
  const hasMountedDirtyRef = useRef(false);
  const skipNextDirtyMarkRef = useRef(false);

  // Sync state, Speed metrics, & Confirmation modal
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<string>('');
  const [lastSyncDurationMs, setLastSyncDurationMs] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPrefetchingDb, setIsPrefetchingDb] = useState(false);
  const [prefetchReady, setPrefetchReady] = useState(false);
  const inFlightPullRef = useRef<Promise<void> | null>(null);
  const lastSyncedTabHashesRef = useRef<Record<string, string> | null>((() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_TAB_HASHES_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })());
  const [pendingSheetAction, setPendingSheetAction] =
    useState<SpreadsheetConfirmAction | null>(null);
  const skipNextAutoSyncRef = useRef(false);
  const hasAutoSyncMountedRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // Filters
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);

  // Modals
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedAssetForTrx, setSelectedAssetForTrx] = useState<OfficeAsset | null>(null);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isBatchLabelModalOpen, setIsBatchLabelModalOpen] = useState(false);
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);

  const [photoViewer, setPhotoViewer] = useState<{
    isOpen: boolean;
    url: string | null;
    title: string;
  }>({
    isOpen: false,
    url: null,
    title: '',
  });

  // Modals: Label/QR, Scanner, Bridge Help, BAST, Depreciation, Edit Asset
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [selectedAssetForLabel, setSelectedAssetForLabel] = useState<OfficeAsset | null>(null);

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [initialScanQuery, setInitialScanQuery] = useState<string | null>(null);
  const [isBridgeHelpOpen, setIsBridgeHelpOpen] = useState(false);

  const [isBastModalOpen, setIsBastModalOpen] = useState(false);
  const [selectedTrxForBast, setSelectedTrxForBast] = useState<AssetTransaction | null>(null);

  const [isDepreciationModalOpen, setIsDepreciationModalOpen] = useState(false);
  const [selectedAssetForDepreciation, setSelectedAssetForDepreciation] =
    useState<OfficeAsset | null>(null);

  const [isEditAssetModalOpen, setIsEditAssetModalOpen] = useState(false);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<OfficeAsset | null>(null);

  const isBridgeConnected = isValidBridgeUrl(workspaceConfig.cloudBridgeUrl);

  // Persistence to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ASSETS_KEY, JSON.stringify(assets));
    } catch {}
  }, [assets]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_TRX_KEY, JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_MTC_KEY, JSON.stringify(maintenanceRecords));
    } catch {}
  }, [maintenanceRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SO_KEY, JSON.stringify(stockOpnameSessions));
    } catch {}
  }, [stockOpnameSessions]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_DSP_KEY, JSON.stringify(disposalRecords));
    } catch {}
  }, [disposalRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LOC_KEY, JSON.stringify(locations));
    } catch {}
  }, [locations]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_VND_KEY, JSON.stringify(vendors));
    } catch {}
  }, [vendors]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_COMPANY_KEY, JSON.stringify(companySettings));
    } catch {}
  }, [companySettings]);

  useEffect(() => {
    try {
      if (logoFallbackDataUrl) {
        localStorage.setItem(LOCAL_STORAGE_LOGO_FALLBACK_KEY, logoFallbackDataUrl);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_LOGO_FALLBACK_KEY);
      }
    } catch {}
  }, [logoFallbackDataUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_DIV_KEY, JSON.stringify(customDivisions));
    } catch {}
  }, [customDivisions]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SUB_KEY, JSON.stringify(customSubKelompoks));
    } catch {}
  }, [customSubKelompoks]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(appUsers));
    } catch {}
  }, [appUsers]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(workspaceConfig));
    } catch {}
  }, [workspaceConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_DIRTY_KEY, String(unsavedChangesCount));
    } catch {}
  }, [unsavedChangesCount]);

  // Dirty tracker for any edits to the 11 database entities
  useEffect(() => {
    if (!hasMountedDirtyRef.current) {
      hasMountedDirtyRef.current = true;
      return;
    }
    if (skipNextDirtyMarkRef.current) {
      skipNextDirtyMarkRef.current = false;
      return;
    }
    setUnsavedChangesCount((prev) => prev + 1);
  }, [
    assets,
    transactions,
    maintenanceRecords,
    stockOpnameSessions,
    disposalRecords,
    locations,
    vendors,
    customDivisions,
    customSubKelompoks,
    companySettings,
    appUsers,
  ]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Persist View Mode & Track Responsive Viewport
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_VIEW_MODE_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    const handleResize = () => {
      setIsViewportMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Build Full 11-Tab Database Payload
  const buildFullDatabasePayload = useCallback(
    (): FullSpreadsheetDatabase => ({
      assets,
      transactions,
      maintenanceRecords,
      stockOpnameSessions,
      disposalRecords,
      locations,
      vendors,
      customDivisions,
      customSubKelompoks,
      companySettings,
      workspaceSettings: {
        driveFolderId: workspaceConfig.driveFolderId,
        driveFolderName: workspaceConfig.driveFolderName,
        notificationEmail: workspaceConfig.notificationEmail,
        autoSendEmailOnLoan: workspaceConfig.autoSendEmailOnLoan,
        autoSendEmailOnDamage: workspaceConfig.autoSendEmailOnDamage,
        autoSendEmailOnLowStock: workspaceConfig.autoSendEmailOnLowStock,
        lowStockThreshold: workspaceConfig.lowStockThreshold,
      },
      users: appUsers,
    }),
    [
      assets,
      transactions,
      maintenanceRecords,
      stockOpnameSessions,
      disposalRecords,
      locations,
      vendors,
      customDivisions,
      customSubKelompoks,
      companySettings,
      workspaceConfig.driveFolderId,
      workspaceConfig.driveFolderName,
      workspaceConfig.notificationEmail,
      workspaceConfig.autoSendEmailOnLoan,
      workspaceConfig.autoSendEmailOnDamage,
      workspaceConfig.autoSendEmailOnLowStock,
      workspaceConfig.lowStockThreshold,
      appUsers,
    ]
  );

  const applyBridgeBranding = useCallback((branding?: BridgeCompanyBranding) => {
    if (!branding) return;
    if (branding.logoDataUrl) {
      setLogoFallbackDataUrl(branding.logoDataUrl);
    }
    if (branding.companyName || branding.brandSubtitle || branding.logoUrl) {
      skipNextAutoSyncRef.current = true;
      skipNextDirtyMarkRef.current = true;
      setCompanySettings((prev) => ({
        ...prev,
        ...(branding.companyName ? { companyName: branding.companyName } : {}),
        ...(branding.brandSubtitle ? { brandSubtitle: branding.brandSubtitle } : {}),
        ...(branding.logoUrl ? { logoUrl: branding.logoUrl } : {}),
      }));
    }
  }, []);

  // Fetch active users from Master_Pengguna (Cloud Bridge primary, public sheet gviz fallback)
  const handleRefreshUsersFromSheet = useCallback(
    async (
      overrideBridgeUrl?: string,
      overrideBridgeKey?: string,
      overrideSheetId?: string | null,
      silentIfUnconfigured: boolean = false
    ): Promise<AppUserAccount[]> => {
      const bUrl = (overrideBridgeUrl ?? workspaceConfig.cloudBridgeUrl ?? '').trim();
      const bKey = (overrideBridgeKey ?? workspaceConfig.cloudBridgeKey ?? '').trim();
      const sId = extractSpreadsheetId(overrideSheetId ?? workspaceConfig.spreadsheetId);

      if (!isValidBridgeUrl(bUrl) && !sId) {
        if (!silentIfUnconfigured) {
          setToastMessage({
            type: 'info',
            text: 'Masukkan URL Web App Cloud Bridge atau ID Spreadsheet terlebih dahulu.',
          });
        }
        return [];
      }

      setIsSyncingUsers(true);
      try {
        if (isValidBridgeUrl(bUrl)) {
          const res = await fetchUsersViaBridge(bUrl, bKey, sId);
          if (res.spreadsheetId) {
            setWorkspaceConfig((prev) => ({
              ...prev,
              spreadsheetId: res.spreadsheetId || prev.spreadsheetId,
              spreadsheetName: res.spreadsheetName || prev.spreadsheetName,
              spreadsheetUrl: res.spreadsheetUrl || prev.spreadsheetUrl,
            }));
          }
          if (res.companyBranding) {
            applyBridgeBranding(res.companyBranding);
          }
          if (res.users.length > 0) {
            skipNextAutoSyncRef.current = true;
            skipNextDirtyMarkRef.current = true;
            setAppUsers(res.users);
            setToastMessage({
              type: 'success',
              text: `Berhasil memuat ${res.users.length} akun pengguna aktif dari tab Master_Pengguna.`,
            });
          } else if (!silentIfUnconfigured) {
            setToastMessage({
              type: 'info',
              text: 'Bridge terhubung! Tab Master_Pengguna masih kosong — silakan buat akun Super Admin pertama.',
            });
          }
          return res.users;
        }

        // Public Sheet fallback (read-only)
        if (sId) {
          const publicUsers = await fetchPublicSheetUsersFallback(sId);
          if (publicUsers.length > 0) {
            skipNextAutoSyncRef.current = true;
            skipNextDirtyMarkRef.current = true;
            setAppUsers(publicUsers);
            setToastMessage({
              type: 'success',
              text: `Berhasil memuat ${publicUsers.length} akun pengguna dari Spreadsheet publik.`,
            });
          }
          return publicUsers;
        }

        return [];
      } catch (err: any) {
        if (!silentIfUnconfigured) {
          setToastMessage({
            type: 'error',
            text: err?.message || 'Gagal membaca daftar user dari Spreadsheet.',
          });
        }
        return [];
      } finally {
        setIsSyncingUsers(false);
      }
    },
    [
      workspaceConfig.cloudBridgeUrl,
      workspaceConfig.cloudBridgeKey,
      workspaceConfig.spreadsheetId,
      applyBridgeBranding,
    ]
  );

  // Pull full 11-tab DB quietly or interactively (dedupes concurrent in-flight pulls)
  const pullDatabaseInternal = useCallback(
    async (
      bridgeUrl: string,
      bridgeKey?: string,
      sheetId?: string | null,
      showSuccessToast: boolean = true,
      forceFresh: boolean = false
    ) => {
      if (inFlightPullRef.current && !forceFresh) {
        return inFlightPullRef.current;
      }

      const task = (async () => {
        setSyncError(null);
        setSyncPhase('Mengunduh data Spreadsheet...');
        try {
          const loaded = await pullFullDatabaseViaBridge(bridgeUrl, bridgeKey, sheetId, {
            forceFresh,
          });
          skipNextAutoSyncRef.current = true;
          skipNextDirtyMarkRef.current = true;

          if (loaded.assets) setAssets(loaded.assets);
          if (loaded.transactions) setTransactions(loaded.transactions);
          if (loaded.maintenanceRecords) setMaintenanceRecords(loaded.maintenanceRecords);
          if (loaded.stockOpnameSessions) setStockOpnameSessions(loaded.stockOpnameSessions);
          if (loaded.disposalRecords) setDisposalRecords(loaded.disposalRecords);
          if (loaded.locations) setLocations(loaded.locations);
          if (loaded.vendors) setVendors(loaded.vendors);
          if (loaded.customDivisions) setCustomDivisions(dedupeCodeItems(loaded.customDivisions));
          if (loaded.customSubKelompoks)
            setCustomSubKelompoks(dedupeCodeItems(loaded.customSubKelompoks));
          if (loaded.companyBranding?.logoDataUrl) {
            setLogoFallbackDataUrl(loaded.companyBranding.logoDataUrl);
          }
          if (loaded.companySettings) {
            setCompanySettings((prev) => ({
              ...prev,
              ...loaded.companySettings,
              logoUrl:
                loaded.companySettings?.logoUrl ||
                loaded.companyBranding?.logoUrl ||
                prev.logoUrl,
            }));
          }
          if (loaded.users && loaded.users.length > 0) {
            setAppUsers(loaded.users);
          }

          if (loaded.tabHashes) {
            lastSyncedTabHashesRef.current = loaded.tabHashes;
            try {
              localStorage.setItem(
                LOCAL_STORAGE_TAB_HASHES_KEY,
                JSON.stringify(loaded.tabHashes)
              );
            } catch {}
          }

          setLastSyncDurationMs(loaded.durationMs);
          setPrefetchReady(true);
          setUnsavedChangesCount(0);
          setWorkspaceConfig((prev) => ({
            ...prev,
            ...(loaded.workspaceSettings || {}),
            spreadsheetId: loaded.spreadsheetId || prev.spreadsheetId,
            spreadsheetName: loaded.spreadsheetName || prev.spreadsheetName,
            spreadsheetUrl: loaded.spreadsheetUrl || prev.spreadsheetUrl,
            lastSyncedAt: new Date().toISOString(),
          }));

          if (showSuccessToast) {
            const assetCount = loaded.assets?.length ?? 0;
            const trxCount = loaded.transactions?.length ?? 0;
            const sec = (loaded.durationMs / 1000).toFixed(1);
            const modeLabel = loaded.fromServerCache ? 'Cache Cepat' : 'Live Sheet';
            setToastMessage({
              type: 'success',
              text: `Data dimuat dalam ${sec} dtk (${modeLabel}) · ${assetCount} aset, ${trxCount} mutasi.`,
            });
          }
        } catch (err: any) {
          setSyncError(err?.message || 'Gagal memuat database.');
          throw err;
        } finally {
          inFlightPullRef.current = null;
          setSyncPhase('');
        }
      })();

      inFlightPullRef.current = task;
      return task;
    },
    []
  );

  // Boot Effect: Handle QR URL param (?asset=...), strip Share URL params (?bridge=...&sheet=...&key=...), fetch Master_Pengguna, & prefetch DB in background
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const assetParam = params.get('asset');
      if (assetParam) {
        setInitialScanQuery(window.location.search);
        setIsScanModalOpen(true);
      }

      const hasShareParams = params.has('bridge') || params.has('sheet') || params.has('key');
      if (hasShareParams) {
        params.delete('bridge');
        params.delete('sheet');
        params.delete('key');
        const nextSearch = params.toString();
        const nextUrl =
          window.location.pathname +
          (nextSearch ? `?${nextSearch}` : '') +
          window.location.hash;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {}

    const bootCloudSync = async () => {
      const bUrl = workspaceConfig.cloudBridgeUrl;
      const bKey = workspaceConfig.cloudBridgeKey;
      const sId = workspaceConfig.spreadsheetId;

      if (!isValidBridgeUrl(bUrl) && !sId) return;

      await handleRefreshUsersFromSheet(bUrl, bKey, sId, true);

      // Prefetch full DB quietly while user types login credentials so login feels instant
      if (isValidBridgeUrl(bUrl) && !hasUnsavedChanges) {
        setIsPrefetchingDb(true);
        try {
          await pullDatabaseInternal(bUrl!, bKey, sId, false, false);
        } catch {
          // Silent prefetch failure; user will retry smoothly upon login
        } finally {
          setIsPrefetchingDb(false);
        }
      }
    };

    void bootCloudSync();
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect & Test Cloud Bridge Handler (Single roundtrip via get_users instead of ping + get_users)
  const handleConnectBridge = useCallback(
    async (bridgeUrlInput: string, bridgeKeyInput?: string, sheetIdInput?: string | null) => {
      const cleanUrl = bridgeUrlInput.trim();
      const cleanKey = (bridgeKeyInput || '').trim();
      const cleanSheetId = extractSpreadsheetId(sheetIdInput);

      if (cleanUrl && !isValidBridgeUrl(cleanUrl)) {
        throw new Error(
          'URL Cloud Bridge harus diawali https://script.google.com/macros/s/...'
        );
      }

      setWorkspaceConfig((prev) => ({
        ...prev,
        cloudBridgeUrl: cleanUrl || prev.cloudBridgeUrl,
        cloudBridgeKey: cleanKey || undefined,
        ...(cleanSheetId
          ? {
              spreadsheetId: cleanSheetId,
              spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`,
            }
          : {}),
      }));

      if (cleanUrl) {
        await handleRefreshUsersFromSheet(
          cleanUrl,
          cleanKey,
          cleanSheetId || workspaceConfig.spreadsheetId,
          false
        );
      } else if (cleanSheetId) {
        await handleRefreshUsersFromSheet('', '', cleanSheetId, false);
      }
    },
    [workspaceConfig.spreadsheetId, handleRefreshUsersFromSheet]
  );

  // App User Session Handlers (Spreadsheet-backed Login; zero Google OAuth)
  const handleAppLoginSuccess = async (account: AppUserAccount) => {
    skipNextAutoSyncRef.current = true;
    skipNextDirtyMarkRef.current = true;
    setAppUsers((prev) =>
      prev.map((u) =>
        u.id === account.id ? { ...u, lastLoginAt: account.lastLoginAt } : u
      )
    );
    setCurrentAppUser(account);
    setToastMessage({
      type: 'success',
      text: `Selamat datang, ${account.fullName} (${account.role.replace('_', ' ')})!`,
    });

    // If background prefetch already finished cleanly, skip redundant fetch!
    if (prefetchReady && !inFlightPullRef.current) {
      return;
    }

    // Automatically pull live 11-tab DB on login (or await in-flight prefetch)
    if (isValidBridgeUrl(workspaceConfig.cloudBridgeUrl) && !hasUnsavedChanges) {
      try {
        setIsSyncing(true);
        setSyncPhase('Memuat database dari Spreadsheet...');
        await pullDatabaseInternal(
          workspaceConfig.cloudBridgeUrl!,
          workspaceConfig.cloudBridgeKey,
          workspaceConfig.spreadsheetId,
          false,
          false
        );
        // Keep fresh login timestamp in memory
        skipNextDirtyMarkRef.current = true;
        setAppUsers((prev) =>
          prev.map((u) =>
            u.id === account.id ? { ...u, lastLoginAt: account.lastLoginAt } : u
          )
        );
      } catch (err) {
        console.warn('Sinkronisasi otomatis saat login dilewati:', err);
      } finally {
        setIsSyncing(false);
        setSyncPhase('');
      }
    }
  };

  const handleActivateInvitedUser = (account: AppUserAccount) => {
    setAppUsers((prev) => prev.map((u) => (u.id === account.id ? account : u)));
    setCurrentAppUser(account);
    if (isBridgeConnected && !workspaceConfig.autoSyncSpreadsheet) {
      setPendingSheetAction('update_db');
    }
    setToastMessage({
      type: 'success',
      text: `Akun "${account.username}" berhasil diaktifkan!`,
    });
  };

  const handleFirstSuperAdminCreated = (account: AppUserAccount) => {
    setAppUsers([account]);
    setCurrentAppUser(account);
    if (isBridgeConnected && !workspaceConfig.autoSyncSpreadsheet) {
      setPendingSheetAction('init_db');
    }
    setToastMessage({
      type: 'success',
      text: `Akun Super Admin "${account.username}" berhasil dibuat!`,
    });
  };

  const handleAppLogout = () => {
    setCurrentAppUser(null);
    setCurrentTab('assets');
    setToastMessage({
      type: 'info',
      text: 'Anda telah keluar dari akun aplikasi.',
    });
  };

  // Execute Confirmed Spreadsheet Action (Init / Update DB / Pull / Enable Auto-Sync)
  const executeConfirmedSpreadsheetAction = useCallback(async () => {
    if (!pendingSheetAction) return;
    if (!isValidBridgeUrl(workspaceConfig.cloudBridgeUrl)) {
      setPendingSheetAction(null);
      setCurrentTab('workspace');
      setIsBridgeHelpOpen(true);
      setToastMessage({
        type: 'info',
        text: 'Hubungkan URL Web App Cloud Bridge terlebih dahulu untuk Update Database ke Spreadsheet.',
      });
      return;
    }

    const bridgeUrl = workspaceConfig.cloudBridgeUrl!;
    const bridgeKey = workspaceConfig.cloudBridgeKey;
    const sheetId = workspaceConfig.spreadsheetId;

    setIsSyncing(true);
    setSyncPhase(
      pendingSheetAction === 'pull_full_db'
        ? 'Mengambil data terbaru...'
        : pendingSheetAction === 'init_db'
        ? 'Menyiapkan 11 tab Spreadsheet...'
        : 'Menyimpan perubahan ke Spreadsheet...'
    );
    try {
      let dbPayload = buildFullDatabasePayload();

      // Auto-migrate inline data:image/ logo to Google Drive before saving to Spreadsheet so every device gets it cleanly
      if (
        pendingSheetAction !== 'pull_full_db' &&
        dbPayload.companySettings?.logoUrl?.startsWith('data:image/')
      ) {
        try {
          setSyncPhase('Mengunggah logo ke Google Drive...');
          const inlineLogo = dbPayload.companySettings.logoUrl;
          const logoBlob = dataUrlToBlob(inlineLogo);
          const ext = logoBlob.type.includes('png') ? 'png' : 'jpg';
          const uploadedLogo = await uploadImageViaBridge(
            bridgeUrl,
            logoBlob,
            `company-logo-${Date.now()}.${ext}`,
            ['_COMPANY_BRANDING'],
            'Logo Resmi Perusahaan / Instansi - AsetKantor',
            bridgeKey
          );
          if (uploadedLogo.imageUrl) {
            setLogoFallbackDataUrl(inlineLogo);
            dbPayload = {
              ...dbPayload,
              companySettings: {
                ...dbPayload.companySettings,
                logoUrl: uploadedLogo.imageUrl,
              },
            };
            skipNextAutoSyncRef.current = true;
            skipNextDirtyMarkRef.current = true;
            setCompanySettings((prev) => ({
              ...prev,
              logoUrl: uploadedLogo.imageUrl,
            }));
          }
        } catch (logoUploadErr) {
          console.warn('Upload otomatis logo ke Google Drive dilewati:', logoUploadErr);
        }
      }

      if (pendingSheetAction === 'init_db') {
        const initRes = await initDatabaseViaBridge(bridgeUrl, bridgeKey, sheetId);
        const saveRes = await saveFullDatabaseViaBridge(
          bridgeUrl,
          dbPayload,
          bridgeKey,
          initRes.spreadsheetId || sheetId,
          null
        );
        if (saveRes.savedTabHashes) {
          lastSyncedTabHashesRef.current = saveRes.savedTabHashes;
          try {
            localStorage.setItem(LOCAL_STORAGE_TAB_HASHES_KEY, JSON.stringify(saveRes.savedTabHashes));
          } catch {}
        }
        if (saveRes.durationMs) setLastSyncDurationMs(saveRes.durationMs);
        skipNextAutoSyncRef.current = true;
        skipNextDirtyMarkRef.current = true;
        setUnsavedChangesCount(0);
        setWorkspaceConfig((prev) => ({
          ...prev,
          spreadsheetId: saveRes.spreadsheetId || initRes.spreadsheetId || prev.spreadsheetId,
          spreadsheetName: saveRes.spreadsheetName || initRes.spreadsheetName || prev.spreadsheetName,
          spreadsheetUrl: saveRes.spreadsheetUrl || initRes.spreadsheetUrl || prev.spreadsheetUrl,
          lastSyncedAt: saveRes.updatedAt || new Date().toISOString(),
        }));
        setToastMessage({
          type: 'success',
          text: `11 Tab Database "${saveRes.spreadsheetName || 'Spreadsheet'}" siap & semua data berhasil disimpan!`,
        });
      } else if (pendingSheetAction === 'update_db') {
        setSyncPhase('Mengirim tab yang berubah...');
        const saveRes = await saveFullDatabaseViaBridge(
          bridgeUrl,
          dbPayload,
          bridgeKey,
          sheetId,
          lastSyncedTabHashesRef.current
        );
        if (saveRes.savedTabHashes) {
          lastSyncedTabHashesRef.current = saveRes.savedTabHashes;
          try {
            localStorage.setItem(LOCAL_STORAGE_TAB_HASHES_KEY, JSON.stringify(saveRes.savedTabHashes));
          } catch {}
        }
        if (saveRes.durationMs) setLastSyncDurationMs(saveRes.durationMs);
        skipNextAutoSyncRef.current = true;
        skipNextDirtyMarkRef.current = true;
        setUnsavedChangesCount(0);
        setWorkspaceConfig((prev) => ({
          ...prev,
          spreadsheetId: saveRes.spreadsheetId || prev.spreadsheetId,
          spreadsheetName: saveRes.spreadsheetName || prev.spreadsheetName,
          spreadsheetUrl: saveRes.spreadsheetUrl || prev.spreadsheetUrl,
          lastSyncedAt: saveRes.updatedAt || new Date().toISOString(),
        }));
        const sec = saveRes.durationMs ? ` (${(saveRes.durationMs / 1000).toFixed(1)} dtk)` : '';
        const tabNote = saveRes.syncedTabsCount && saveRes.syncedTabsCount < 11
          ? `${saveRes.syncedTabsCount} tab berubah`
          : '11 tab';
        setToastMessage({
          type: 'success',
          text: `Database Spreadsheet (${tabNote}) berhasil diperbarui${sec}!`,
        });
      } else if (pendingSheetAction === 'enable_auto_sync') {
        const saveRes = await saveFullDatabaseViaBridge(
          bridgeUrl,
          dbPayload,
          bridgeKey,
          sheetId,
          lastSyncedTabHashesRef.current
        );
        if (saveRes.savedTabHashes) {
          lastSyncedTabHashesRef.current = saveRes.savedTabHashes;
          try {
            localStorage.setItem(LOCAL_STORAGE_TAB_HASHES_KEY, JSON.stringify(saveRes.savedTabHashes));
          } catch {}
        }
        if (saveRes.durationMs) setLastSyncDurationMs(saveRes.durationMs);
        skipNextAutoSyncRef.current = true;
        skipNextDirtyMarkRef.current = true;
        setUnsavedChangesCount(0);
        setWorkspaceConfig((prev) => ({
          ...prev,
          spreadsheetId: saveRes.spreadsheetId || prev.spreadsheetId,
          spreadsheetName: saveRes.spreadsheetName || prev.spreadsheetName,
          spreadsheetUrl: saveRes.spreadsheetUrl || prev.spreadsheetUrl,
          autoSyncSpreadsheet: true,
          lastSyncedAt: saveRes.updatedAt || new Date().toISOString(),
        }));
        setToastMessage({
          type: 'success',
          text: 'Mode Auto-Sync Bridge aktif! Perubahan otomatis memperbarui Google Spreadsheet.',
        });
      } else if (pendingSheetAction === 'pull_full_db') {
        await pullDatabaseInternal(bridgeUrl, bridgeKey, sheetId, true, true);
      }
    } catch (err: any) {
      console.error(err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'Gagal memproses sinkronisasi Google Spreadsheet.',
      });
    } finally {
      setIsSyncing(false);
      setSyncPhase('');
      setPendingSheetAction(null);
    }
  }, [
    pendingSheetAction,
    workspaceConfig.cloudBridgeUrl,
    workspaceConfig.cloudBridgeKey,
    workspaceConfig.spreadsheetId,
    buildFullDatabasePayload,
    pullDatabaseInternal,
  ]);

  // Debounced Real-Time Auto-Sync when user explicitly enables autoSyncSpreadsheet (uses delta tabs!)
  useEffect(() => {
    if (!hasAutoSyncMountedRef.current) {
      hasAutoSyncMountedRef.current = true;
      return;
    }
    if (!isBridgeConnected || !workspaceConfig.autoSyncSpreadsheet) {
      return;
    }
    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false;
      return;
    }

    const bridgeUrl = workspaceConfig.cloudBridgeUrl!;
    const bridgeKey = workspaceConfig.cloudBridgeKey;
    const sheetId = workspaceConfig.spreadsheetId;
    const payload = buildFullDatabasePayload();

    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        setSyncPhase('Auto-sync tab berubah...');
        const saveRes = await saveFullDatabaseViaBridge(
          bridgeUrl,
          payload,
          bridgeKey,
          sheetId,
          lastSyncedTabHashesRef.current
        );
        if (saveRes.savedTabHashes) {
          lastSyncedTabHashesRef.current = saveRes.savedTabHashes;
          try {
            localStorage.setItem(LOCAL_STORAGE_TAB_HASHES_KEY, JSON.stringify(saveRes.savedTabHashes));
          } catch {}
        }
        if (saveRes.durationMs) setLastSyncDurationMs(saveRes.durationMs);
        skipNextDirtyMarkRef.current = true;
        setUnsavedChangesCount(0);
        setWorkspaceConfig((prev) => ({
          ...prev,
          spreadsheetId: saveRes.spreadsheetId || prev.spreadsheetId,
          spreadsheetName: saveRes.spreadsheetName || prev.spreadsheetName,
          spreadsheetUrl: saveRes.spreadsheetUrl || prev.spreadsheetUrl,
          lastSyncedAt: saveRes.updatedAt || new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('Auto-sync Cloud Bridge gagal:', err);
      } finally {
        setIsSyncing(false);
        setSyncPhase('');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    isBridgeConnected,
    workspaceConfig.cloudBridgeUrl,
    workspaceConfig.cloudBridgeKey,
    workspaceConfig.spreadsheetId,
    workspaceConfig.autoSyncSpreadsheet,
    buildFullDatabasePayload,
  ]);

  // Quick retry / fresh pull without confirmation when retrying an initial fetch
  const handleQuickRetryPull = useCallback(async () => {
    if (!isValidBridgeUrl(workspaceConfig.cloudBridgeUrl)) return;
    setIsSyncing(true);
    try {
      await pullDatabaseInternal(
        workspaceConfig.cloudBridgeUrl!,
        workspaceConfig.cloudBridgeKey,
        workspaceConfig.spreadsheetId,
        true,
        true
      );
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'Gagal memuat database dari Spreadsheet.',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [
    workspaceConfig.cloudBridgeUrl,
    workspaceConfig.cloudBridgeKey,
    workspaceConfig.spreadsheetId,
    pullDatabaseInternal,
  ]);

  // Trigger Update Database Confirmation Modal (or guide user to Bridge setup if disconnected)
  const handleUpdateDatabase = useCallback(() => {
    if (!isBridgeConnected) {
      setCurrentTab('workspace');
      setToastMessage({
        type: 'info',
        text: 'Hubungkan URL Web App Cloud Bridge terlebih dahulu untuk Update Database ke Spreadsheet.',
      });
      return;
    }
    setPendingSheetAction('update_db');
  }, [isBridgeConnected]);

  // Pull Trigger (opens explicit confirmation modal)
  const handlePullFromSheet = useCallback(() => {
    if (!isBridgeConnected) {
      setCurrentTab('workspace');
      setToastMessage({
        type: 'info',
        text: 'Hubungkan URL Web App Cloud Bridge terlebih dahulu.',
      });
      return;
    }
    setPendingSheetAction('pull_full_db');
  }, [isBridgeConnected]);

  // Transaction Success Handler
  const handleTransactionSuccess = (
    updatedAsset: OfficeAsset,
    newTransaction: AssetTransaction
  ) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
    );
    setTransactions((prev) => [newTransaction, ...prev]);

    setToastMessage({
      type: 'success',
      text: `Mutasi ${newTransaction.type} berhasil dicatat! Klik Update Database untuk menyimpan ke Spreadsheet.`,
    });
  };

  // Add Asset Success Handler
  const handleAssetAdded = (newAsset: OfficeAsset) => {
    setAssets((prev) => [newAsset, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Aset baru "${newAsset.name}" (${newAsset.id}) ditambahkan! Klik Update Database untuk simpan ke Spreadsheet.`,
    });
  };

  // Batch CSV Import Handler
  const handleBatchImport = (importedAssets: OfficeAsset[]) => {
    setAssets((prev) => [...importedAssets, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Berhasil mengimpor ${importedAssets.length} aset baru! Klik Update Database untuk sinkronkan ke Spreadsheet.`,
    });
  };

  // Edit Asset Handler
  const handleSaveEditedAsset = (updatedAsset: OfficeAsset) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
    );
    setToastMessage({
      type: 'success',
      text: `Perubahan aset "${updatedAsset.name}" dicatat. Klik Update Database untuk memperbarui Spreadsheet.`,
    });
  };

  // Delete Asset Handler
  const handleDeleteAsset = (assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setToastMessage({
      type: 'info',
      text: `Aset ${assetId} dihapus secara lokal. Klik Update Database untuk memperbarui Spreadsheet.`,
    });
  };

  // Stock Opname Session Handlers
  const handleAddStockOpnameSession = (newSession: StockOpnameSession) => {
    setStockOpnameSessions((prev) => [newSession, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Sesi stock opname "${newSession.title}" berhasil dibuat!`,
    });
  };

  const handleUpdateStockOpnameSession = (updatedSession: StockOpnameSession) => {
    setStockOpnameSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
  };

  const handleReconcileAssets = (
    reconciledList: { assetId: string; condition: AssetCondition; location: string }[]
  ) => {
    setAssets((prev) =>
      prev.map((a) => {
        const match = reconciledList.find((r) => r.assetId === a.id);
        if (match) {
          return {
            ...a,
            condition: match.condition,
            location: match.location,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );

    setToastMessage({
      type: 'success',
      text: `Berhasil merekonsiliasi ${reconciledList.length} aset! Klik Update Database untuk menyimpan ke Spreadsheet.`,
    });
  };

  // Asset Disposal Handlers (BAPA)
  const handleAddDisposal = (record: DisposalRecord, removeAssetFromStock: boolean) => {
    setDisposalRecords((prev) => [record, ...prev]);

    if (removeAssetFromStock) {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id === record.assetId) {
            return {
              ...a,
              status: 'Nonaktif / Dihapus' as const,
              availableStock: 0,
              borrowedStock: 0,
              notes: `${a.notes} [DIHAPUS VIA BAPA: ${record.documentNumber} - ${record.reason}]`,
              updatedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );
    }

    setToastMessage({
      type: 'success',
      text: `Berita Acara Penghapusan Aset (${record.documentNumber}) diterbitkan!`,
    });
  };

  // Maintenance Handlers
  const handleAddMaintenance = (newRecord: MaintenanceRecord) => {
    setMaintenanceRecords((prev) => [newRecord, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Jadwal pemeliharaan "${newRecord.serviceType}" untuk ${newRecord.assetName} berhasil dibuat.`,
    });
  };

  const handleCompleteMaintenance = (
    recordId: string,
    actualCost: number,
    restoreAssetCondition: boolean,
    driveInvoiceUrl?: string
  ) => {
    const record = maintenanceRecords.find((r) => r.id === recordId);
    if (!record) return;

    setMaintenanceRecords((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status: 'Selesai',
              actualCost,
              completedDate: new Date().toISOString().split('T')[0],
              driveInvoiceUrl: driveInvoiceUrl || r.driveInvoiceUrl,
            }
          : r
      )
    );

    if (restoreAssetCondition) {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id === record.assetId) {
            const restoredDamaged = Math.max(0, a.damagedStock - 1);
            return {
              ...a,
              condition: 'Baik',
              status: 'Tersedia',
              damagedStock: restoredDamaged,
              availableStock: a.availableStock + 1,
            };
          }
          return a;
        })
      );
    }

    setToastMessage({
      type: 'success',
      text: `Pemeliharaan aset ${record.assetName} ditandai selesai!`,
    });
  };

  const canManageMaster =
    !currentAppUser ||
    currentAppUser.role === 'SUPER_ADMIN' ||
    currentAppUser.role === 'ADMIN';
  const canMutateAssets = !currentAppUser || currentAppUser.role !== 'AUDITOR';

  // Modal Openers (with RBAC guards)
  const handleOpenAddAsset = () => {
    if (!canMutateAssets) {
      setToastMessage({
        type: 'info',
        text: 'Akun Auditor hanya memiliki akses lihat (Read-Only).',
      });
      return;
    }
    setIsAddAssetModalOpen(true);
  };

  const handleOpenBatchImport = () => {
    if (!canMutateAssets) {
      setToastMessage({
        type: 'info',
        text: 'Akun Auditor tidak dapat mengimpor data.',
      });
      return;
    }
    setIsBatchImportModalOpen(true);
  };

  const handleOpenTransactionForAsset = (asset?: OfficeAsset) => {
    if (!canMutateAssets) {
      setToastMessage({
        type: 'info',
        text: 'Akun Auditor tidak dapat mencatat mutasi aset.',
      });
      return;
    }
    setSelectedAssetForTrx(asset || assets[0] || null);
    setIsTransactionModalOpen(true);
  };

  const handleOpenLabelForAsset = (asset: OfficeAsset) => {
    setSelectedAssetForLabel(asset);
    setIsLabelModalOpen(true);
  };

  const handleOpenDepreciationForAsset = (asset: OfficeAsset) => {
    setSelectedAssetForDepreciation(asset);
    setIsDepreciationModalOpen(true);
  };

  const handleOpenEditForAsset = (asset: OfficeAsset) => {
    if (!canMutateAssets) {
      setToastMessage({
        type: 'info',
        text: 'Akun Auditor hanya memiliki akses lihat (Read-Only).',
      });
      return;
    }
    setSelectedAssetForEdit(asset);
    setIsEditAssetModalOpen(true);
  };

  const handleOpenBastForTrx = (trx: AssetTransaction) => {
    setSelectedTrxForBast(trx);
    setIsBastModalOpen(true);
  };

  const handleQuickReturnFromTracker = (trx: AssetTransaction) => {
    if (!canMutateAssets) {
      setToastMessage({
        type: 'info',
        text: 'Akun Auditor tidak dapat mencatat pengembalian.',
      });
      return;
    }
    const targetAsset = assets.find((a) => a.id === trx.assetId) || assets[0];
    setSelectedAssetForTrx(targetAsset);
    setIsTransactionModalOpen(true);
  };

  const handleViewPhoto = (photoUrl: string, title: string) => {
    setPhotoViewer({
      isOpen: true,
      url: photoUrl,
      title,
    });
  };

  const renderMainWorkspace = (isMobileLayout: boolean) => (
    <>
      {/* Proactive Warranty & Tax Expiration Alert Banner */}
      <WarrantyAlertsBanner
        assets={assets}
        onSelectAsset={(asset) => {
          handleOpenEditForAsset(asset);
        }}
      />

      {/* KPI Dashboard */}
      <DashboardKPI
        assets={assets}
        transactions={transactions}
        isBridgeConnected={isBridgeConnected}
        hasUnsavedChanges={hasUnsavedChanges}
        unsavedChangesCount={unsavedChangesCount}
        isSyncing={isSyncing}
        syncPhase={syncPhase}
        lastSyncDurationMs={lastSyncDurationMs}
        syncError={syncError}
        onQuickPull={handleQuickRetryPull}
        spreadsheetUrl={workspaceConfig.spreadsheetUrl}
        onUpdateDatabase={handleUpdateDatabase}
        onPullFromSheet={handlePullFromSheet}
        onOpenWorkspace={() => setCurrentTab('workspace')}
        onFilterStatus={(status) => {
          setSelectedStatusFilter(status);
          setCurrentTab('assets');
        }}
        selectedStatusFilter={selectedStatusFilter}
        isMobileLayout={isMobileLayout}
        canMutateAssets={canMutateAssets}
      />

      {/* Tab 1: Inventaris Aset */}
      {currentTab === 'assets' && (
        <AssetList
          assets={assets}
          onOpenTransactionModal={handleOpenTransactionForAsset}
          onOpenAddAssetModal={handleOpenAddAsset}
          onViewPhoto={handleViewPhoto}
          onOpenLabelModal={handleOpenLabelForAsset}
          onOpenDepreciationModal={handleOpenDepreciationForAsset}
          onOpenEditModal={handleOpenEditForAsset}
          selectedStatusFilter={selectedStatusFilter}
          onClearStatusFilter={() => setSelectedStatusFilter(null)}
          isMobileLayout={isMobileLayout}
          isLoadingInitial={isSyncing}
        />
      )}

      {/* Tab 2: Riwayat Mutasi & Peminjaman */}
      {currentTab === 'transactions' && (
        <TransactionHistory
          transactions={transactions}
          assets={assets}
          onViewPhoto={handleViewPhoto}
          onOpenBast={handleOpenBastForTrx}
          onQuickReturn={handleQuickReturnFromTracker}
          cloudBridgeUrl={workspaceConfig.cloudBridgeUrl}
          cloudBridgeKey={workspaceConfig.cloudBridgeKey}
        />
      )}

      {/* Tab 3: Stock Opname & Audit Fisik */}
      {currentTab === 'opname' && (
        <StockOpnameView
          assets={assets}
          sessions={stockOpnameSessions}
          onAddSession={handleAddStockOpnameSession}
          onUpdateSession={handleUpdateStockOpnameSession}
          onReconcileAssets={handleReconcileAssets}
          onOpenScanner={() => setIsScanModalOpen(true)}
          companySettings={companySettings}
        />
      )}

      {/* Tab 4: Jadwal Pemeliharaan & Servis Rutin */}
      {currentTab === 'maintenance' && (
        <MaintenanceView
          assets={assets}
          records={maintenanceRecords}
          onAddRecord={handleAddMaintenance}
          onCompleteRecord={handleCompleteMaintenance}
          cloudBridgeUrl={workspaceConfig.cloudBridgeUrl}
          cloudBridgeKey={workspaceConfig.cloudBridgeKey}
          currentUserEmail={
            currentAppUser?.email || workspaceConfig.notificationEmail || null
          }
          vendors={vendors}
        />
      )}

      {/* Tab 5: Penghapusan Aset Resmi (BAPA) */}
      {currentTab === 'disposal' &&
        (canManageMaster ? (
          <DisposalView
            assets={assets}
            records={disposalRecords}
            onAddDisposal={handleAddDisposal}
            companySettings={companySettings}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">
              Akses Khusus Admin / Super Admin
            </h4>
            <p className="text-xs text-slate-500">
              Halaman Penghapusan Aset (BAPA) hanya tersedia untuk peran Admin dan Super Admin.
            </p>
          </div>
        ))}

      {/* Tab 6: Laporan & Analitik Real-Time */}
      {currentTab === 'reports' && (
        <ReportsView
          assets={assets}
          transactions={transactions}
          maintenanceRecords={maintenanceRecords}
          spreadsheetUrl={workspaceConfig.spreadsheetUrl}
        />
      )}

      {/* Tab 7: Master Data & Pengaturan Aplikasi */}
      {currentTab === 'settings' &&
        (canManageMaster ? (
          <MasterSettingsView
            locations={locations}
            onAddLocation={(newLoc) => setLocations((prev) => [newLoc, ...prev])}
            onUpdateLocation={(updated) =>
              setLocations((prev) =>
                prev.map((l) => (l.id === updated.id ? updated : l))
              )
            }
            onDeleteLocation={(id) =>
              setLocations((prev) => prev.filter((l) => l.id !== id))
            }
            onImportLocations={(newLocs) =>
              setLocations((prev) => [...newLocs, ...prev])
            }
            vendors={vendors}
            onAddVendor={(newVnd) => setVendors((prev) => [newVnd, ...prev])}
            onUpdateVendor={(updated) =>
              setVendors((prev) =>
                prev.map((v) => (v.id === updated.id ? updated : v))
              )
            }
            onDeleteVendor={(id) =>
              setVendors((prev) => prev.filter((v) => v.id !== id))
            }
            onImportVendors={(newVnds) =>
              setVendors((prev) => [...newVnds, ...prev])
            }
            companySettings={companySettings}
            onUpdateCompanySettings={(cfg) => setCompanySettings(cfg)}
            customDivisions={customDivisions}
            onAddDivision={(div) =>
              setCustomDivisions((prev) => dedupeCodeItems([...prev, div]))
            }
            onUpdateDivision={(oldCode, updated) =>
              setCustomDivisions((prev) =>
                dedupeCodeItems(prev.map((d) => (d.code === oldCode ? updated : d)))
              )
            }
            onDeleteDivision={(code) =>
              setCustomDivisions((prev) => prev.filter((d) => d.code !== code))
            }
            onImportDivisions={(newDivs) =>
              setCustomDivisions((prev) => dedupeCodeItems([...prev, ...newDivs]))
            }
            customSubKelompoks={customSubKelompoks}
            onAddSubKelompok={(sub) =>
              setCustomSubKelompoks((prev) => dedupeCodeItems([...prev, sub]))
            }
            onUpdateSubKelompok={(oldCode, updated) =>
              setCustomSubKelompoks((prev) =>
                dedupeCodeItems(prev.map((s) => (s.code === oldCode ? updated : s)))
              )
            }
            onDeleteSubKelompok={(code) =>
              setCustomSubKelompoks((prev) =>
                prev.filter((s) => s.code !== code)
              )
            }
            onImportSubKelompoks={(newSubs) =>
              setCustomSubKelompoks((prev) => dedupeCodeItems([...prev, ...newSubs]))
            }
            allData={{
              assets,
              transactions,
              maintenanceRecords,
              stockOpnameSessions,
              disposalRecords,
            }}
            onRestoreAllData={(restored) => {
              if (restored.assets) setAssets(restored.assets);
              if (restored.transactions) setTransactions(restored.transactions);
              if (restored.maintenanceRecords)
                setMaintenanceRecords(restored.maintenanceRecords);
              if (restored.stockOpnameSessions)
                setStockOpnameSessions(restored.stockOpnameSessions);
              if (restored.disposalRecords)
                setDisposalRecords(restored.disposalRecords);
              if (restored.locations) setLocations(restored.locations);
              if (restored.vendors) setVendors(restored.vendors);
              if (restored.companySettings)
                setCompanySettings(restored.companySettings);
              if (restored.customDivisions)
                setCustomDivisions(dedupeCodeItems(restored.customDivisions));
              if (restored.customSubKelompoks)
                setCustomSubKelompoks(dedupeCodeItems(restored.customSubKelompoks));
              if (restored.appUsers) setAppUsers(restored.appUsers);
            }}
            appUsers={appUsers}
            currentAppUser={currentAppUser}
            onAddAppUser={(newUsr) => setAppUsers((prev) => [...prev, newUsr])}
            onUpdateAppUser={(updatedUsr) => {
              setAppUsers((prev) =>
                prev.map((u) => (u.id === updatedUsr.id ? updatedUsr : u))
              );
              if (currentAppUser?.id === updatedUsr.id) {
                setCurrentAppUser(updatedUsr);
              }
            }}
            onDeleteAppUser={(usrId) =>
              setAppUsers((prev) => prev.filter((u) => u.id !== usrId))
            }
            isBridgeConnected={isBridgeConnected}
            hasSpreadsheetId={Boolean(workspaceConfig.spreadsheetId)}
            hasUnsavedChanges={hasUnsavedChanges}
            unsavedChangesCount={unsavedChangesCount}
            isSyncingUsers={isSyncingUsers}
            onRefreshUsersFromSheet={() =>
              handleRefreshUsersFromSheet().then(() => undefined)
            }
            onPushUsersToSheet={handleUpdateDatabase}
            cloudBridgeUrl={workspaceConfig.cloudBridgeUrl}
            cloudBridgeKey={workspaceConfig.cloudBridgeKey}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">
              Akses Khusus Admin / Super Admin
            </h4>
            <p className="text-xs text-slate-500">
              Pengaturan Master Data &amp; Akun Pengguna hanya tersedia untuk peran Admin dan Super Admin.
            </p>
          </div>
        ))}

      {/* Tab 8: Pengaturan Database Spreadsheet & Drive */}
      {currentTab === 'workspace' && (
        <GoogleWorkspaceSettings
          workspaceConfig={workspaceConfig}
          onUpdateConfig={(newCfg) =>
            setWorkspaceConfig((prev) => ({ ...prev, ...newCfg }))
          }
          assets={assets}
          hasUnsavedChanges={hasUnsavedChanges}
          unsavedChangesCount={unsavedChangesCount}
          onUpdateDatabase={handleUpdateDatabase}
          onPullFromSheet={handlePullFromSheet}
          onRequestSpreadsheetAction={(action) => setPendingSheetAction(action)}
          onTestBridgeConnection={handleConnectBridge}
          onDisableAutoSync={() => {
            setWorkspaceConfig((prev) => ({
              ...prev,
              autoSyncSpreadsheet: false,
            }));
            setToastMessage({
              type: 'info',
              text: 'Auto-Sync dimatikan. Gunakan tombol Update Database kapan saja untuk menyimpan ke Spreadsheet.',
            });
          }}
          onOpenBridgeHelp={() => setIsBridgeHelpOpen(true)}
          isSyncing={isSyncing}
          currentUserEmail={currentAppUser?.email || null}
        />
      )}
    </>
  );

  const renderDesktopModeSwitcher = () => (
    <div className="bg-white border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {effectiveIsMobile ? (
            <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          ) : (
            <Monitor className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          )}
          <span>
            Mode Tampilan:{' '}
            <strong className="text-slate-900">
              {isForcedMobilePreview
                ? 'Versi Mobile (Preview Interaktif)'
                : viewMode === 'web'
                ? 'Versi Web Desktop'
                : 'Otomatis (Web Desktop)'}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('auto')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'auto'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Otomatis</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('web')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'web'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Versi Web</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mobile')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'mobile'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Versi Mobile</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Login Screen (Spreadsheet-backed only, zero Google OAuth)
  if (!currentAppUser) {
    return (
      <>
        <OfflineIndicator />
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md no-print">
            <div
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border ${
                toastMessage.type === 'success'
                  ? 'bg-slate-900 text-emerald-400 border-emerald-500/40'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-950 text-rose-200 border-rose-500/40'
                  : 'bg-slate-900 text-blue-300 border-blue-500/40'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        <SpreadsheetLoginView
          users={appUsers}
          companySettings={companySettings}
          logoFallbackUrl={logoFallbackDataUrl}
          workspaceConfig={workspaceConfig}
          isSyncingUsers={isSyncingUsers}
          onRefreshUsersFromSheet={() =>
            handleRefreshUsersFromSheet().then(() => undefined)
          }
          onConnectBridge={async (url, key, sheet) => {
            try {
              await handleConnectBridge(url, key, sheet);
            } catch (err: any) {
              setToastMessage({
                type: 'error',
                text: err?.message || 'Gagal menghubungkan ke Spreadsheet Bridge.',
              });
            }
          }}
          onLoginSuccess={handleAppLoginSuccess}
          onActivateInvitedUser={handleActivateInvitedUser}
          onFirstSuperAdminCreated={handleFirstSuperAdminCreated}
          onOpenBridgeHelp={() => setIsBridgeHelpOpen(true)}
          hasQrParam={Boolean(initialScanQuery)}
          onOpenQrResult={() => setIsScanModalOpen(true)}
          isPrefetchingDb={isPrefetchingDb}
          prefetchReady={prefetchReady}
          lastSyncDurationMs={lastSyncDurationMs}
        />

        <SpreadsheetBridgeHelpModal
          isOpen={isBridgeHelpOpen}
          onClose={() => setIsBridgeHelpOpen(false)}
          bridgeUrl={workspaceConfig.cloudBridgeUrl || ''}
          bridgeKey={workspaceConfig.cloudBridgeKey || ''}
          spreadsheetId={workspaceConfig.spreadsheetId}
          onApplyBridgeConfig={(url, key) => {
            void handleConnectBridge(url, key, workspaceConfig.spreadsheetId || undefined).catch(
              (err: any) => {
                setToastMessage({
                  type: 'error',
                  text: err?.message || 'Gagal menghubungkan URL Cloud Bridge.',
                });
              }
            );
          }}
        />

        <BarcodeScannerModal
          isOpen={isScanModalOpen}
          onClose={() => {
            setIsScanModalOpen(false);
            setInitialScanQuery(null);
          }}
          allAssets={assets}
          onSelectAssetForTransaction={handleOpenTransactionForAsset}
          onSelectAssetForLabel={handleOpenLabelForAsset}
          onSelectAssetForEdit={handleOpenEditForAsset}
          initialQuery={initialScanQuery}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Offline Indicator Banner */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed z-50 no-print ${
            effectiveIsMobile && !isForcedMobilePreview
              ? 'bottom-20 left-3.5 right-3.5'
              : 'bottom-5 right-5 max-w-md'
          }`}
        >
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-emerald-400 border-emerald-500/40'
                : toastMessage.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-500/40'
                : 'bg-slate-900 text-blue-300 border-blue-500/40'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Case 1: Desktop Web Version */}
      {!effectiveIsMobile && (
        <>
          <Navbar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            onOpenTransactionModal={() => handleOpenTransactionForAsset()}
            onOpenAddAssetModal={handleOpenAddAsset}
            onOpenScanModal={() => setIsScanModalOpen(true)}
            onOpenBatchLabelModal={() => setIsBatchLabelModalOpen(true)}
            onOpenBatchImportModal={handleOpenBatchImport}
            appUser={currentAppUser}
            onAppLogout={handleAppLogout}
            isBridgeConnected={isBridgeConnected}
            hasUnsavedChanges={hasUnsavedChanges}
            unsavedChangesCount={unsavedChangesCount}
            isSyncing={isSyncing}
            onUpdateDatabase={handleUpdateDatabase}
            onPullFromSheet={handlePullFromSheet}
            spreadsheetUrl={workspaceConfig.spreadsheetUrl}
            companySettings={companySettings}
            logoFallbackUrl={logoFallbackDataUrl}
            syncPhase={syncPhase}
            lastSyncDurationMs={lastSyncDurationMs}
          />
          {!isViewportMobile ? (
            renderDesktopModeSwitcher()
          ) : (
            <div className="bg-blue-50 border-b border-blue-200 px-3 py-1.5 flex items-center justify-between text-xs no-print">
              <span className="text-blue-900 font-medium">
                Mode Web Desktop aktif di layar kecil
              </span>
              <button
                type="button"
                onClick={() => setViewMode('auto')}
                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
              >
                Kembali ke Mobile
              </button>
            </div>
          )}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {renderMainWorkspace(false)}
          </main>
        </>
      )}

      {/* Case 2: Mobile Version Interactive Preview Frame (on Desktop) */}
      {isForcedMobilePreview && (
        <>
          {renderDesktopModeSwitcher()}
          <div className="flex-1 flex items-start justify-center px-4 py-5 bg-slate-200/70">
            <div className="w-full max-w-[420px] h-[820px] max-h-[calc(100vh-110px)] rounded-[2.25rem] border-[6px] border-slate-900 bg-slate-50 shadow-2xl overflow-hidden flex flex-col relative">
              <MobileTopBar
                currentTab={currentTab}
                companySettings={companySettings}
                logoFallbackUrl={logoFallbackDataUrl}
                onOpenAddAssetModal={handleOpenAddAsset}
                onOpenScanModal={() => setIsScanModalOpen(true)}
                isBridgeConnected={isBridgeConnected}
                hasUnsavedChanges={hasUnsavedChanges}
                unsavedChangesCount={unsavedChangesCount}
                isSyncing={isSyncing}
                syncPhase={syncPhase}
                onUpdateDatabase={handleUpdateDatabase}
                appUser={currentAppUser}
                onOpenMenu={() => setIsMobileMenuOpen(true)}
              />
              <main className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
                {renderMainWorkspace(true)}
              </main>
              <MobileBottomBar
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                onOpenScanModal={() => setIsScanModalOpen(true)}
                onOpenMenu={() => setIsMobileMenuOpen(true)}
                isPreviewFrame={true}
              />
              <MobileMenuSheet
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                onOpenAddAssetModal={handleOpenAddAsset}
                onOpenTransactionModal={() => handleOpenTransactionForAsset()}
                onOpenBatchLabelModal={() => setIsBatchLabelModalOpen(true)}
                onOpenBatchImportModal={handleOpenBatchImport}
                appUser={currentAppUser}
                onAppLogout={handleAppLogout}
                isBridgeConnected={isBridgeConnected}
                hasUnsavedChanges={hasUnsavedChanges}
                unsavedChangesCount={unsavedChangesCount}
                isSyncing={isSyncing}
                lastSyncDurationMs={lastSyncDurationMs}
                onUpdateDatabase={handleUpdateDatabase}
                onPullFromSheet={handlePullFromSheet}
                onSwitchToWeb={() => setViewMode('web')}
                isPreviewFrame={true}
              />
            </div>
          </div>
        </>
      )}

      {/* Case 3: Native Edge-to-Edge Mobile Version (Phone / Tablet < 1024px) */}
      {!isForcedMobilePreview && effectiveIsMobile && (
        <>
          <MobileTopBar
            currentTab={currentTab}
            companySettings={companySettings}
            logoFallbackUrl={logoFallbackDataUrl}
            onOpenAddAssetModal={handleOpenAddAsset}
            onOpenScanModal={() => setIsScanModalOpen(true)}
            isBridgeConnected={isBridgeConnected}
            hasUnsavedChanges={hasUnsavedChanges}
            unsavedChangesCount={unsavedChangesCount}
            isSyncing={isSyncing}
            syncPhase={syncPhase}
            onUpdateDatabase={handleUpdateDatabase}
            appUser={currentAppUser}
            onOpenMenu={() => setIsMobileMenuOpen(true)}
          />
          <main className="flex-1 w-full px-3.5 py-4 pb-24 space-y-4">
            {renderMainWorkspace(true)}
          </main>
          <MobileBottomBar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            onOpenScanModal={() => setIsScanModalOpen(true)}
            onOpenMenu={() => setIsMobileMenuOpen(true)}
            isPreviewFrame={false}
          />
          <MobileMenuSheet
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            onOpenAddAssetModal={handleOpenAddAsset}
            onOpenTransactionModal={() => handleOpenTransactionForAsset()}
            onOpenBatchLabelModal={() => setIsBatchLabelModalOpen(true)}
            onOpenBatchImportModal={handleOpenBatchImport}
            appUser={currentAppUser}
            onAppLogout={handleAppLogout}
            isBridgeConnected={isBridgeConnected}
            hasUnsavedChanges={hasUnsavedChanges}
            unsavedChangesCount={unsavedChangesCount}
            isSyncing={isSyncing}
            lastSyncDurationMs={lastSyncDurationMs}
            onUpdateDatabase={handleUpdateDatabase}
            onPullFromSheet={handlePullFromSheet}
            onSwitchToWeb={() => setViewMode('web')}
            isPreviewFrame={false}
          />
        </>
      )}

      {/* Transaction & Loan Modal */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        selectedAsset={selectedAssetForTrx}
        allAssets={assets}
        cloudBridgeUrl={workspaceConfig.cloudBridgeUrl}
        cloudBridgeKey={workspaceConfig.cloudBridgeKey}
        currentUserEmail={
          currentAppUser?.email || workspaceConfig.notificationEmail || null
        }
        workspaceConfig={workspaceConfig}
        onTransactionSuccess={handleTransactionSuccess}
        registeredLocations={locations}
      />

      {/* Add Asset Modal */}
      <AddAssetModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        cloudBridgeUrl={workspaceConfig.cloudBridgeUrl}
        cloudBridgeKey={workspaceConfig.cloudBridgeKey}
        spreadsheetId={workspaceConfig.spreadsheetId}
        onAssetAdded={handleAssetAdded}
        existingCount={assets.length}
        registeredLocations={locations}
        customDivisions={customDivisions}
        customSubKelompoks={customSubKelompoks}
      />

      {/* Batch Import CSV Modal */}
      <BatchImportModal
        isOpen={isBatchImportModalOpen}
        onClose={() => setIsBatchImportModalOpen(false)}
        existingCount={assets.length}
        onImportAssets={handleBatchImport}
      />

      {/* Batch Label Print Modal */}
      <BatchLabelModal
        isOpen={isBatchLabelModalOpen}
        onClose={() => setIsBatchLabelModalOpen(false)}
        allAssets={assets}
        companySettings={companySettings}
      />

      {/* Edit Asset Modal */}
      <EditAssetModal
        isOpen={isEditAssetModalOpen}
        onClose={() => setIsEditAssetModalOpen(false)}
        asset={selectedAssetForEdit}
        cloudBridgeUrl={workspaceConfig.cloudBridgeUrl}
        cloudBridgeKey={workspaceConfig.cloudBridgeKey}
        onSaveAsset={handleSaveEditedAsset}
        onDeleteAsset={handleDeleteAsset}
        registeredLocations={locations}
      />

      {/* Asset Label & QR Code Modal */}
      <AssetLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        asset={selectedAssetForLabel}
        allAssets={assets}
        companySettings={companySettings}
      />

      {/* Live Camera, Barcode & QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setInitialScanQuery(null);
        }}
        allAssets={assets}
        onSelectAssetForTransaction={handleOpenTransactionForAsset}
        onSelectAssetForLabel={handleOpenLabelForAsset}
        onSelectAssetForEdit={handleOpenEditForAsset}
        initialQuery={initialScanQuery}
      />

      {/* Spreadsheet Cloud Bridge & Apps Script Code.gs Help Modal */}
      <SpreadsheetBridgeHelpModal
        isOpen={isBridgeHelpOpen}
        onClose={() => setIsBridgeHelpOpen(false)}
        bridgeUrl={workspaceConfig.cloudBridgeUrl || ''}
        bridgeKey={workspaceConfig.cloudBridgeKey || ''}
        spreadsheetId={workspaceConfig.spreadsheetId}
        onApplyBridgeConfig={(url, key) => {
          void handleConnectBridge(url, key, workspaceConfig.spreadsheetId || undefined).catch(
            (err: any) => {
              setToastMessage({
                type: 'error',
                text: err?.message || 'Gagal menghubungkan URL Cloud Bridge.',
              });
            }
          );
        }}
      />

      {/* Explicit Confirmation Modal for Spreadsheet Database Operations */}
      <SpreadsheetConfirmModal
        isOpen={Boolean(pendingSheetAction)}
        action={pendingSheetAction}
        spreadsheetName={
          workspaceConfig.spreadsheetName || 'AsetKantor_Database_Inventaris'
        }
        counts={{
          assets: assets.length,
          transactions: transactions.length,
          maintenance: maintenanceRecords.length,
          opname: stockOpnameSessions.length,
          disposal: disposalRecords.length,
          locations: locations.length,
          vendors: vendors.length,
          users: appUsers.length,
        }}
        unsavedChangesCount={unsavedChangesCount}
        isProcessing={isSyncing}
        onConfirm={executeConfirmedSpreadsheetAction}
        onCancel={() => setPendingSheetAction(null)}
      />

      {/* BAST Digital Modal */}
      <BastModal
        isOpen={isBastModalOpen}
        onClose={() => setIsBastModalOpen(false)}
        transaction={selectedTrxForBast}
        asset={
          assets.find((a) => a.id === selectedTrxForBast?.assetId) || null
        }
        cloudBridgeUrl={workspaceConfig.cloudBridgeUrl}
        cloudBridgeKey={workspaceConfig.cloudBridgeKey}
        companySettings={companySettings}
        onSaveSignature={(trxId, sigUrl) => {
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === trxId ? { ...t, signatureDataUrl: sigUrl } : t
            )
          );
        }}
      />

      {/* Depreciation Calculator Modal */}
      <DepreciationCalculatorModal
        isOpen={isDepreciationModalOpen}
        onClose={() => setIsDepreciationModalOpen(false)}
        asset={selectedAssetForDepreciation}
      />

      {/* Full Photo Viewer Modal */}
      <PhotoViewerModal
        isOpen={photoViewer.isOpen}
        onClose={() => setPhotoViewer((prev) => ({ ...prev, isOpen: false }))}
        photoUrl={photoViewer.url}
        title={photoViewer.title}
      />

      {/* Footer (Web Version) */}
      {!effectiveIsMobile && (
        <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-center text-xs text-slate-500 no-print">
          <p>
            AsetKantor Enterprise &bull; Database Google Spreadsheet Online &amp; Google Drive (Tanpa Login Google).
          </p>
        </footer>
      )}
    </div>
  );
}
