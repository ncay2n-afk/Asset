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
 * Converts a Blob or File into raw base64 string (without data:* prefix).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses an image File/Blob into a lightweight JPEG/PNG Data URL.
 * Used both as offline/local fallback and to resize large smartphone photos before uploading via Cloud Bridge.
 */
export async function compressImageFileToDataUrl(
  file: Blob,
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

/**
 * Prepares an image File/Blob as a reasonably sized base64 payload for Cloud Bridge upload to Google Drive.
 */
export async function prepareImageForBridgeUpload(
  file: File | Blob
): Promise<{ base64Data: string; mimeType: string }> {
  const mimeType = file.type || 'image/jpeg';

  // Keep PNG signatures/logos crisp if already under 1.2MB
  if (mimeType === 'image/png' && file.size <= 1_200_000) {
    return {
      base64Data: await blobToBase64(file),
      mimeType: 'image/png',
    };
  }

  // Keep moderate JPEG/WebP files directly if under 1.5MB
  if (file.size <= 1_500_000 && mimeType.startsWith('image/')) {
    return {
      base64Data: await blobToBase64(file),
      mimeType,
    };
  }

  // Otherwise resize smoothly to max 1400px so mobile uploads to Apps Script stay fast and reliable
  try {
    const dataUrl = await compressImageFileToDataUrl(file, 1400, 0.82);
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (match) {
      return {
        mimeType: match[1] || 'image/jpeg',
        base64Data: match[2],
      };
    }
  } catch {
    // Fallback to raw bytes if canvas fails (e.g., SVG)
  }

  return {
    base64Data: await blobToBase64(file),
    mimeType,
  };
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal mengonversi tanda tangan ke gambar PNG.'));
    }, 'image/png');
  });
}
