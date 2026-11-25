function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  return `${base}${path}`;
}

async function prepareOcrImagePayload(
  file: File,
  maxWidth = 1800
): Promise<{ imageBase64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  const originalMime = match?.[1]?.toLowerCase() || file.type || 'image/jpeg';
  const originalBase64 = match?.[2] || '';

  if (typeof window === 'undefined') {
    return { imageBase64: originalBase64, mimeType: originalMime };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => {
      resolve({ imageBase64: originalBase64, mimeType: originalMime });
    };
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ imageBase64: originalBase64, mimeType: originalMime });
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const outDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const outMatch = /^data:([^;]+);base64,(.+)$/i.exec(outDataUrl);
      if (outMatch) {
        resolve({ imageBase64: outMatch[2], mimeType: 'image/jpeg' });
      } else {
        resolve({ imageBase64: originalBase64, mimeType: originalMime });
      }
    };
    img.src = dataUrl;
  });
}

export async function scanTextFromImageFile(file: File): Promise<string> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }

  const { imageBase64, mimeType } = await prepareOcrImagePayload(file);
  const res = await fetch(apiUrl('/api/ocr'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  let data: { text?: string; error?: string } = {};
  try {
    data = (await res.json()) as { text?: string; error?: string };
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.error || 'Could not extract text from this image.');
  }

  return (data.text || '').trim();
}
