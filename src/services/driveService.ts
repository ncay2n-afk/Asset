export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  imageUrl: string;
  folderId: string;
  folderPath: string;
  thumbnailLink?: string;
}

export const ROOT_DRIVE_FOLDER_NAME = 'AsetKantor_Dokumentasi_Foto';

/**
 * Extracts Google Drive File ID from common Drive URLs (file/d/ID, open?id=ID, thumbnail?id=ID, lh3/d/ID).
 */
export function extractDriveFileId(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1] && trimmed.includes('drive.google.com')) return idParamMatch[1];

  const lh3Match = trimmed.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match?.[1]) return lh3Match[1];

  return null;
}

export function getDriveDisplayUrl(fileId: string, widthPx: number = 1200): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${widthPx}`;
}

export function getDriveViewerUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Normalizes any Google Drive link into a direct image URL that renders cleanly in <img> tags.
 */
export function normalizeDriveImageUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    return getDriveDisplayUrl(fileId, 1200);
  }
  return trimmed;
}

/**
 * Converts a Drive image/thumbnail URL back to Google Drive's web viewer page if available.
 */
export function getDriveOpenLink(url?: string | null): string {
  if (!url) return '#';
  const fileId = extractDriveFileId(url);
  if (fileId) {
    return getDriveViewerUrl(fileId);
  }
  return url;
}

/**
 * Searches for a folder with a specific name in parents or root.
 */
async function findFolder(token: string, name: string, parentId?: string): Promise<string | null> {
  const safeName = name.replace(/'/g, "\\'");
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Error finding folder in Google Drive:', err);
    return null;
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Creates a folder in Google Drive.
 */
async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gagal membuat folder di Google Drive: ${res.status} ${errorBody}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * Ensures arbitrary folder hierarchy under ROOT_DRIVE_FOLDER_NAME ("AsetKantor_Dokumentasi_Foto").
 */
export async function ensureNestedDriveFolders(
  token: string,
  segments: string[]
): Promise<{ rootId: string; targetFolderId: string; folderPath: string }> {
  let rootId = await findFolder(token, ROOT_DRIVE_FOLDER_NAME);
  if (!rootId) {
    rootId = await createFolder(token, ROOT_DRIVE_FOLDER_NAME);
  }

  let currentParentId = rootId;
  const cleanSegments: string[] = [ROOT_DRIVE_FOLDER_NAME];

  for (const rawSeg of segments) {
    const safeSeg = rawSeg.replace(/[^a-zA-Z0-9-_. ]/g, '_').trim();
    if (!safeSeg) continue;
    let folderId = await findFolder(token, safeSeg, currentParentId);
    if (!folderId) {
      folderId = await createFolder(token, safeSeg, currentParentId);
    }
    currentParentId = folderId;
    cleanSegments.push(safeSeg);
  }

  return {
    rootId,
    targetFolderId: currentParentId,
    folderPath: cleanSegments.join(' / '),
  };
}

/**
 * Ensures folder hierarchy:
 * Root Folder ("AsetKantor_Dokumentasi_Foto")
 *   └── Asset Folder (e.g. "01_14_001_001_24")
 *         └── Date Folder (e.g. "2026-09-25")
 */
export async function ensureDriveFolderHierarchy(
  token: string,
  assetId: string,
  dateStr: string
): Promise<{ rootId: string; targetFolderId: string; folderPath: string }> {
  const safeAssetFolder = assetId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeDate = dateStr.slice(0, 10);
  return ensureNestedDriveFolders(token, [safeAssetFolder, safeDate]);
}

/**
 * Generic image/file uploader to Google Drive under AsetKantor_Dokumentasi_Foto/<subFolders>.
 */
export async function uploadAssetFileToDrive(
  token: string,
  file: File | Blob,
  fileName: string,
  folderSegments: string[],
  description: string = 'Dokumen visual AsetKantor'
): Promise<DriveUploadResult> {
  const { targetFolderId, folderPath } = await ensureNestedDriveFolders(token, folderSegments);

  const mimeType = file.type || 'image/jpeg';
  const metadata = {
    name: fileName,
    mimeType,
    parents: [targetFolderId],
    description,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  const metadataString =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(metadataString);
  const footerBytes = encoder.encode(closeDelimiter);

  const combined = new Uint8Array(headerBytes.length + fileBytes.length + footerBytes.length);
  combined.set(headerBytes, 0);
  combined.set(fileBytes, headerBytes.length);
  combined.set(footerBytes, headerBytes.length + fileBytes.length);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gagal mengunggah gambar ke Google Drive: ${res.status} ${errorBody}`);
  }

  const uploadedFile = await res.json();

  // Set read permission so images render directly inside the app and shared Spreadsheet links
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (err) {
    console.warn('Could not set public permission on Drive file (scoped access only)', err);
  }

  const fileId = uploadedFile.id;
  return {
    fileId,
    fileName: uploadedFile.name || fileName,
    webViewLink: uploadedFile.webViewLink || getDriveViewerUrl(fileId),
    imageUrl: getDriveDisplayUrl(fileId, 1200),
    folderId: targetFolderId,
    folderPath,
    thumbnailLink: uploadedFile.thumbnailLink,
  };
}

/**
 * Uploads an asset condition photo to Google Drive under /<assetId>/<date>.
 */
export async function uploadConditionPhotoToDrive(
  token: string,
  file: File | Blob,
  fileName: string,
  assetId: string,
  dateStr: string
): Promise<DriveUploadResult> {
  const safeAssetFolder = assetId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeDate = dateStr.slice(0, 10);
  return uploadAssetFileToDrive(
    token,
    file,
    fileName,
    [safeAssetFolder, safeDate],
    `Bukti kondisi fisik aset ${assetId} per tanggal ${dateStr}`
  );
}

/**
 * Compresses an image File into a lightweight JPEG/PNG Data URL (used only for offline fallback when Google Drive is not connected).
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension: number = 480,
  quality: number = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === 'image/png';
        const dataUrl = isPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objUrl);
        reject(err);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objUrl);
      reject(err);
    };
    img.src = objUrl;
  });
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal mengonversi tanda tangan ke gambar PNG.'));
    }, 'image/png');
  });
}
