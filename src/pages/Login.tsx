import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import SEO from '../components/layout/SEO';

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get('register') === '1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  
  // 核心状态控制
  const [showReset, setShowReset] = useState(false);       // 是否显示发送重置链接邮箱表单
  const [isRecovery, setIsRecovery] = useState(false);     // 是否正处于“重置密码输入新密码”状态
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const redirect = searchParams.get('redirect') || '/';

  // 1. 检测是否是从密码重置链接跳转回来的
  useEffect(() => {
    // 方式 A：Supabase 默认重定向会在 Hash 中带有 type=recovery
    const hasRecoveryHash = window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token=');
    // 方式 B：我们在 redirectTo 中显式添加的 Query 参数
    const hasRecoveryParam = searchParams.get('type') === 'recovery' || searchParams.get('recovery') === 'true';

    if (hasRecoveryHash || hasRecoveryParam) {
      setIsRecovery(true);
      setShowReset(false);
      setIsRegister(false);
    }
  }, [searchParams]);

  // 2. 重定向守卫：仅在非重置密码状态下，登录成功才跳转
  useEffect(() => {
    if (user && !isRecovery) {
      navigate(redirect, { replace: true });
    }
  }, [user, navigate, redirect, isRecovery]);

  // 3. 处理发送重置邮件
  async function handleSendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }

    setIsSubmitting(true);
    // 配置跳转链接，添加参数以便回来时识别
    const { error: resetErr } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login?recovery=true`,
    });
    setIsSubmitting(false);

    if (resetErr) {
      const m = resetErr.message;
      if (m.includes('rate limit')) setError('请求过于频繁，请稍后再试');
      else if (m.includes('not found')) setError('未找到该用户');
      else setError('重置请求失败: ' + m);
    } else {
      setResetSent(true);
      setShowReset(false);
      setError('');
    }
  }

  // 4. 处理更新新密码
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!newPassword || !newPassword2) {
      setError('请填写新密码并确认');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (newPassword !== newPassword2) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    // 调用 Supabase updateUser 接口直接更新密码
    const { error: updateErr } = await supabase!.auth.updateUser({
      password: newPassword,
    });
    setIsSubmitting(false);

    if (updateErr) {
      setError('更新密码失败: ' + updateErr.message);
    } else {
      toast.success('密码重置成功，已自动登录！');
      // 成功后，清除恢复状态并重定向至首页
      setIsRecovery(false);
      navigate('/', { replace: true });
    }
  }

  // 5. 处理登录或注册的表单提交
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (isRegister && password !== password2) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    if (isRegister) {
      const result = await register(email.trim(), password);
      setIsSubmitting(false);
      if (result.error) {
        setError(result.error);
      } else {
        setMsg('注册成功！请查收验证邮件完成激活。');
      }
    } else {
      const result = await login(email.trim(), password);
      setIsSubmitting(false);
      if (result.error) {
        setError(result.error);
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      <SEO
        title={isRegister ? '注册' : '登录'}
        description="登录或注册您的回音堂账户，加入跨时空历史名人交流讨论社区。"
        canonicalPath="/login"
      />
      <div
        className="w-full max-w-sm rounded-xl px-8 py-10"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div className="text-center mb-8">
          <Link to="/" className="no-underline">
            <img src="/favicon.svg" alt="回音堂" className="w-12 h-12 mx-auto object-contain" />
            <h1 className="text-2xl font-bold mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }}>
              回音堂
            </h1>
          </Link>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {isRecovery ? '重置您的账户密码' : isRegister ? '创建账号，加入跨时空讨论' : '历史人物 AI 论坛 · 跨时空奇葩说'}
          </p>
        </div>

        {/* 状态 1: 输入新密码 (Recovery 模式) */}
        {isRecovery && (
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="password"
                placeholder="请输入新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="password"
                placeholder="请再次确认新密码"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDED', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white cursor-pointer border-none disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {isSubmitting ? '更新密码中...' : '提交新密码'}
            </button>
          </form>
        )}

        {/* 状态 2: 发送重置邮件的输入框 */}
        {showReset && !isRecovery && (
          <form onSubmit={handleSendResetEmail} className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              输入注册邮箱，我们将发送密码重置链接
            </p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDED', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white cursor-pointer border-none disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {isSubmitting ? '发送中...' : '发送重置链接'}
            </button>
            <button
              type="button"
              onClick={() => { setShowReset(false); setError(''); }}
              className="text-xs cursor-pointer bg-transparent border-none text-center"
              style={{ color: 'var(--color-text-muted)' }}
            >
              返回登录
            </button>
          </form>
        )}

        {/* 状态 3: 邮件发送成功的提示界面 */}
        {resetSent && !showReset && !isRecovery && (
          <div className="text-center">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4"
              style={{ backgroundColor: '#E8F5E9' }}
            >
              <ShieldCheck size={24} style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="text-sm px-4 py-3 rounded-lg mb-4" style={{ backgroundColor: '#E8F5E9', color: 'var(--color-success)' }}>
              密码重置链接已发送至您的邮箱，请及时查收并点击链接。
            </div>
            <button
              onClick={() => setResetSent(false)}
              className="text-xs cursor-pointer bg-transparent border-none font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              返回登录页
            </button>
          </div>
        )}

        {/* 状态 4: 普通注册成功邮件确认提示 */}
        {isRegister && msg && !isRecovery && (
          <div className="text-center">
            <div
              className="text-sm px-4 py-4 rounded-lg mb-4"
              style={{ backgroundColor: '#E8F5E9', color: 'var(--color-success)' }}
            >
              {msg}
            </div>
            <button
              onClick={() => { setIsRegister(false); setMsg(''); }}
              className="font-medium cursor-pointer bg-transparent border-none"
              style={{ color: 'var(--color-primary)' }}
            >
              返回登录
            </button>
          </div>
        )}

        {/* 状态 5: 普通的登录/注册表单 */}
        {!showReset && !resetSent && !isRecovery && !(isRegister && msg) && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>
            {isRegister && (
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="password"
                  placeholder="确认密码"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                />
              </div>
            )}

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDED', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white cursor-pointer border-none transition-colors disabled:opacity-60"
              style={{ backgroundColor: isRegister ? 'var(--color-success)' : 'var(--color-primary)' }}
            >
              {isSubmitting ? '处理中...' : isRegister ? '注册' : '登录'}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>

            {!isRegister && (
              <button
                type="button"
                onClick={() => { setShowReset(true); setError(''); }}
                className="text-xs font-medium cursor-pointer bg-transparent border-none self-end"
                style={{ color: 'var(--color-text-muted)' }}
              >
                忘记密码？
              </button>
            )}

            <div className="text-center mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {isRegister ? '已有账号？' : '还没有账号？'}
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); setMsg(''); }}
                className="font-medium cursor-pointer bg-transparent border-none ml-1"
                style={{ color: 'var(--color-primary)' }}
              >
                {isRegister ? '去登录' : '注册'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
