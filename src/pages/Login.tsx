import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

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
  const [showReset, setShowReset] = useState(false);
  const redirect = searchParams.get('redirect') || '/';

  // Redirect after login
  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [user, navigate, redirect]);

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
    if ((isRegister || showReset) && password !== password2) {
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
        setMsg('注册成功！请查收来自 Supabase Auth 的邮件，点击其中的 "Confirm your mail" 链接完成验证。');
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
            {isRegister ? '创建账号，加入跨时空讨论' : '历史人物 AI 论坛 · 跨时空奇葩说'}
          </p>
        </div>

        {isRegister && msg ? (
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
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
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
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>
            {(isRegister || showReset) && (
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="password"
                  placeholder="确认密码"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                />
              </div>
            )}

            {error && (
              <div
                className="text-sm px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#FDEDED', color: 'var(--color-danger)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white cursor-pointer border-none transition-colors disabled:opacity-60"
              style={{
                backgroundColor: isRegister ? 'var(--color-success)' : 'var(--color-primary)',
              }}
              onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = isRegister ? '#36A420' : 'var(--color-primary-hover)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isRegister ? 'var(--color-success)' : 'var(--color-primary)'}
            >
              {isSubmitting ? '处理中...' : isRegister ? '注册' : '登录'}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
            {!isRegister && (
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-xs font-medium cursor-pointer bg-transparent border-none self-end"
                style={{ color: 'var(--color-text-muted)' }}
              >
                忘记密码？
              </button>
            )}
          </form>
        )}

        {/* Password Reset Form */}
        {showReset && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setError(''); setMsg('');
            if (!email.trim()) { setError('请输入邮箱'); return; }
            const { error: resetErr } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${window.location.origin}/login`,
            });
            setIsSubmitting(false);
            if (resetErr) { 
              const m = resetErr.message;
              if (m.includes('rate limit')) setError('请求过于频繁，请稍后再试');
              else if (m.includes('not found')) setError('未找到该用户');
              else setError('重置请求失败: ' + m);
            }
            else { setResetSent(true); setShowReset(false); setError(''); }
          }} className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              输入注册邮箱，我们将发送密码重置链接
            </p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="email" placeholder="邮箱地址" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <button type="submit" disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white cursor-pointer border-none disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-primary)' }}>
              {isSubmitting ? '发送中...' : '发送重置链接'}
            </button>
            <button type="button" onClick={() => { setShowReset(false); setError(''); }}
              className="text-xs cursor-pointer bg-transparent border-none" style={{ color: 'var(--color-text-muted)' }}>
              返回登录
            </button>
          </form>
        )}

        {/* Reset success message */}
        {resetSent && !showReset && (
          <div className="text-center">
            <div className="text-sm px-4 py-3 rounded-lg mb-3" style={{ backgroundColor: '#E8F5E9', color: 'var(--color-success)' }}>
              重置链接已发送，请检查邮箱
            </div>
            <button onClick={() => setResetSent(false)} className="text-xs cursor-pointer bg-transparent border-none" style={{ color: 'var(--color-text-muted)' }}>
              返回
            </button>
          </div>
        )}

        {!msg && !showReset && !resetSent && (
          <div className="text-center mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {isRegister ? '已有账号？' : '还没有账号？'}
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); setMsg(''); }}
              className="font-medium cursor-pointer bg-transparent border-none ml-1"
              style={{ color: 'var(--color-primary)' }}
            >
              {isRegister ? '去登录' : '注册'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
