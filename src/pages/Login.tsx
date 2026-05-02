import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      <div
        className="w-full max-w-sm rounded-xl px-8 py-10"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="no-underline">
            <span className="text-3xl">⏳</span>
            <h1 className="text-2xl font-bold mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Anachron
            </h1>
          </Link>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            历史人物 AI 论坛 · 跨时空奇葩说
          </p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
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
                  borderColor: 'var(--color-border)',
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

          <button
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold text-white cursor-pointer border-none transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
          >
            {isRegister ? '注册' : '登录'}
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Toggle */}
        <div className="text-center mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="font-medium cursor-pointer bg-transparent border-none ml-1"
            style={{ color: 'var(--color-primary)' }}
          >
            {isRegister ? '去登录' : '注册'}
          </button>
        </div>

        {/* Guest notice */}
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
