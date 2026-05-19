import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../lib/admin';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }

  if (!user || !isAdmin(profile)) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8 text-center py-20">
        <h1 className="text-2xl font-bold mb-2">无权限访问</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          此页面仅限管理员访问
        </p>
        <Link to="/" style={{ color: 'var(--color-primary)' }}>返回首页</Link>
      </div>
    );
  }

  return <>{children}</>;
}
