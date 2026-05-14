import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Lock, FileText, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import AvatarUpload from '../components/ui/AvatarUpload';

export default function Settings() {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [bioMsg, setBioMsg] = useState('');
  const [bioSaving, setBioSaving] = useState(false);

  // Debounced username availability check — must be before any early return (Hooks rules)
  useEffect(() => {
    if (!user) return;
    const name = username.trim();
    
    if (!name || name === (profile?.username || '') || name.length < 2) { 
      const t = setTimeout(() => {
        setUsernameAvailable(null);
        setUsernameChecking(false);
      }, 0);
      return () => clearTimeout(t);
    }
    
    const checkTimer = setTimeout(() => setUsernameChecking(true), 0);
    const timer = setTimeout(async () => {
      const { data } = await supabase!
        .from('profiles')
        .select('id')
        .eq('username', name)
        .maybeSingle();
      setUsernameAvailable(!data);
      setUsernameChecking(false);
    }, 500);
    return () => { clearTimeout(timer); clearTimeout(checkTimer); };
  }, [username, profile?.username, user]);

  if (!user) {
    return (
      <div className="max-w-[600px] mx-auto px-4 pt-[72px] pb-8 text-center py-20">
        <p style={{ color: 'var(--color-text-secondary)' }}>请先登录</p>
        <Link to="/login" style={{ color: 'var(--color-primary)' }}>去登录</Link>
      </div>
    );
  }

  const uid = user.id;
  const userEmail = user.email;

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault();
    setUsernameMsg('');
    const name = username.trim();
    if (!name || name.length < 2) { setUsernameMsg('用户名至少 2 个字符'); return; }
    if (name.length > 20) { setUsernameMsg('用户名最多 20 个字符'); return; }
    if (!/^[\w一-鿿]+$/.test(name)) { setUsernameMsg('用户名只能包含中文、字母、数字和下划线'); return; }

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
    if (newPw !== newPw2) { setPwMsg('两次输入的密码不一致'); return; }

    setPwSaving(true);
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
      setNewPw2('');
    }
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
        <h2 className="text-base font-bold mb-4">头像</h2>
        <AvatarUpload
          currentUrl={profile?.avatar_url}
          name={profile?.username || userEmail}
          userId={uid}
        />
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

      {/* Bio */}
      <div className="rounded-lg p-5 mb-4" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
        <h2 className="flex items-center gap-2 text-base font-bold mb-4">
          <FileText size={18} /> 自我介绍
        </h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setBioMsg('');
          setBioSaving(true);
          const { error } = await supabase!.from('profiles').update({ bio: bio.trim() }).eq('id', uid);
          setBioSaving(false);
          if (error) setBioMsg('保存失败: ' + error.message);
          else setBioMsg('已更新');
        }} className="flex flex-col gap-3">
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>展示在个人主页，最多 300 字</p>
            <textarea rows={4} value={bio} onChange={e => setBio(e.target.value)} maxLength={300} style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
              outline: 'none', fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)',
              resize: 'none',
            }} />
          </div>
          {bioMsg && (
            <p className="text-xs m-0" style={{ color: bioMsg.includes('失败') ? 'var(--color-danger)' : 'var(--color-success)' }}>{bioMsg}</p>
          )}
          <button type="submit" disabled={bioSaving}
            className="self-start px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            {bioSaving ? '保存中...' : '保存'}
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
          <div>
            <label className="block text-sm font-medium mb-1">重复新密码</label>
            <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={inputStyle} />
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
