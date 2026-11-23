import { AppUserAccount } from '../types';
import {
  ALL_TABS_CONFIG,
  FullSpreadsheetDatabase,
  TAB_USERS,
  parseDatabaseFromTabs,
  parseUserRows,
  serializeDatabaseToTabs,
} from './sheetsService';
import {
  DriveUploadResult,
  ROOT_DRIVE_FOLDER_NAME,
  getDriveDisplayUrl,
  getDriveViewerUrl,
  prepareImageForBridgeUpload,
} from './driveService';
import { SendEmailParams } from './gmailService';

export const DEFAULT_CLOUD_BRIDGE_URL =
  ((import.meta as any).env?.VITE_CLOUD_BRIDGE_URL as string | undefined)?.trim() || '';

export const DEFAULT_CLOUD_BRIDGE_KEY =
  ((import.meta as any).env?.VITE_CLOUD_BRIDGE_KEY as string | undefined)?.trim() || '';

const GET_TIMEOUT_MS = 28000;
const POST_TIMEOUT_MS = 45000;

export interface BridgePingResult {
  ok: boolean;
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  usersCount: number;
  assetCount: number;
}

export interface BridgeSaveResult {
  ok: boolean;
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  updatedAt: string;
  syncedTabsCount?: number;
  durationMs?: number;
  savedTabHashes?: Record<string, string>;
}

export function extractSpreadsheetId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  if (trimmed.includes('/d/')) {
    return trimmed.split('/d/')[1].split('/')[0].trim() || null;
  }
  return trimmed;
}

export function normalizeBridgeUrl(input?: string | null): string {
  if (!input) return '';
  return input.trim();
}

export function isValidBridgeUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://script.google.com/macros/s/') ||
    trimmed.startsWith('https://')
  );
}

/**
 * Generates a shareable multi-device URL so smartphones, tablets, and other laptops
 * auto-connect to the exact active Spreadsheet Bridge on first open — without Google Login.
 */
export function buildMultiDeviceShareUrl(
  bridgeUrl?: string | null,
  spreadsheetId?: string | null,
  bridgeKey?: string | null
): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin + window.location.pathname);
  if (bridgeUrl && bridgeUrl.trim()) {
    url.searchParams.set('bridge', bridgeUrl.trim());
  }
  if (spreadsheetId && spreadsheetId.trim()) {
    url.searchParams.set('sheet', spreadsheetId.trim());
  }
  if (bridgeKey && bridgeKey.trim()) {
    url.searchParams.set('key', bridgeKey.trim());
  }
  return url.toString();
}

/**
 * Fast deterministic FNV-1a checksum per tab so Update Database only uploads & writes modified tabs.
 */
function hashStringFnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ':' + str.length;
}

export function computeTabsHashes(tabs: Record<string, string[][]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [tabName, rows] of Object.entries(tabs)) {
    result[tabName] = hashStringFnv1a(JSON.stringify(rows));
  }
  return result;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(
        'Koneksi ke Cloud Bridge melebihi batas waktu. Periksa internet Anda lalu coba klik Tarik Sheet / Muat Ulang.'
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBridgeGet<T = any>(
  bridgeUrl: string,
  action: string,
  bridgeKey?: string,
  extraParams?: Record<string, string>
): Promise<T> {
  const cleanUrl = normalizeBridgeUrl(bridgeUrl);
  if (!cleanUrl) {
    throw new Error('URL Google Apps Script Cloud Bridge belum diisi.');
  }

  const target = new URL(cleanUrl);
  target.searchParams.set('action', action);
  if (bridgeKey && bridgeKey.trim()) {
    target.searchParams.set('key', bridgeKey.trim());
  }
  if (extraParams) {
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v) target.searchParams.set(k, v);
    });
  }
  // Cache-buster so mobile browsers never serve stale GET results
  target.searchParams.set('_ts', String(Date.now()));

  const res = await fetchWithTimeout(
    target.toString(),
    {
      method: 'GET',
      redirect: 'follow',
    },
    GET_TIMEOUT_MS
  );

  if (!res.ok) {
    throw new Error(`Cloud Bridge merespons HTTP ${res.status}. Pastikan Web App di-deploy dengan akses "Anyone".`);
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error('Respons Cloud Bridge bukan JSON valid. Pastikan deploy Web App Apps Script sudah benar.');
  }
  if (data.ok === false) {
    throw new Error(data.error || 'Terjadi kesalahan pada Google Apps Script Bridge.');
  }
  return data as T;
}

async function fetchBridgePost<T = any>(
  bridgeUrl: string,
  body: Record<string, any>,
  bridgeKey?: string
): Promise<T> {
  const cleanUrl = normalizeBridgeUrl(bridgeUrl);
  if (!cleanUrl) {
    throw new Error('URL Google Apps Script Cloud Bridge belum diisi.');
  }

  const payload = {
    ...body,
    key: bridgeKey && bridgeKey.trim() ? bridgeKey.trim() : undefined,
  };

  // Send as text/plain to avoid CORS preflight OPTIONS on Google Apps Script Web Apps
  const res = await fetchWithTimeout(
    cleanUrl,
    {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    },
    POST_TIMEOUT_MS
  );

  if (!res.ok) {
    throw new Error(`Cloud Bridge merespons HTTP ${res.status}.`);
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error('Respons Cloud Bridge bukan JSON valid. Periksa kode Apps Script Anda.');
  }
  if (data.ok === false) {
    throw new Error(data.error || 'Gagal menjalankan aksi di Spreadsheet Bridge.');
  }
  return data as T;
}

export async function pingCloudBridge(
  bridgeUrl: string,
  bridgeKey?: string,
  spreadsheetId?: string | null
): Promise<BridgePingResult> {
  return fetchBridgeGet<BridgePingResult>(bridgeUrl, 'ping', bridgeKey, {
    ...(spreadsheetId ? { spreadsheetId } : {}),
  });
}

export interface BridgeCompanyBranding {
  companyName?: string;
  brandSubtitle?: string;
  logoUrl?: string;
  logoDataUrl?: string;
}

export async function fetchUsersViaBridge(
  bridgeUrl: string,
  bridgeKey?: string,
  spreadsheetId?: string | null
): Promise<{
  users: AppUserAccount[];
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  companyBranding?: BridgeCompanyBranding;
  durationMs: number;
}> {
  const startedAt = performance.now();
  const data = await fetchBridgeGet<{
    ok: boolean;
    users: string[][];
    spreadsheetId?: string;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    companyBranding?: BridgeCompanyBranding;
  }>(bridgeUrl, 'get_users', bridgeKey, {
    ...(spreadsheetId ? { spreadsheetId } : {}),
  });

  return {
    users: parseUserRows(Array.isArray(data.users) ? data.users : []),
    spreadsheetId: data.spreadsheetId,
    spreadsheetName: data.spreadsheetName,
    spreadsheetUrl: data.spreadsheetUrl,
    companyBranding: data.companyBranding,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

export async function pullFullDatabaseViaBridge(
  bridgeUrl: string,
  bridgeKey?: string,
  spreadsheetId?: string | null,
  options?: { forceFresh?: boolean }
): Promise<
  Partial<FullSpreadsheetDatabase> & {
    spreadsheetId?: string;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    companyBranding?: BridgeCompanyBranding;
    tabHashes?: Record<string, string>;
    durationMs: number;
    fromServerCache?: boolean;
  }
> {
  const startedAt = performance.now();
  const data = await fetchBridgeGet<{
    ok: boolean;
    tabs: Record<string, string[][]>;
    spreadsheetId?: string;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    companyBranding?: BridgeCompanyBranding;
    cached?: boolean;
  }>(bridgeUrl, 'pull_db', bridgeKey, {
    ...(spreadsheetId ? { spreadsheetId } : {}),
    ...(options?.forceFresh ? { fresh: '1' } : {}),
  });

  const parsed = parseDatabaseFromTabs(data.tabs || {}, true);
  // Also compute hashes from canonical serialized payload so subsequent delta saves match cleanly
  const canonicalTabs = serializeDatabaseToTabs({
    assets: parsed.assets || [],
    transactions: parsed.transactions || [],
    maintenanceRecords: parsed.maintenanceRecords || [],
    stockOpnameSessions: parsed.stockOpnameSessions || [],
    disposalRecords: parsed.disposalRecords || [],
    locations: parsed.locations || [],
    vendors: parsed.vendors || [],
    customDivisions: parsed.customDivisions || [],
    customSubKelompoks: parsed.customSubKelompoks || [],
    companySettings: parsed.companySettings as any,
    workspaceSettings: parsed.workspaceSettings || {},
    users: parsed.users || [],
  });

  return {
    ...parsed,
    spreadsheetId: data.spreadsheetId,
    spreadsheetName: data.spreadsheetName,
    spreadsheetUrl: data.spreadsheetUrl,
    companyBranding: data.companyBranding,
    tabHashes: computeTabsHashes(canonicalTabs),
    durationMs: Math.round(performance.now() - startedAt),
    fromServerCache: Boolean(data.cached),
  };
}

export async function saveFullDatabaseViaBridge(
  bridgeUrl: string,
  db: FullSpreadsheetDatabase,
  bridgeKey?: string,
  spreadsheetId?: string | null,
  previousTabHashes?: Record<string, string> | null
): Promise<BridgeSaveResult> {
  const startedAt = performance.now();
  const allTabs = serializeDatabaseToTabs(db);
  const nextHashes = computeTabsHashes(allTabs);

  let tabsToSend: Record<string, string[][]> = allTabs;
  if (previousTabHashes && Object.keys(previousTabHashes).length > 0) {
    const delta: Record<string, string[][]> = {};
    for (const [tabName, rows] of Object.entries(allTabs)) {
      if (previousTabHashes[tabName] !== nextHashes[tabName]) {
        delta[tabName] = rows;
      }
    }
    if (Object.keys(delta).length > 0) {
      tabsToSend = delta;
    } else {
      // Nothing structurally changed across tabs; sync only Pengaturan_Aplikasi lightly to refresh timestamp
      tabsToSend = { Pengaturan_Aplikasi: allTabs['Pengaturan_Aplikasi'] };
    }
  }

  const syncedTabsCount = Object.keys(tabsToSend).length;
  const res = await fetchBridgePost<BridgeSaveResult>(
    bridgeUrl,
    {
      action: 'save_db',
      spreadsheetId: spreadsheetId || undefined,
      tabs: tabsToSend,
    },
    bridgeKey
  );

  return {
    ...res,
    syncedTabsCount,
    durationMs: Math.round(performance.now() - startedAt),
    savedTabHashes: nextHashes,
  };
}

export async function initDatabaseViaBridge(
  bridgeUrl: string,
  bridgeKey?: string,
  spreadsheetId?: string | null
): Promise<{ ok: boolean; spreadsheetId: string; spreadsheetName: string; spreadsheetUrl: string }> {
  return fetchBridgePost(
    bridgeUrl,
    {
      action: 'init_db',
      spreadsheetId: spreadsheetId || undefined,
    },
    bridgeKey
  );
}

export async function uploadImageViaBridge(
  bridgeUrl: string,
  file: File | Blob,
  fileName: string,
  folderSegments: string[],
  description: string = 'Dokumen visual AsetKantor',
  bridgeKey?: string
): Promise<DriveUploadResult> {
  const { base64Data, mimeType } = await prepareImageForBridgeUpload(file);

  const res = await fetchBridgePost<{
    ok: boolean;
    fileId: string;
    fileName: string;
    webViewLink?: string;
    imageUrl?: string;
    folderId?: string;
    folderPath?: string;
  }>(
    bridgeUrl,
    {
      action: 'upload_image',
      fileName,
      mimeType,
      base64Data,
      folderSegments,
      description,
    },
    bridgeKey
  );

  return {
    fileId: res.fileId,
    fileName: res.fileName || fileName,
    webViewLink: res.webViewLink || getDriveViewerUrl(res.fileId),
    imageUrl: res.imageUrl || getDriveDisplayUrl(res.fileId, 1200),
    folderId: res.folderId || '',
    folderPath: res.folderPath || `${ROOT_DRIVE_FOLDER_NAME} / ${folderSegments.join(' / ')}`,
  };
}

export async function uploadConditionPhotoViaBridge(
  bridgeUrl: string,
  file: File | Blob,
  fileName: string,
  assetId: string,
  dateStr: string,
  bridgeKey?: string
): Promise<DriveUploadResult> {
  const safeAssetFolder = assetId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeDate = dateStr.slice(0, 10);
  return uploadImageViaBridge(
    bridgeUrl,
    file,
    fileName,
    [safeAssetFolder, safeDate],
    `Bukti kondisi fisik aset ${assetId} per tanggal ${dateStr}`,
    bridgeKey
  );
}

export async function sendEmailViaBridge(
  bridgeUrl: string,
  params: SendEmailParams,
  bridgeKey?: string
): Promise<boolean> {
  await fetchBridgePost(
    bridgeUrl,
    {
      action: 'send_email',
      to: params.to,
      subject: params.subject,
      htmlBody: params.htmlBody,
    },
    bridgeKey
  );
  return true;
}

/**
 * Fallback read-only user fetch via Google Visualization endpoint when a Spreadsheet is shared publicly ("Anyone with the link can view").
 */
export async function fetchPublicSheetUsersFallback(spreadsheetId: string): Promise<AppUserAccount[]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('ID Google Spreadsheet tidak valid.');
  }

  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    cleanId
  )}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(TAB_USERS)}`;

  const res = await fetchWithTimeout(url, { method: 'GET' }, GET_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Gagal membaca Spreadsheet publik (${res.status}). Pastikan akses Spreadsheet atau Web App Bridge aktif.`);
  }

  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
  if (!match?.[1]) {
    throw new Error('Tab Master_Pengguna tidak dapat dibaca secara publik. Gunakan Web App Cloud Bridge.');
  }

  const json = JSON.parse(match[1]);
  const rows: string[][] = (json?.table?.rows || []).map((rowObj: any) =>
    (rowObj?.c || []).map((cell: any) => {
      if (!cell || cell.v === null || cell.v === undefined) return '';
      return String(cell.f ?? cell.v);
    })
  );

  // Filter out accidentally repeated header row if gviz treated row 1 as data
  const cleaned = rows.filter(
    (r) => String(r[0] || '').trim().toLowerCase() !== 'id pengguna'
  );
  return parseUserRows(cleaned);
}

/**
 * Generates ready-to-paste Google Apps Script (Code.gs v2 Turbo) with CacheService caching,
 * single-call Sheet map lookup, Drive logo caching, and delta-only save_db support.
 */
export function generateAppsScriptCode(accessKey: string = ''): string {
  const tabsJson = JSON.stringify(
    ALL_TABS_CONFIG.map((t) => ({ title: t.title, headers: t.headers })),
    null,
    2
  );
  const safeKey = accessKey.replace(/"/g, '\\"').trim();

  return `// =====================================================================
// AsetKantor Enterprise - Cloud Bridge v2 Turbo (Cache + Delta Sync)
// =====================================================================
// Fitur Kecepatan Tinggi:
// - CacheService Server-Side untuk pull_db (<500ms di semua device/GitHub)
// - Cache Logo Drive 6 jam (tidak baca DriveApp berulang kali)
// - Single-call getSheets() Map (hilangkan 20+ RPC lambat ke Spreadsheet)
// - Delta Save: save_db hanya menulis tab yang berubah saja
// =====================================================================

var ACCESS_KEY = "${safeKey}"; // Opsional: kunci rahasia Bridge
var ROOT_DRIVE_FOLDER = "${ROOT_DRIVE_FOLDER_NAME}";
var DEFAULT_SPREADSHEET_ID = ""; // Kosongkan jika script dibuat dari dalam Spreadsheet
var DB_CACHE_TTL_SEC = 300; // 5 menit cache server (otomatis di-reset setiap save_db)
var LOGO_CACHE_TTL_SEC = 21600; // 6 jam cache logo Drive
var CACHE_CHUNK_LEN = 90000;

var TAB_SCHEMAS = ${tabsJson};

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_(requestedId) {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {}
  if (!ss && requestedId) {
    ss = SpreadsheetApp.openById(requestedId);
  }
  if (!ss && DEFAULT_SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  }
  if (!ss) {
    throw new Error("Spreadsheet aktif tidak ditemukan. Buat Apps Script dari menu Ekstensi > Apps Script di dalam Google Spreadsheet Anda.");
  }
  return ss;
}

function getSheetMap_(ss) {
  var map = {};
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    map[sheets[i].getName()] = sheets[i];
  }
  return map;
}

function ensureTabsFast_(ss, sheetMap, forceCheck) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "tabs_ready_v2_" + ss.getId();
  if (!forceCheck && cache.get(cacheKey) === "1") {
    return sheetMap || getSheetMap_(ss);
  }
  var map = sheetMap || getSheetMap_(ss);
  for (var i = 0; i < TAB_SCHEMAS.length; i++) {
    var cfg = TAB_SCHEMAS[i];
    var sheet = map[cfg.title];
    if (!sheet) {
      sheet = ss.insertSheet(cfg.title);
      map[cfg.title] = sheet;
    }
    if (sheet.getLastRow() === 0) {
      var headerRange = sheet.getRange(1, 1, 1, cfg.headers.length);
      headerRange.setNumberFormat("@");
      headerRange.setValues([cfg.headers]);
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }
  cache.put(cacheKey, "1", 21600);
  return map;
}

function readSheetValues_(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return [];
  return sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
}

function resolveDriveImageDataUrl_(url) {
  if (!url) return "";
  var str = String(url).trim();
  if (str.indexOf("data:image/") === 0) return str;
  var match = str.match(/(?:\\/file\\/d\\/|[?&]id=|\\/d\\/)([a-zA-Z0-9_-]{10,})/);
  if (!match || !match[1]) return "";
  var fileId = match[1];
  var cache = CacheService.getScriptCache();
  var logoKey = "logo_v2_" + fileId;
  var cachedLogo = cache.get(logoKey);
  if (cachedLogo) return cachedLogo;
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var bytes = blob.getBytes();
    if (bytes.length > 350000) return "";
    var mime = blob.getContentType() || "image/png";
    var dataUrl = "data:" + mime + ";base64," + Utilities.base64Encode(bytes);
    if (dataUrl.length <= 95000) {
      cache.put(logoKey, dataUrl, LOGO_CACHE_TTL_SEC);
    }
    return dataUrl;
  } catch (err) {
    return "";
  }
}

function readCompanyBrandingFromMap_(sheetMap) {
  var sh = sheetMap["Pengaturan_Aplikasi"];
  if (!sh) return {};
  var rows = readSheetValues_(sh);
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var k = String(rows[i][0] || "").trim();
    if (k) map[k] = String(rows[i][1] || "");
  }
  var rawLogo = map.logoUrl || "";
  return {
    companyName: map.companyName || "",
    brandSubtitle: map.brandSubtitle || "",
    logoUrl: rawLogo,
    logoDataUrl: resolveDriveImageDataUrl_(rawLogo)
  };
}

function readCachedPullJson_(ssId) {
  try {
    var cache = CacheService.getScriptCache();
    var metaStr = cache.get("db_meta_v2_" + ssId);
    if (!metaStr) return null;
    var count = Number(metaStr);
    if (!count || count < 1) return null;
    var keys = [];
    for (var i = 0; i < count; i++) {
      keys.push("db_part_v2_" + ssId + "_" + i);
    }
    var parts = cache.getAll(keys);
    var joined = "";
    for (var j = 0; j < count; j++) {
      var chunk = parts[keys[j]];
      if (chunk === undefined || chunk === null) return null;
      joined += chunk;
    }
    return joined;
  } catch (err) {
    return null;
  }
}

function writeCachedPullJson_(ssId, jsonStr) {
  try {
    if (!jsonStr || jsonStr.length > 1800000) return;
    var cache = CacheService.getScriptCache();
    var count = Math.ceil(jsonStr.length / CACHE_CHUNK_LEN);
    var entries = {};
    for (var i = 0; i < count; i++) {
      entries["db_part_v2_" + ssId + "_" + i] = jsonStr.substr(i * CACHE_CHUNK_LEN, CACHE_CHUNK_LEN);
    }
    entries["db_meta_v2_" + ssId] = String(count);
    cache.putAll(entries, DB_CACHE_TTL_SEC);
  } catch (err) {}
}

function invalidateDbCache_(ssId) {
  try {
    var cache = CacheService.getScriptCache();
    var metaStr = cache.get("db_meta_v2_" + ssId);
    var toRemove = ["db_meta_v2_" + ssId];
    var count = Number(metaStr) || 0;
    for (var i = 0; i < count; i++) {
      toRemove.push("db_part_v2_" + ssId + "_" + i);
    }
    cache.removeAll(toRemove);
  } catch (err) {}
}

function getOrCreateFolderPath_(segments) {
  var roots = DriveApp.getFoldersByName(ROOT_DRIVE_FOLDER);
  var current = roots.hasNext() ? roots.next() : DriveApp.createFolder(ROOT_DRIVE_FOLDER);
  var pathParts = [ROOT_DRIVE_FOLDER];

  if (segments && segments.length) {
    for (var i = 0; i < segments.length; i++) {
      var seg = String(segments[i] || "").replace(/[^a-zA-Z0-9-_. ]/g, "_").trim();
      if (!seg) continue;
      var subIt = current.getFoldersByName(seg);
      current = subIt.hasNext() ? subIt.next() : current.createFolder(seg);
      pathParts.push(seg);
    }
  }

  return {
    folder: current,
    folderId: current.getId(),
    folderPath: pathParts.join(" / ")
  };
}

function checkAccessKey_(providedKey) {
  if (ACCESS_KEY && String(providedKey || "") !== ACCESS_KEY) {
    throw new Error("Kunci akses Bridge tidak valid.");
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    checkAccessKey_(params.key);
    var action = String(params.action || "ping");
    var ss = getSpreadsheet_(params.spreadsheetId);
    var ssId = ss.getId();

    if (action === "pull_db" && String(params.fresh || "") !== "1") {
      var cachedJson = readCachedPullJson_(ssId);
      if (cachedJson) {
        return ContentService
          .createTextOutput(cachedJson)
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    var sheetMap = ensureTabsFast_(ss, getSheetMap_(ss), false);

    if (action === "ping") {
      var usersSheet = sheetMap["${TAB_USERS}"];
      var assetsSheet = sheetMap["Daftar_Aset"];
      var usersCount = usersSheet ? Math.max(0, usersSheet.getLastRow() - 1) : 0;
      var assetCount = assetsSheet ? Math.max(0, assetsSheet.getLastRow() - 1) : 0;
      return jsonResponse_({
        ok: true,
        spreadsheetId: ssId,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        usersCount: usersCount,
        assetCount: assetCount,
        companyBranding: readCompanyBrandingFromMap_(sheetMap)
      });
    }

    if (action === "get_users") {
      var sheet = sheetMap["${TAB_USERS}"];
      var allRows = readSheetValues_(sheet);
      var dataRows = allRows.length > 1 ? allRows.slice(1) : [];
      return jsonResponse_({
        ok: true,
        spreadsheetId: ssId,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        users: dataRows,
        companyBranding: readCompanyBrandingFromMap_(sheetMap)
      });
    }

    if (action === "pull_db") {
      var tabs = {};
      for (var i = 0; i < TAB_SCHEMAS.length; i++) {
        var title = TAB_SCHEMAS[i].title;
        var sh = sheetMap[title];
        tabs[title] = sh ? readSheetValues_(sh) : [TAB_SCHEMAS[i].headers];
      }
      var freshPayload = {
        ok: true,
        spreadsheetId: ssId,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        tabs: tabs,
        companyBranding: readCompanyBrandingFromMap_(sheetMap)
      };
      var cachedVersionPayload = {
        ok: true,
        cached: true,
        spreadsheetId: freshPayload.spreadsheetId,
        spreadsheetName: freshPayload.spreadsheetName,
        spreadsheetUrl: freshPayload.spreadsheetUrl,
        tabs: freshPayload.tabs,
        companyBranding: freshPayload.companyBranding
      };
      writeCachedPullJson_(ssId, JSON.stringify(cachedVersionPayload));
      return jsonResponse_(freshPayload);
    }

    return jsonResponse_({ ok: false, error: "Action GET tidak dikenal: " + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || String(err) });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var body = JSON.parse(raw);
    checkAccessKey_(body.key);

    var action = String(body.action || "");

    if (action === "init_db") {
      var ssInit = getSpreadsheet_(body.spreadsheetId);
      ensureTabsFast_(ssInit, getSheetMap_(ssInit), true);
      invalidateDbCache_(ssInit.getId());
      return jsonResponse_({
        ok: true,
        spreadsheetId: ssInit.getId(),
        spreadsheetName: ssInit.getName(),
        spreadsheetUrl: ssInit.getUrl()
      });
    }

    if (action === "save_db") {
      var lock = LockService.getScriptLock();
      lock.waitLock(25000);
      try {
        var ssSave = getSpreadsheet_(body.spreadsheetId);
        var ssIdSave = ssSave.getId();
        var sheetMapSave = ensureTabsFast_(ssSave, getSheetMap_(ssSave), false);
        var tabs = body.tabs || {};
        var tabKeys = Object.keys(tabs);

        for (var i = 0; i < tabKeys.length; i++) {
          var title = tabKeys[i];
          var rows = tabs[title];
          if (!rows || !rows.length) continue;

          var sheet = sheetMapSave[title];
          if (!sheet) {
            sheet = ssSave.insertSheet(title);
            sheetMapSave[title] = sheet;
          }

          var oldLastRow = sheet.getLastRow();
          var oldLastCol = sheet.getLastColumn();
          var numRows = rows.length;
          var numCols = rows[0].length;
          if (numRows > 0 && numCols > 0) {
            var normalized = rows.map(function (r) {
              var out = [];
              for (var c = 0; c < numCols; c++) {
                out.push(r[c] === undefined || r[c] === null ? "" : String(r[c]));
              }
              return out;
            });
            var range = sheet.getRange(1, 1, numRows, numCols);
            if (oldLastRow === 0) {
              range.setNumberFormat("@");
              range.setValues(normalized);
              sheet.getRange(1, 1, 1, numCols).setFontWeight("bold");
              sheet.setFrozenRows(1);
            } else {
              range.setNumberFormat("@");
              range.setValues(normalized);
              if (oldLastRow > numRows) {
                sheet.getRange(numRows + 1, 1, oldLastRow - numRows, Math.max(oldLastCol, numCols)).clearContent();
              }
            }
          }
        }

        SpreadsheetApp.flush();
        invalidateDbCache_(ssIdSave);
        return jsonResponse_({
          ok: true,
          spreadsheetId: ssIdSave,
          spreadsheetName: ssSave.getName(),
          spreadsheetUrl: ssSave.getUrl(),
          updatedAt: new Date().toISOString()
        });
      } finally {
        lock.releaseLock();
      }
    }

    if (action === "upload_image") {
      var folderInfo = getOrCreateFolderPath_(body.folderSegments || []);
      var bytes = Utilities.base64Decode(body.base64Data);
      var blob = Utilities.newBlob(bytes, body.mimeType || "image/jpeg", body.fileName || ("FOTO_" + Date.now() + ".jpg"));
      var file = folderInfo.folder.createFile(blob);
      if (body.description) {
        file.setDescription(String(body.description));
      }
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (permErr) {}

      var fileId = file.getId();
      return jsonResponse_({
        ok: true,
        fileId: fileId,
        fileName: file.getName(),
        webViewLink: "https://drive.google.com/file/d/" + fileId + "/view",
        imageUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1200",
        folderId: folderInfo.folderId,
        folderPath: folderInfo.folderPath
      });
    }

    if (action === "send_email") {
      if (!body.to) throw new Error("Email penerima kosong.");
      MailApp.sendEmail({
        to: String(body.to),
        subject: String(body.subject || "[AsetKantor] Notifikasi"),
        htmlBody: String(body.htmlBody || "")
      });
      return jsonResponse_({ ok: true });
    }

    return jsonResponse_({ ok: false, error: "Action POST tidak dikenal: " + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || String(err) });
  }
}
`;
}
