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

  const res = await fetch(target.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

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
  const res = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

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
}> {
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
  };
}

export async function pullFullDatabaseViaBridge(
  bridgeUrl: string,
  bridgeKey?: string,
  spreadsheetId?: string | null
): Promise<
  Partial<FullSpreadsheetDatabase> & {
    spreadsheetId?: string;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    companyBranding?: BridgeCompanyBranding;
  }
> {
  const data = await fetchBridgeGet<{
    ok: boolean;
    tabs: Record<string, string[][]>;
    spreadsheetId?: string;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    companyBranding?: BridgeCompanyBranding;
  }>(bridgeUrl, 'pull_db', bridgeKey, {
    ...(spreadsheetId ? { spreadsheetId } : {}),
  });

  const parsed = parseDatabaseFromTabs(data.tabs || {}, true);
  return {
    ...parsed,
    spreadsheetId: data.spreadsheetId,
    spreadsheetName: data.spreadsheetName,
    spreadsheetUrl: data.spreadsheetUrl,
    companyBranding: data.companyBranding,
  };
}

export async function saveFullDatabaseViaBridge(
  bridgeUrl: string,
  db: FullSpreadsheetDatabase,
  bridgeKey?: string,
  spreadsheetId?: string | null
): Promise<BridgeSaveResult> {
  const tabs = serializeDatabaseToTabs(db);
  return fetchBridgePost<BridgeSaveResult>(
    bridgeUrl,
    {
      action: 'save_db',
      spreadsheetId: spreadsheetId || undefined,
      tabs,
    },
    bridgeKey
  );
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

  const res = await fetch(url);
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
 * Generates ready-to-paste Google Apps Script (Code.gs) that binds directly to the active Google Spreadsheet
 * and powers multi-device login, 11-tab database read/write, Google Drive photo storage, and Gmail alerts
 * WITHOUT requiring end users to sign in with Google.
 */
export function generateAppsScriptCode(accessKey: string = ''): string {
  const tabsJson = JSON.stringify(
    ALL_TABS_CONFIG.map((t) => ({ title: t.title, headers: t.headers })),
    null,
    2
  );
  const safeKey = accessKey.replace(/"/g, '\\"').trim();

  return `// =====================================================================
// AsetKantor Enterprise - Cloud Bridge untuk Google Spreadsheet & Drive
// =====================================================================
// Cara Pasang:
// 1. Buka Google Spreadsheet Anda -> Menu "Ekstensi" -> "Apps Script".
// 2. Hapus isi Code.gs lama, tempel seluruh skrip ini, lalu klik Simpan.
// 3. Klik "Terapkan" (Deploy) -> "Deployment baru" -> Jenis: "Aplikasi web".
// 4. Jalankan sebagai: "Saya" (Pemilik Sheet) | Yang memiliki akses: "Siapa saja" (Anyone).
// 5. Salin URL Web App (/exec) lalu tempel ke aplikasi AsetKantor.
// =====================================================================

var ACCESS_KEY = "${safeKey}"; // Opsional: isi kunci rahasia jika ingin membatasi akses Bridge
var ROOT_DRIVE_FOLDER = "${ROOT_DRIVE_FOLDER_NAME}";
var DEFAULT_SPREADSHEET_ID = ""; // Kosongkan jika script dibuat langsung dari dalam Spreadsheet

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

function ensureTabs_(ss) {
  for (var i = 0; i < TAB_SCHEMAS.length; i++) {
    var cfg = TAB_SCHEMAS[i];
    var sheet = ss.getSheetByName(cfg.title);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.title);
    }
    if (sheet.getLastRow() === 0) {
      var headerRange = sheet.getRange(1, 1, 1, cfg.headers.length);
      headerRange.setNumberFormat("@");
      headerRange.setValues([cfg.headers]);
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }
}

function readSheetValues_(sheet) {
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
  try {
    var file = DriveApp.getFileById(match[1]);
    var blob = file.getBlob();
    var bytes = blob.getBytes();
    if (bytes.length > 350000) return "";
    var mime = blob.getContentType() || "image/png";
    return "data:" + mime + ";base64," + Utilities.base64Encode(bytes);
  } catch (err) {
    return "";
  }
}

function readCompanyBranding_(ss) {
  var sh = ss.getSheetByName("Pengaturan_Aplikasi");
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

    if (action === "ping") {
      ensureTabs_(ss);
      var usersSheet = ss.getSheetByName("${TAB_USERS}");
      var assetsSheet = ss.getSheetByName("Daftar_Aset");
      var usersCount = usersSheet ? Math.max(0, usersSheet.getLastRow() - 1) : 0;
      var assetCount = assetsSheet ? Math.max(0, assetsSheet.getLastRow() - 1) : 0;
      return jsonResponse_({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        usersCount: usersCount,
        assetCount: assetCount,
        companyBranding: readCompanyBranding_(ss)
      });
    }

    if (action === "get_users") {
      ensureTabs_(ss);
      var sheet = ss.getSheetByName("${TAB_USERS}");
      var allRows = sheet ? readSheetValues_(sheet) : [];
      var dataRows = allRows.length > 1 ? allRows.slice(1) : [];
      return jsonResponse_({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        users: dataRows,
        companyBranding: readCompanyBranding_(ss)
      });
    }

    if (action === "pull_db") {
      ensureTabs_(ss);
      var tabs = {};
      for (var i = 0; i < TAB_SCHEMAS.length; i++) {
        var title = TAB_SCHEMAS[i].title;
        var sh = ss.getSheetByName(title);
        tabs[title] = sh ? readSheetValues_(sh) : [TAB_SCHEMAS[i].headers];
      }
      return jsonResponse_({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        tabs: tabs,
        companyBranding: readCompanyBranding_(ss)
      });
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
      ensureTabs_(ssInit);
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
        ensureTabs_(ssSave);
        var tabs = body.tabs || {};

        for (var i = 0; i < TAB_SCHEMAS.length; i++) {
          var title = TAB_SCHEMAS[i].title;
          var rows = tabs[title];
          if (!rows || !rows.length) continue;

          var sheet = ssSave.getSheetByName(title);
          if (!sheet) sheet = ssSave.insertSheet(title);
          sheet.clearContents();

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
            range.setNumberFormat("@");
            range.setValues(normalized);
            sheet.getRange(1, 1, 1, numCols).setFontWeight("bold");
            sheet.setFrozenRows(1);
          }
        }

        SpreadsheetApp.flush();
        return jsonResponse_({
          ok: true,
          spreadsheetId: ssSave.getId(),
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
