import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, LogIn, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GuestNameDialogProps {
  onConfirm: (username: string) => void;
  onClose: () => void;
}

export default function GuestNameDialog({ onConfirm, onClose }: GuestNameDialogProps) {
  const [name, setName] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length >= 2) {
      onConfirm(name.trim());
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-xl p-6"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold m-0" style={{ color: 'var(--color-text-primary)' }}>
            游客发帖
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--color-page-bg)] transition-colors cursor-pointer border-none bg-transparent"
          >
            <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          可以不登陆就发贴，但是请先设置一个昵称，这是显示在帖子中的作者名（2-20个字符）。
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="你的显示名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            />
          </div>
          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)')}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
          >
            确认
          </button>
        </form>

        <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
            或者使用完整账号功能
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { onClose(); navigate('/login'); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <LogIn size={16} /> 登录
            </button>
            <button
              onClick={() => { onClose(); navigate('/login?tab=register'); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <UserPlus size={16} /> 注册
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
