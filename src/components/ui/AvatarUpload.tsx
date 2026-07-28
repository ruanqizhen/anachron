import { useState, useCallback, useEffect, useRef } from 'react';
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 8192; // browser canvas limit guard
const AVATAR_SIZE = 256;

export default function AvatarUpload({ currentUrl, name, userId, adminMode, onUrlChange }: AvatarUploadProps) {
  const [url, setUrl] = useState(currentUrl || '');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const currentUrlRef = useRef(currentUrl);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentUrl !== currentUrlRef.current) {
      currentUrlRef.current = currentUrl;
      setUrl(currentUrl || '');
    }
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const uploadBlob = useCallback(async (blob: Blob) => {
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
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      if (m.includes('size')) setMsg('上传失败: 图片过大');
      else if (m.includes('type')) setMsg('上传失败: 不支持的格式');
      else setMsg('上传失败: ' + m);
    }
    setUploading(false);
  }, [userId, adminMode, onUrlChange]);

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setMsg('上传失败: 文件过大，请选择10MB以下的图片');
      return;
    }

    // Revoke previous object URL if any
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    const img = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片解码失败'));
        img.src = objectUrl;
      });

      if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
        throw new Error(`图片尺寸过大，最大支持 ${MAX_DIMENSION}x${MAX_DIMENSION}`);
      }

      const scale = Math.min(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas不支持');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('压缩失败')), 'image/jpeg', 0.8);
      });
      await uploadBlob(blob);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      if (!m.includes('头像已更新')) {
        if (m.includes('尺寸')) setMsg('上传失败: ' + m);
        else if (m.includes('解码')) setMsg('上传失败: 图片格式错误');
        else setMsg('上传失败: ' + m);
      }
    } finally {
      // Always revoke object URL after processing
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      // Clear file input value to allow re-selecting same file
    }
  }, [uploadBlob]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processFile(file);
        return;
      }
    }
  }, [processFile]);

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
            onChange={e => { const file = e.target.files?.[0]; if (file) processFile(file); if (e.target) e.target.value = ''; }} />
        </label>
        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>选择文件或 Ctrl+V 粘贴（10MB以内）</p>
        {msg && <p className="text-xs m-0" style={{ color: msg.includes('失败') ? 'var(--color-danger)' : 'var(--color-success)' }}>{msg}</p>}
      </div>
    </div>
  );
}
