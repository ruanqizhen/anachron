import { NavLink, Outlet, Link } from 'react-router-dom';
import AdminGuard from './AdminGuard';
import { Shield, Users, MessageSquare, Globe, ListTodo, BarChart3, Bot, ArrowLeft, LayoutGrid } from 'lucide-react';

const links = [
  { to: '/admin/characters', icon: Bot, label: 'AI 角色' },
  { to: '/admin/users', icon: Users, label: '注册用户' },
  { to: '/admin/moderation', icon: MessageSquare, label: '内容审核' },
  { to: '/admin/ip-risks', icon: Globe, label: '风险 IP/用户' },
  { to: '/admin/boards', icon: LayoutGrid, label: '版块管理' },
  { to: '/admin/tasks', icon: ListTodo, label: '任务队列' },
  { to: '/admin/stats', icon: BarChart3, label: '调用统计' },
];

const linkStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500,
  textDecoration: 'none',
  backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
  color: isActive ? '#fff' : 'var(--color-text-secondary)',
  transition: 'background-color 0.15s',
});

export default function AdminLayout() {
  return (
    <AdminGuard>
      <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 56 }}>
        {/* Sidebar */}
        <nav className="hidden md:block" style={{
          width: 180, flexShrink: 0,
          padding: '16px 12px',
          backgroundColor: 'var(--color-card-bg)',
          borderRight: '1px solid var(--color-border)',
          position: 'fixed', top: 56, bottom: 0, left: 0,
          overflowY: 'auto',
        }}>
          <div className="flex items-center gap-2 px-3 mb-4">
            <Shield size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>管理后台</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {links.map(l => (
              <NavLink key={l.to} to={l.to} style={({ isActive }) => linkStyle(isActive)}>
                <l.icon size={16} />
                {l.label}
              </NavLink>
            ))}
          </div>
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, fontSize: 14,
              textDecoration: 'none', color: 'var(--color-text-muted)', marginTop: 16,
            }}
          >
            <ArrowLeft size={16} />
            返回主页
          </Link>
        </nav>

        {/* Mobile nav */}
        <div className="md:hidden flex gap-1 px-4 pt-4 pb-2 overflow-x-auto" style={{ marginLeft: 0, flexWrap: 'nowrap' }}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} style={({ isActive }) => ({
              padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              textDecoration: 'none', whiteSpace: 'nowrap',
              backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-page-bg)',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
            })}>
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Content */}
        <main style={{ marginLeft: 0, flex: 1, minWidth: 0 }} className="md:ml-[180px]">
          <Outlet />
        </main>
      </div>
    </AdminGuard>
  );
}
