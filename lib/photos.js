/** Ảnh đính kèm: clipboard, nén, data URL. */

const DEFAULT_TINT = '#E8D5C4';

export function newPhotoId() {
  return `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPhoto({ url, label = 'Ảnh đính kèm', kind = 'good', tint = DEFAULT_TINT }) {
  return {
    id: newPhotoId(),
    label,
    url,
    kind,
    tint,
  };
}

/** Lấy file ảnh từ sự kiện paste (Ctrl+V). */
export function getImageFilesFromClipboard(event) {
  const dt = event.clipboardData;
  if (!dt) return [];
  const files = [];
  for (const item of dt.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length > 0) return files;
  for (const f of dt.files) {
    if (f.type.startsWith('image/')) files.push(f);
  }
  return files;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh'));
    };
    img.src = url;
  });
}

/** Nén ảnh → data URL (JPEG) để lưu Supabase image_url / content_blocks. */
export async function fileToDataUrl(file, { maxDim = 1600, quality = 0.82 } = {}) {
  const img = await loadImageFromFile(file);
  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function filesToPhotos(files) {
  const photos = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = await fileToDataUrl(file);
    photos.push(createPhoto({
      url,
      label: file.name?.replace(/\.[^.]+$/, '') || 'Ảnh đính kèm',
    }));
  }
  return photos;
}
