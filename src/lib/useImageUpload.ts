import { useCallback } from 'react';
import { supabase } from './supabase';

export function useImageUpload(options: {
  userId?: string;
  onInsert: (markdown: string) => void;
  onPlaceholder?: () => string;
  onError?: () => void;
}) {
  const { userId, onInsert, onPlaceholder, onError } = options;

  const handleFile = useCallback(async (file: File) => {
    if (!supabase) return;
    const placeholder = onPlaceholder?.() ?? '\n![Uploading image...]()\n';

    try {
      onInsert(placeholder);

      // Compress
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); });
      const maxDim = 1024;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.8));

      // Upload
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.jpg`;
      const filePath = `${userId || 'guest'}/${fileName}`;
      const { error } = await supabase.storage.from('post-images').upload(filePath, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(filePath);

      // Replace placeholder with actual image
      onInsert(placeholder.replace('![Uploading image...]()', `![image](${publicUrl})`).replace(placeholder, `![image](${publicUrl})`));
    } catch (err) {
      console.error('Image upload error:', err);
      onInsert(placeholder.replace('\n![Uploading image...]()\n', ''));
      onError?.();
    }
  }, [supabase, userId, onInsert, onPlaceholder]);

  // Ctrl+V paste
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        handleFile(item.getAsFile()!);
        return;
      }
    }
  }, [handleFile]);

  // File input onChange
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return { handleFile, handlePaste, handleFileChange };
}
