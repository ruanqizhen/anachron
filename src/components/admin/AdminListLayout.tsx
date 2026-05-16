import { Search, PlusCircle } from 'lucide-react';
import AdminGuard from '../layout/AdminGuard';

interface AdminListLayoutProps {
  title: string;
  count: number;
  countLabel: string;
  isLoading: boolean;
  filter: string;
  onFilterChange: (val: string) => void;
  onCreateClick?: () => void;
  createButtonLabel?: string;
  error?: string;
  children: React.ReactNode;
  createForm?: React.ReactNode;
}

export default function AdminListLayout({
  title,
  count,
  countLabel,
  isLoading,
  filter,
  onFilterChange,
  onCreateClick,
  createButtonLabel,
  error,
  children,
  createForm
}: AdminListLayoutProps) {
  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">{title}</h1>
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none transition-transform active:scale-95 hover:brightness-110"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <PlusCircle size={14} /> {createButtonLabel || '新建'}
            </button>
          )}
        </div>

        <div className="relative mb-4">
          <Search 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2" 
            style={{ color: 'var(--color-text-muted)' }} 
          />
          <input
            type="text"
            placeholder="搜索..."
            value={filter}
            onChange={e => onFilterChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border outline-none text-sm bg-transparent transition-all"
            style={{ 
              borderColor: 'var(--color-border)', 
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-card-bg)'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
          />
        </div>

        <p className="text-sm mb-6 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
          共 {count} {countLabel}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
            {error}
          </div>
        )}

        {createForm}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>正在加载数据...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {children}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
