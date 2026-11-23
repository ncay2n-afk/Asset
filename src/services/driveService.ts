import type React from 'react';

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
  if (trimmed.startsWith('data:image/')) return trimmed;
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
 * Cycles through alternative Google Drive CDN URLs (and optional inline dataUrl fallback)
 * when an <img> fails to load on devices without Google login or with strict cookie rules.
 */
export function handleDriveImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  originalUrl?: string | null,
  inlineFallbackDataUrl?: string | null,
  onAllFailed?: () => void
): void {
  const img = event.currentTarget;
  const step = Number(img.dataset.fallbackStep || '0');
  const fileId = extractDriveFileId(originalUrl || img.src);

  const candidates: string[] = [];
  if (fileId) {
    candidates.push(
      `https://lh3.googleusercontent.com/d/${fileId}=w1200`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
    );
  }
  if (inlineFallbackDataUrl && inlineFallbackDataUrl !== img.src) {
    candidates.push(inlineFallbackDataUrl);
  }

  // Find next candidate that hasn't been tried and differs from current src
  let nextIdx = step;
  while (nextIdx < candidates.length && candidates[nextIdx] === img.src) {
    nextIdx++;
  }

  if (nextIdx < candidates.length) {
    img.dataset.fallbackStep = String(nextIdx + 1);
    img.src = candidates[nextIdx];
    return;
  }

  onAllFailed?.();
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
 * Converts a Data URL (e.g. data:image/png;base64,...) into a Blob for uploading to Drive.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(parts[1] || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Compresses an image File/Blob into a lightweight JPEG/PNG Data URL.
 */
export async function compressImageFileToDataUrl(
  file: Blob,
  maxDimension: number = 480,
  quality: number = 0.72,
  forceMime?: 'image/jpeg' | 'image/png'
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
        const usePng = forceMime ? forceMime === 'image/png' : file.type === 'image/png';
        if (!usePng) {
          // Fill white background before JPEG export so transparent PNG logos look clean
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = usePng
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
 * Compresses a company logo into a compact Data URL guaranteed <= 40,000 characters
 * so it is never dropped by Google Sheets' 50,000-character cell limit if stored inline.
 */
export async function compressLogoForSheetFallback(file: Blob): Promise<string> {
  const pngAttempt = await compressImageFileToDataUrl(file, 200, 0.8, 'image/png');
  if (pngAttempt.length <= 40000) return pngAttempt;

  const jpegAttempt1 = await compressImageFileToDataUrl(file, 256, 0.78, 'image/jpeg');
  if (jpegAttempt1.length <= 40000) return jpegAttempt1;

  return compressImageFileToDataUrl(file, 160, 0.65, 'image/jpeg');
}

/**
 * Prepares an image File/Blob as a reasonably sized base64 payload for Cloud Bridge upload to Google Drive.
 */
export async function prepareImageForBridgeUpload(
  file: File | Blob
): Promise<{ base64Data: string; mimeType: string }> {
  const mimeType = file.type || 'image/jpeg';

  if (mimeType === 'image/png' && file.size <= 1_200_000) {
    return {
      base64Data: await blobToBase64(file),
      mimeType: 'image/png',
    };
  }

  if (file.size <= 1_500_000 && mimeType.startsWith('image/')) {
    return {
      base64Data: await blobToBase64(file),
      mimeType,
    };
  }

  try {
    const dataUrl = await compressImageFileToDataUrl(file, 1400, 0.82);
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (match) {
      return {
        mimeType: match[1] || 'image/jpeg',
        base64Data: match[2],
      };
    }
  } catch {}

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
