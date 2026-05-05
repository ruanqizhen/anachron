import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Lock, Camera, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import Avatar from '../components/ui/Avatar';

export default function Settings() {
  const { user, profile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [username, setUsername] = useState(profile?.username || '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const uid = user?.id || '';
  const userEmail = user?.email || '';

  // Debounced username availability check
  useEffect(() => {
    const name = username.trim();
    if (!name || name === (profile?.username || '')) { setTimeout(() => setUsernameAvailable(null), 0); return; }
    if (name.length < 2) { setTimeout(() => setUsernameAvailable(null), 0); return; }
    setTimeout(() => setUsernameChecking(true), 0);
    const timer = setTimeout(async () => {
      const { data } = await supabase!
        .from('profiles')
        .select('id')
        .eq('username', name)
        .maybeSingle();
      setUsernameAvailable(!data);
      setUsernameChecking(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  if (!user) {
    return (
      <div className="max-w-[600px] mx-auto px-4 pt-[72px] pb-8 text-center py-20">
        <p style={{ color: 'var(--color-text-secondary)' }}>请先登录</p>
        <Link to="/login" style={{ color: 'var(--color-primary)' }}>去登录</Link>
      </div>
    );
  }

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault();
    setUsernameMsg('');
    const name = username.trim();
    if (!name || name.length < 2) { setUsernameMsg('用户名至少 2 个字符'); return; }
    if (name.length > 20) { setUsernameMsg('用户名最多 20 个字符'); return; }
    if (!/^[\w一-鿿]+$/.test(name)) { setUsernameMsg('用户名只能包含中文、字母、数字和下划线'); return; }

    // Pre-check availability
    if (name !== (profile?.username || '')) {
      const { data: existing } = await supabase!.from('profiles').select('id').eq('username', name).maybeSingle();
      if (existing) { setUsernameMsg('该用户名已被占用，请换一个'); return; }
    }

    setUsernameSaving(true);
    const { error } = await supabase!.from('profiles').update({ username: name }).eq('id', uid);
    setUsernameSaving(false);
    if (error) {
      setUsernameMsg(error.message.includes('unique') || error.message.includes('duplicate')
        ? '该用户名已被占用' : '保存失败: ' + error.message);
    } else {
      setUsernameMsg('用户名已更新');
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg('');
    if (!currentPw || !newPw) { setPwMsg('请填写当前密码和新密码'); return; }
    if (newPw.length < 6) { setPwMsg('新密码至少 6 位'); return; }

    setPwSaving(true);
    // Supabase requires recent sign-in for sensitive operations — re-authenticate first
    const { error: signInErr } = await supabase!.auth.signInWithPassword({
      email: userEmail,
      password: currentPw,
    });
    if (signInErr) {
      setPwMsg('当前密码错误');
      setPwSaving(false);
      return;
    }
    const { error } = await supabase!.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      setPwMsg('修改失败: ' + error.message);
    } else {
      setPwMsg('密码已更新');
      setCurrentPw('');
      setNewPw('');
    }
  }

  async function compressImage(file: File, maxSize = 256, quality = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('compress failed')), 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    outline: 'none', fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)',
  };

  return (
    <div className="max-w-[600px] mx-auto px-4 pt-[72px] pb-8">
      <Link to="/" className="flex items-center gap-1 text-sm no-underline mb-6 hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
        <ArrowLeft size={14} /> 返回首页
      </Link>

      <h1 className="text-xl font-bold mb-6">设置</h1>

      {/* Avatar */}
      <div className="rounded-lg p-5 mb-4" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
        <h2 className="flex items-center gap-2 text-base font-bold mb-4">
          <Camera size={18} /> 头像
        </h2>
        <div className="flex items-center gap-4">
          <Avatar name={profile?.username || userEmail} url={avatarUrl} size={64} />
          <div className="flex-1">
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>选择一个图片文件来替换当前头像，支持 JPG、PNG 格式，上传后自动压缩</p>
            <label
              className="inline-block px-3 py-1.5 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors hover:opacity-80"
              style={{ backgroundColor: avatarUploading ? 'var(--color-text-muted)' : 'var(--color-primary)' }}
            >
              {avatarUploading ? '上传中...' : '选择文件'}
              <input
                type="file"
                accept="image/*"
                disabled={avatarUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { setAvatarMsg('图片不能超过 5MB'); return; }
                  setAvatarUploading(true);
                  setAvatarMsg('');
                  try {
                    const compressed = await compressImage(file);
                    const path = `avatars/${uid}_${Date.now()}.jpg`;
                    const { error } = await supabase!.storage.from('avatars').upload(path, compressed, {
                      upsert: true,
                      contentType: 'image/jpeg',
                    });
                    if (error) {
                      setAvatarMsg('上传失败: ' + error.message);
                    } else {
                      const { data: { publicUrl } } = supabase!.storage.from('avatars').getPublicUrl(path);
                      await supabase!.from('profiles').update({ avatar_url: publicUrl }).eq('id', uid);
                      setAvatarUrl(publicUrl);
                      setAvatarMsg('头像已更新');
                    }
                  } catch (err: unknown) {
                    setAvatarMsg('图片处理失败: ' + ((err as Error).message || ''));
                  }
                  setAvatarUploading(false);
                }}
                className="hidden"
              />
            </label>
            {avatarMsg && (
              <p className="text-xs mt-1 m-0" style={{ color: avatarMsg.includes('失败') ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {avatarMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Username */}
      <div className="rounded-lg p-5 mb-4" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
        <h2 className="flex items-center gap-2 text-base font-bold mb-4">
          <User size={18} /> 修改用户名
        </h2>
        <form onSubmit={handleSaveUsername} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <div className="relative">
              <input value={username} onChange={e => { setUsername(e.target.value); setUsernameMsg(''); }} style={inputStyle} />
              {usernameChecking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-muted)' }}>检查中...</span>
              )}
              {!usernameChecking && usernameAvailable === false && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-danger)' }}>已被占用</span>
              )}
              {!usernameChecking && usernameAvailable === true && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-success)' }}>可用</span>
              )}
            </div>
            <p className="text-xs mt-1 mb-0" style={{ color: 'var(--color-text-muted)' }}>
              这是帖子中显示的名字，至少 2 个字，支持中文、字母和数字
            </p>
          </div>
          {usernameMsg && (
            <p className="text-xs m-0" style={{ color: usernameMsg.includes('失败') || usernameMsg.includes('占用') ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {usernameMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={usernameSaving}
            className="self-start px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {usernameSaving ? '保存中...' : '保存'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
        <h2 className="flex items-center gap-2 text-base font-bold mb-4">
          <Lock size={18} /> 修改密码
        </h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">当前密码</label>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">新密码</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputStyle} />
          </div>
          {pwMsg && (
            <p className="text-xs m-0" style={{ color: pwMsg.includes('失败') || pwMsg.includes('错误') ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {pwMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={pwSaving}
            className="self-start px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {pwSaving ? '更新中...' : '修改密码'}
          </button>
        </form>
      </div>
    </div>
  );
}
