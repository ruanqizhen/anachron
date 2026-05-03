import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }
    if (isRegister && !username.trim()) {
      setError('请填写用户名');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }

    setIsSubmitting(true);
    const result = isRegister
      ? await register(email.trim(), password, username.trim())
      : await login(email.trim(), password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    }
    // On success, auth state listener will redirect via NavBar or page refresh
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
            <span className="text-3xl">⏳</span>
            <h1 className="text-2xl font-bold mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }}>
              回音堂
            </h1>
          </Link>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            历史人物 AI 论坛 · 跨时空奇葩说
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border outline-none transition-colors"
                style={{
                  borderColor: error && !username.trim() ? 'var(--color-danger)' : 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>
          )}
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
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)')}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
          >
            {isSubmitting ? '处理中...' : isRegister ? '注册' : '登录'}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="text-center mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="font-medium cursor-pointer bg-transparent border-none ml-1"
            style={{ color: 'var(--color-primary)' }}
          >
            {isRegister ? '去登录' : '注册'}
          </button>
        </div>

        <div
          className="mt-6 pt-4 text-center text-xs"
          style={{
            borderTop: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          无需注册也可以游客身份发帖和评论
        </div>
      </div>
    </div>
  );
}
