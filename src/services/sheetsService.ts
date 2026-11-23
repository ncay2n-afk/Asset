import {
  OfficeAsset,
  AssetTransaction,
  AssetCategory,
  AssetCondition,
  AssetStatus,
  MaintenanceRecord,
  MaintenanceType,
  MaintenanceStatus,
  StockOpnameSession,
  DisposalRecord,
  DisposalType,
  MasterBuildingLocation,
  MasterVendor,
  MasterCompanySettings,
  AppUserAccount,
  AppUserRole,
  WorkspaceConfig
} from '../types';
import { CodeItem } from '../data/assetCodeGenerator';
import { normalizeDriveImageUrl } from './driveService';

export const TAB_ASSETS = 'Daftar_Aset';
export const TAB_TRANSACTIONS = 'Riwayat_Mutasi';
export const TAB_MAINTENANCE = 'Pemeliharaan_Servis';
export const TAB_OPNAME = 'Stock_Opname';
export const TAB_DISPOSAL = 'Penghapusan_BAPA';
export const TAB_LOCATIONS = 'Master_Lokasi';
export const TAB_VENDORS = 'Master_Vendor';
export const TAB_DIVISIONS = 'Master_Divisi';
export const TAB_SUB_KELOMPOKS = 'Master_SubKelompok';
export const TAB_SETTINGS = 'Pengaturan_Aplikasi';
export const TAB_USERS = 'Master_Pengguna';

export interface FullSpreadsheetDatabase {
  assets: OfficeAsset[];
  transactions: AssetTransaction[];
  maintenanceRecords: MaintenanceRecord[];
  stockOpnameSessions: StockOpnameSession[];
  disposalRecords: DisposalRecord[];
  locations: MasterBuildingLocation[];
  vendors: MasterVendor[];
  customDivisions: CodeItem[];
  customSubKelompoks: CodeItem[];
  companySettings: MasterCompanySettings;
  workspaceSettings?: Partial<WorkspaceConfig>;
  users?: AppUserAccount[];
}

export const ASSET_HEADERS = [
  'ID Aset',
  'Nama Aset',
  'Kategori',
  'SKU / Barcode',
  'Total Stok',
  'Stok Tersedia',
  'Stok Dipinjam',
  'Stok Rusak',
  'Satuan',
  'Lokasi',
  'Kondisi',
  'Status',
  'Tanggal Pembelian',
  'Harga Beli (IDR)',
  'PIC Penanggung Jawab',
  'Tautan Foto Google Drive',
  'Tanggal Foto',
  'Catatan',
  'Terakhir Diperbarui',
  'Nomor Seri (SN)',
  'Masa Manfaat (Tahun)',
  'Nilai Residu (IDR)',
  'Tgl Berakhir Garansi',
  'Tgl Jatuh Tempo Pajak',
];

export const TRANSACTION_HEADERS = [
  'ID Transaksi',
  'ID Aset',
  'Nama Aset',
  'Jenis Transaksi',
  'Jumlah',
  'Nama Staf',
  'Email Staf',
  'Departemen / Divisi',
  'Tanggal & Waktu',
  'Rencana Kembali',
  'Kondisi Sebelum',
  'Kondisi Sesudah',
  'Tautan Foto Bukti Google Drive',
  'ID File Drive',
  'Path Folder Drive',
  'Catatan / Alasan',
  'Status Notifikasi Email',
  'Penerima Email',
  'Lokasi Sebelum',
  'Lokasi Sesudah',
  'Tgl Dikembalikan Aktual',
  'Tautan Tanda Tangan BAST',
];

export const MAINTENANCE_HEADERS = [
  'ID Servis',
  'ID Aset',
  'Nama Aset',
  'Jenis Pemeliharaan',
  'Tgl Terjadwal',
  'Tgl Selesai',
  'Vendor / Teknisi',
  'Estimasi Biaya',
  'Biaya Aktual',
  'Status',
  'Catatan',
  'Link Nota Drive',
  'Dibuat Pada',
];

export const OPNAME_HEADERS = [
  'ID Sesi',
  'Judul Sesi',
  'Kode Divisi',
  'Nama Divisi',
  'Lokasi',
  'Tgl Terjadwal',
  'Status',
  'Auditor',
  'Catatan',
  'Total Ekspektasi',
  'Terverifikasi',
  'Selisih',
  'Selesai Pada',
  'Dibuat Pada',
  'Daftar Item JSON',
];

export const DISPOSAL_HEADERS = [
  'ID Penghapusan',
  'Nomor BAPA',
  'ID Aset',
  'Nama Aset',
  'Kategori',
  'Jenis Penghapusan',
  'Tgl Pengajuan',
  'Nilai Sisa / Lelang',
  'Nilai Buku',
  'Harga Perolehan',
  'Alasan',
  'Status',
  'PIC Approver',
  'Saksi',
  'Dibuat Pada',
];

export const LOCATION_HEADERS = ['ID Lokasi', 'Nama Gedung', 'Lantai / Zona', 'Nama Ruangan', 'Catatan'];

export const VENDOR_HEADERS = ['ID Vendor', 'Nama Vendor', 'Kategori Servis', 'Telepon', 'Email', 'Alamat', 'Nama PIC'];

export const CODE_ITEM_HEADERS = ['Kode', 'Nama'];

export const SETTINGS_HEADERS = ['Key', 'Value'];

export const USER_HEADERS = [
  'ID Pengguna',
  'Username',
  'Nama Lengkap',
  'Email',
  'Peran (Role)',
  'Divisi / Jabatan',
  'Status Aktif',
  'Password Hash',
  'Salt',
  'Dibuat Pada',
  'Login Terakhir',
];

export const ALL_TABS_CONFIG: { title: string; headers: string[] }[] = [
  { title: TAB_ASSETS, headers: ASSET_HEADERS },
  { title: TAB_TRANSACTIONS, headers: TRANSACTION_HEADERS },
  { title: TAB_MAINTENANCE, headers: MAINTENANCE_HEADERS },
  { title: TAB_OPNAME, headers: OPNAME_HEADERS },
  { title: TAB_DISPOSAL, headers: DISPOSAL_HEADERS },
  { title: TAB_LOCATIONS, headers: LOCATION_HEADERS },
  { title: TAB_VENDORS, headers: VENDOR_HEADERS },
  { title: TAB_DIVISIONS, headers: CODE_ITEM_HEADERS },
  { title: TAB_SUB_KELOMPOKS, headers: CODE_ITEM_HEADERS },
  { title: TAB_SETTINGS, headers: SETTINGS_HEADERS },
  { title: TAB_USERS, headers: USER_HEADERS },
];

function safeCell(val: string | number | boolean | null | undefined): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  // Google Sheets single cell limit is 50,000 chars
  if (str.length > 45000) {
    return '';
  }
  return str;
}

export function assetToRow(asset: OfficeAsset): string[] {
  return [
    safeCell(asset.id),
    safeCell(asset.name),
    safeCell(asset.category),
    safeCell(asset.sku),
    safeCell(asset.totalStock),
    safeCell(asset.availableStock),
    safeCell(asset.borrowedStock),
    safeCell(asset.damagedStock),
    safeCell(asset.unit),
    safeCell(asset.location),
    safeCell(asset.condition),
    safeCell(asset.status),
    safeCell(asset.purchaseDate),
    safeCell(asset.purchasePrice),
    safeCell(asset.custodian),
    safeCell(asset.lastPhotoUrl && !asset.lastPhotoUrl.startsWith('blob:') ? asset.lastPhotoUrl : ''),
    safeCell(asset.lastPhotoDate || ''),
    safeCell(asset.notes),
    safeCell(asset.updatedAt),
    safeCell(asset.serialNumber || ''),
    safeCell(asset.usefulLifeYears ?? ''),
    safeCell(asset.residualValue ?? ''),
    safeCell(asset.warrantyExpiryDate || ''),
    safeCell(asset.taxExpiryDate || ''),
  ];
}

export function transactionToRow(trx: AssetTransaction): string[] {
  return [
    safeCell(trx.id),
    safeCell(trx.assetId),
    safeCell(trx.assetName),
    safeCell(trx.type),
    safeCell(trx.quantity),
    safeCell(trx.staffName),
    safeCell(trx.staffEmail),
    safeCell(trx.department),
    safeCell(trx.date),
    safeCell(trx.expectedReturnDate || ''),
    safeCell(trx.conditionBefore),
    safeCell(trx.conditionAfter),
    safeCell(trx.photoDriveUrl || ''),
    safeCell(trx.photoDriveFileId || ''),
    safeCell(trx.photoDriveFolderName || ''),
    safeCell(trx.notes),
    safeCell(trx.emailNotificationSent ? 'Terkirim' : 'Tidak Terkirim'),
    safeCell(trx.emailRecipient),
    safeCell(trx.locationBefore || ''),
    safeCell(trx.locationAfter || ''),
    safeCell(trx.actualReturnDate || ''),
    safeCell(
      trx.signatureDataUrl && !trx.signatureDataUrl.startsWith('blob:') && trx.signatureDataUrl.length <= 45000
        ? trx.signatureDataUrl
        : ''
    ),
  ];
}

function maintenanceToRow(rec: MaintenanceRecord): string[] {
  return [
    safeCell(rec.id),
    safeCell(rec.assetId),
    safeCell(rec.assetName),
    safeCell(rec.serviceType),
    safeCell(rec.scheduledDate),
    safeCell(rec.completedDate || ''),
    safeCell(rec.vendorOrTechnician),
    safeCell(rec.estimatedCost),
    safeCell(rec.actualCost ?? ''),
    safeCell(rec.status),
    safeCell(rec.notes),
    safeCell(rec.driveInvoiceUrl || ''),
    safeCell(rec.createdAt),
  ];
}

function opnameToRow(s: StockOpnameSession): string[] {
  let itemsJson = '';
  try {
    const serialized = JSON.stringify(s.items || []);
    itemsJson = serialized.length <= 45000 ? serialized : '[]';
  } catch {
    itemsJson = '[]';
  }
  return [
    safeCell(s.id),
    safeCell(s.title),
    safeCell(s.divisionCode || ''),
    safeCell(s.divisionName || ''),
    safeCell(s.location),
    safeCell(s.scheduledDate),
    safeCell(s.status),
    safeCell(s.auditorName),
    safeCell(s.notes),
    safeCell(s.totalExpectedAssets),
    safeCell(s.verifiedCount),
    safeCell(s.discrepancyCount),
    safeCell(s.completedAt || ''),
    safeCell(s.createdAt),
    itemsJson,
  ];
}

function disposalToRow(d: DisposalRecord): string[] {
  return [
    safeCell(d.id),
    safeCell(d.documentNumber),
    safeCell(d.assetId),
    safeCell(d.assetName),
    safeCell(d.category),
    safeCell(d.disposalType),
    safeCell(d.requestDate),
    safeCell(d.salvageRecoveryAmount),
    safeCell(d.bookValueAtDisposal),
    safeCell(d.originalPrice),
    safeCell(d.reason),
    safeCell(d.status),
    safeCell(d.picApprover),
    safeCell(d.witnessName || ''),
    safeCell(d.createdAt),
  ];
}

function locationToRow(loc: MasterBuildingLocation): string[] {
  return [
    safeCell(loc.id),
    safeCell(loc.buildingName),
    safeCell(loc.floor),
    safeCell(loc.roomName),
    safeCell(loc.notes || ''),
  ];
}

function vendorToRow(v: MasterVendor): string[] {
  return [
    safeCell(v.id),
    safeCell(v.name),
    safeCell(v.serviceCategory),
    safeCell(v.phone),
    safeCell(v.email || ''),
    safeCell(v.address || ''),
    safeCell(v.picName),
  ];
}

function codeItemToRow(item: CodeItem): string[] {
  return [safeCell(item.code), safeCell(item.name)];
}

function settingsToRows(
  cfg: MasterCompanySettings,
  ws?: Partial<WorkspaceConfig>
): string[][] {
  return [
    ['companyName', safeCell(cfg.companyName)],
    ['brandSubtitle', safeCell(cfg.brandSubtitle)],
    ['logoUrl', cfg.logoUrl && cfg.logoUrl.length <= 45000 ? cfg.logoUrl : ''],
    ['address', safeCell(cfg.address)],
    ['phone', safeCell(cfg.phone)],
    ['email', safeCell(cfg.email)],
    ['defaultUsefulLifeYears', safeCell(cfg.defaultUsefulLifeYears)],
    ['defaultResidualPercent', safeCell(cfg.defaultResidualPercent)],
    ['bastNumberPrefix', safeCell(cfg.bastNumberPrefix)],
    ['bapaNumberPrefix', safeCell(cfg.bapaNumberPrefix)],
    ['soNumberPrefix', safeCell(cfg.soNumberPrefix)],
    ['assetCodeSeparator', safeCell(cfg.assetCodeSeparator)],
    ['driveFolderId', safeCell(ws?.driveFolderId || '')],
    ['driveFolderName', safeCell(ws?.driveFolderName || 'AsetKantor_Dokumentasi_Foto')],
    ['notificationEmail', safeCell(ws?.notificationEmail || '')],
    ['autoSendEmailOnLoan', String(ws?.autoSendEmailOnLoan ?? true)],
    ['autoSendEmailOnDamage', String(ws?.autoSendEmailOnDamage ?? true)],
    ['autoSendEmailOnLowStock', String(ws?.autoSendEmailOnLowStock ?? true)],
    ['lowStockThreshold', safeCell(ws?.lowStockThreshold ?? 1)],
  ];
}

function userToRow(u: AppUserAccount): string[] {
  return [
    safeCell(u.id),
    safeCell(u.username.trim().toLowerCase()),
    safeCell(u.fullName),
    safeCell(u.email.trim()),
    safeCell(u.role),
    safeCell(u.department),
    u.isActive ? 'Aktif' : 'Nonaktif',
    safeCell(u.passwordHash),
    safeCell(u.passwordSalt),
    safeCell(u.createdAt),
    safeCell(u.lastLoginAt || ''),
  ];
}

function normalizeUserRole(raw: string | undefined): AppUserRole {
  const val = String(raw || '').trim().toUpperCase();
  if (val === 'SUPER_ADMIN' || val === 'SUPER ADMIN' || val === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (val === 'ADMIN' || val === 'ADMIN ASET') return 'ADMIN';
  if (val === 'AUDITOR' || val === 'VIEWER') return 'AUDITOR';
  return 'OPERATOR';
}

function parseActiveStatus(raw: string | undefined): boolean {
  const val = String(raw || '').trim().toLowerCase();
  if (!val) return true;
  if (val === 'nonaktif' || val === 'tidak aktif' || val === 'false' || val === '0' || val === 'no' || val === 'tidak') {
    return false;
  }
  return true;
}

export function parseUserRows(rows: string[][]): AppUserAccount[] {
  return rows
    .filter((r) => (r[0] && String(r[0]).trim() !== '') || (r[1] && String(r[1]).trim() !== ''))
    .map((r, idx) => ({
      id: String(r[0] ?? '').trim() || `USR-${String(idx + 1).padStart(3, '0')}`,
      username: String(r[1] ?? r[3] ?? `user${idx + 1}`).trim().toLowerCase(),
      fullName: String(r[2] ?? r[1] ?? 'Pengguna').trim() || 'Pengguna',
      email: String(r[3] ?? '').trim(),
      role: normalizeUserRole(r[4]),
      department: String(r[5] ?? '').trim() || 'Umum',
      isActive: parseActiveStatus(r[6]),
      passwordHash: String(r[7] ?? '').trim(),
      passwordSalt: String(r[8] ?? '').trim(),
      createdAt: String(r[9] ?? '').trim() || new Date().toISOString(),
      lastLoginAt: String(r[10] ?? '').trim() || undefined,
    }));
}

function parseAssetsRows(rows: string[][]): OfficeAsset[] {
  return rows
    .filter((r) => r[0] && String(r[0]).trim() !== '')
    .map((r) => ({
      id: String(r[0] ?? ''),
      name: String(r[1] ?? '') || 'Aset Tanpa Nama',
      category: (r[2] as AssetCategory) || 'IT & Elektronik',
      sku: String(r[3] ?? ''),
      totalStock: Number(r[4]) || 0,
      availableStock: Number(r[5]) || 0,
      borrowedStock: Number(r[6]) || 0,
      damagedStock: Number(r[7]) || 0,
      unit: String(r[8] ?? '') || 'Unit',
      location: String(r[9] ?? '') || 'Kantor',
      condition: (r[10] as AssetCondition) || 'Baik',
      status: (r[11] as AssetStatus) || 'Tersedia',
      purchaseDate: String(r[12] ?? ''),
      purchasePrice: Number(r[13]) || 0,
      custodian: String(r[14] ?? ''),
      lastPhotoUrl: normalizeDriveImageUrl(r[15] || ''),
      lastPhotoDate: String(r[16] ?? ''),
      notes: String(r[17] ?? ''),
      updatedAt: String(r[18] ?? '') || new Date().toISOString(),
      serialNumber: r[19] ? String(r[19]) : undefined,
      usefulLifeYears: r[20] ? Number(r[20]) : undefined,
      residualValue: r[21] ? Number(r[21]) : undefined,
      warrantyExpiryDate: r[22] ? String(r[22]) : undefined,
      taxExpiryDate: r[23] ? String(r[23]) : undefined,
    }));
}

/**
 * Serializes the entire 11-tab application database into { [tabName]: [[headers...], ...rows] }.
 */
export function serializeDatabaseToTabs(db: FullSpreadsheetDatabase): Record<string, string[][]> {
  return {
    [TAB_ASSETS]: [ASSET_HEADERS, ...db.assets.map(assetToRow)],
    [TAB_TRANSACTIONS]: [TRANSACTION_HEADERS, ...db.transactions.map(transactionToRow)],
    [TAB_MAINTENANCE]: [MAINTENANCE_HEADERS, ...db.maintenanceRecords.map(maintenanceToRow)],
    [TAB_OPNAME]: [OPNAME_HEADERS, ...db.stockOpnameSessions.map(opnameToRow)],
    [TAB_DISPOSAL]: [DISPOSAL_HEADERS, ...db.disposalRecords.map(disposalToRow)],
    [TAB_LOCATIONS]: [LOCATION_HEADERS, ...db.locations.map(locationToRow)],
    [TAB_VENDORS]: [VENDOR_HEADERS, ...db.vendors.map(vendorToRow)],
    [TAB_DIVISIONS]: [CODE_ITEM_HEADERS, ...db.customDivisions.map(codeItemToRow)],
    [TAB_SUB_KELOMPOKS]: [CODE_ITEM_HEADERS, ...db.customSubKelompoks.map(codeItemToRow)],
    [TAB_SETTINGS]: [SETTINGS_HEADERS, ...settingsToRows(db.companySettings, db.workspaceSettings)],
    [TAB_USERS]: [USER_HEADERS, ...(db.users || []).map(userToRow)],
  };
}

/**
 * Parses 2D row maps returned from Google Spreadsheet (via Cloud Bridge or Sheet export) into typed app entities.
 */
export function parseDatabaseFromTabs(
  rowsByTab: Record<string, string[][]>,
  includesHeaderRow: boolean = true
): Partial<FullSpreadsheetDatabase> {
  const stripHeader = (tabName: string): string[][] | undefined => {
    const raw = rowsByTab[tabName];
    if (!Array.isArray(raw)) return undefined;
    if (!includesHeaderRow) return raw;
    return raw.length > 0 ? raw.slice(1) : [];
  };

  const result: Partial<FullSpreadsheetDatabase> = {};

  const assetsRows = stripHeader(TAB_ASSETS);
  if (assetsRows) {
    result.assets = parseAssetsRows(assetsRows);
  }

  const trxRows = stripHeader(TAB_TRANSACTIONS);
  if (trxRows) {
    result.transactions = trxRows
      .filter((r) => r[0])
      .map((r) => ({
        id: String(r[0] ?? ''),
        assetId: String(r[1] ?? ''),
        assetName: String(r[2] ?? ''),
        type: (r[3] as AssetTransaction['type']) || 'PEMINJAMAN',
        quantity: Number(r[4]) || 1,
        staffName: String(r[5] ?? ''),
        staffEmail: String(r[6] ?? ''),
        department: String(r[7] ?? ''),
        date: String(r[8] ?? ''),
        expectedReturnDate: r[9] && r[9] !== '-' ? String(r[9]) : undefined,
        conditionBefore: (r[10] as AssetCondition) || 'Baik',
        conditionAfter: (r[11] as AssetCondition) || 'Baik',
        photoDriveUrl: normalizeDriveImageUrl(r[12]) || undefined,
        photoDriveFileId: r[13] ? String(r[13]) : undefined,
        photoDriveFolderName: r[14] ? String(r[14]) : undefined,
        notes: String(r[15] ?? ''),
        emailNotificationSent: r[16] === 'Terkirim',
        emailRecipient: String(r[17] ?? ''),
        locationBefore: r[18] ? String(r[18]) : undefined,
        locationAfter: r[19] ? String(r[19]) : undefined,
        actualReturnDate: r[20] ? String(r[20]) : undefined,
        signatureDataUrl: normalizeDriveImageUrl(r[21]) || undefined,
      }));
  }

  const mtcRows = stripHeader(TAB_MAINTENANCE);
  if (mtcRows) {
    result.maintenanceRecords = mtcRows
      .filter((r) => r[0])
      .map((r) => ({
        id: String(r[0] ?? ''),
        assetId: String(r[1] ?? ''),
        assetName: String(r[2] ?? ''),
        serviceType: (r[3] as MaintenanceType) || 'Rutin Berkala',
        scheduledDate: String(r[4] ?? ''),
        completedDate: r[5] ? String(r[5]) : undefined,
        vendorOrTechnician: String(r[6] ?? ''),
        estimatedCost: Number(r[7]) || 0,
        actualCost: r[8] ? Number(r[8]) : undefined,
        status: (r[9] as MaintenanceStatus) || 'Terjadwal',
        notes: String(r[10] ?? ''),
        driveInvoiceUrl: normalizeDriveImageUrl(r[11]) || undefined,
        createdAt: String(r[12] ?? '') || new Date().toISOString(),
      }));
  }

  const opnameRows = stripHeader(TAB_OPNAME);
  if (opnameRows) {
    result.stockOpnameSessions = opnameRows
      .filter((r) => r[0])
      .map((r) => {
        let items = [];
        try {
          if (r[14]) items = JSON.parse(r[14]);
        } catch {}
        return {
          id: String(r[0] ?? ''),
          title: String(r[1] ?? ''),
          divisionCode: r[2] ? String(r[2]) : undefined,
          divisionName: r[3] ? String(r[3]) : undefined,
          location: String(r[4] ?? ''),
          scheduledDate: String(r[5] ?? ''),
          status: (r[6] as StockOpnameSession['status']) || 'DRAF',
          auditorName: String(r[7] ?? ''),
          notes: String(r[8] ?? ''),
          totalExpectedAssets: Number(r[9]) || 0,
          verifiedCount: Number(r[10]) || 0,
          discrepancyCount: Number(r[11]) || 0,
          completedAt: r[12] ? String(r[12]) : undefined,
          createdAt: String(r[13] ?? '') || new Date().toISOString(),
          items: Array.isArray(items) ? items : [],
        };
      });
  }

  const disposalRows = stripHeader(TAB_DISPOSAL);
  if (disposalRows) {
    result.disposalRecords = disposalRows
      .filter((r) => r[0])
      .map((r) => ({
        id: String(r[0] ?? ''),
        documentNumber: String(r[1] ?? ''),
        assetId: String(r[2] ?? ''),
        assetName: String(r[3] ?? ''),
        category: String(r[4] ?? ''),
        disposalType: (r[5] as DisposalType) || 'AFKIR_RUSAK_BERAT',
        requestDate: String(r[6] ?? ''),
        salvageRecoveryAmount: Number(r[7]) || 0,
        bookValueAtDisposal: Number(r[8]) || 0,
        originalPrice: Number(r[9]) || 0,
        reason: String(r[10] ?? ''),
        status: (r[11] as DisposalRecord['status']) || 'DIAJUKAN',
        picApprover: String(r[12] ?? ''),
        witnessName: r[13] ? String(r[13]) : undefined,
        createdAt: String(r[14] ?? '') || new Date().toISOString(),
      }));
  }

  const locRows = stripHeader(TAB_LOCATIONS);
  if (locRows) {
    result.locations = locRows
      .filter((r) => r[0])
      .map((r) => ({
        id: String(r[0] ?? ''),
        buildingName: String(r[1] ?? ''),
        floor: String(r[2] ?? ''),
        roomName: String(r[3] ?? ''),
        notes: r[4] ? String(r[4]) : undefined,
      }));
  }

  const vendorRows = stripHeader(TAB_VENDORS);
  if (vendorRows) {
    result.vendors = vendorRows
      .filter((r) => r[0])
      .map((r) => ({
        id: String(r[0] ?? ''),
        name: String(r[1] ?? ''),
        serviceCategory: String(r[2] ?? ''),
        phone: String(r[3] ?? ''),
        email: r[4] ? String(r[4]) : undefined,
        address: r[5] ? String(r[5]) : undefined,
        picName: String(r[6] ?? ''),
      }));
  }

  const divRows = stripHeader(TAB_DIVISIONS);
  if (divRows && divRows.length > 0) {
    result.customDivisions = divRows
      .filter((r) => r[0] && r[1])
      .map((r) => ({ code: String(r[0]), name: String(r[1]) }));
  }

  const subRows = stripHeader(TAB_SUB_KELOMPOKS);
  if (subRows && subRows.length > 0) {
    result.customSubKelompoks = subRows
      .filter((r) => r[0] && r[1])
      .map((r) => ({ code: String(r[0]), name: String(r[1]) }));
  }

  const settingsRows = stripHeader(TAB_SETTINGS);
  if (settingsRows && settingsRows.length > 0) {
    const map: Record<string, string> = {};
    settingsRows.forEach((r) => {
      if (r[0]) map[String(r[0])] = String(r[1] ?? '');
    });
    if (map.companyName) {
      result.companySettings = {
        companyName: map.companyName,
        brandSubtitle: map.brandSubtitle || '',
        logoUrl: normalizeDriveImageUrl(map.logoUrl) || undefined,
        address: map.address || '',
        phone: map.phone || '',
        email: map.email || '',
        defaultUsefulLifeYears: Number(map.defaultUsefulLifeYears) || 4,
        defaultResidualPercent: Number(map.defaultResidualPercent) || 10,
        bastNumberPrefix: map.bastNumberPrefix || 'BAST/AST',
        bapaNumberPrefix: map.bapaNumberPrefix || 'BAPA/GA',
        soNumberPrefix: map.soNumberPrefix || 'BA-SO',
        assetCodeSeparator: map.assetCodeSeparator === '-' ? '-' : '.',
      };
    }
    result.workspaceSettings = {
      driveFolderId: map.driveFolderId || null,
      driveFolderName: map.driveFolderName || 'AsetKantor_Dokumentasi_Foto',
      notificationEmail: map.notificationEmail || '',
      autoSendEmailOnLoan: map.autoSendEmailOnLoan !== 'false',
      autoSendEmailOnDamage: map.autoSendEmailOnDamage !== 'false',
      autoSendEmailOnLowStock: map.autoSendEmailOnLowStock !== 'false',
      lowStockThreshold: map.lowStockThreshold ? Number(map.lowStockThreshold) : 1,
    };
  }

  const userRows = stripHeader(TAB_USERS);
  if (userRows) {
    result.users = parseUserRows(userRows);
  }

  return result;
}
