import {
  IMAGE_DOWNSCALE_MAX_EDGE,
  IMAGE_DOWNSCALE_QUALITY,
} from '../limits';

export interface DownscaleOptions {
  maxEdge?: number;
  quality?: number;
}

export interface DownscaleResult {
  file: File;
  downscaled: boolean;
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * Downscale an image in the browser if either edge exceeds maxEdge (default 2000px).
 *
 * Preserves aspect ratio, compresses to JPEG at quality (default 0.85),
 * and replaces the file extension with .jpg.
 *
 * If the file is not a supported image (e.g. application/pdf) or its dimensions
 * are within limits, returns the original file unmodified with `downscaled: false`.
 *
 * Safely handles SSR / environments where window, document, or canvas are missing or mockable.
 */
export async function downscaleImageIfNeeded(
  file: File,
  options?: DownscaleOptions
): Promise<DownscaleResult> {
  if (!file) {
    return { file, downscaled: false };
  }

  const mimeType = (file.type || '').toLowerCase().split(';')[0].trim();
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { file, downscaled: false };
  }

  // SSR or non-browser environment check
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  ) {
    return { file, downscaled: false };
  }

  // URL API check
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return { file, downscaled: false };
  }

  const maxEdge = options?.maxEdge ?? IMAGE_DOWNSCALE_MAX_EDGE;
  const quality = options?.quality ?? IMAGE_DOWNSCALE_QUALITY;

  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
  } catch {
    return { file, downscaled: false };
  }

  try {
    const img =
      typeof Image !== 'undefined'
        ? new Image()
        : (document.createElement('img') as HTMLImageElement);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error('Failed to load image for downscaling'));
      img.src = objectUrl!;
    });

    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    const currentMaxEdge = Math.max(width, height);

    if (currentMaxEdge <= maxEdge || width === 0 || height === 0) {
      return { file, downscaled: false };
    }

    let targetWidth: number;
    let targetHeight: number;

    if (width >= height) {
      targetWidth = maxEdge;
      targetHeight = Math.max(1, Math.round((height * maxEdge) / width));
    } else {
      targetHeight = maxEdge;
      targetWidth = Math.max(1, Math.round((width * maxEdge) / height));
    }

    const canvas = document.createElement('canvas');
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { file, downscaled: false };
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.drawImage !== 'function') {
      return { file, downscaled: false };
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (b) => resolve(b),
          'image/jpeg',
          quality
        );
      } else if (typeof canvas.toDataURL === 'function') {
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const parts = dataUrl.split(',');
          const byteString = atob(parts[1] || '');
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          resolve(new Blob([ab], { type: 'image/jpeg' }));
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    if (!blob) {
      return { file, downscaled: false };
    }

    const newName = file.name.includes('.')
      ? file.name.replace(/\.[^.]+$/, '.jpg')
      : `${file.name}.jpg`;

    const downscaledFile = new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return {
      file: downscaledFile,
      downscaled: true,
    };
  } catch {
    // If decoding or drawing fails, fall back to original file safely
    return { file, downscaled: false };
  } finally {
    if (objectUrl && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
