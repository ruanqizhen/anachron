import { useState, useCallback, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Avatar from './Avatar';

interface AvatarUploadProps {
  currentUrl?: string | null;
  name: string;
  userId: string;
  adminMode?: boolean;
  onUrlChange?: (url: string) => void;
}

export default function AvatarUpload({ currentUrl, name, userId, adminMode, onUrlChange }: AvatarUploadProps) {
  const [url, setUrl] = useState(currentUrl || '');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { setUrl(currentUrl || ''); }, [currentUrl]);

  async function uploadBlob(blob: Blob) {
    setUploading(true);
    setMsg('');
    try {
      const path = `avatars/${userId}_${Date.now()}.jpg`;
      if (!supabase) return;
      await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      if (adminMode) {
        await supabase.rpc('admin_update_avatar', { p_id: userId, p_avatar_url: publicUrl });
      } else {
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
      }
      setUrl(publicUrl);
      onUrlChange?.(publicUrl);
      setMsg('头像已更新');
    } catch (err: any) { setMsg('上传失败: ' + err.message); }
    setUploading(false);
  }

  async function processFile(file: File) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); });
    const scale = Math.min(256 / img.width, 256 / img.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.8));
    await uploadBlob(blob);
  }

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        processFile(item.getAsFile()!);
        return;
      }
    }
  }, [userId]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} url={url} size={64} />
      <div className="flex flex-col gap-1">
        <label
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer transition-colors"
          style={{ backgroundColor: uploading ? 'var(--color-text-muted)' : 'var(--color-primary)' }}
        >
          <Camera size={14} /> {uploading ? '上传中...' : '更换头像'}
          <input type="file" accept="image/*" disabled={uploading} className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) processFile(file); }} />
        </label>
        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>选择文件或 Ctrl+V 粘贴</p>
        {msg && <p className="text-xs m-0" style={{ color: msg.includes('失败') ? 'var(--color-danger)' : 'var(--color-success)' }}>{msg}</p>}
      </div>
    </div>
  );
}
