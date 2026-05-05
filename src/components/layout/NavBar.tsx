import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, X, LogIn, LogOut, User as UserIcon, Settings as SettingsIcon, Shield } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../lib/admin';

export default function NavBar() {
  const { user, profile, isLoading, logout, impersonating, stopImpersonation } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  }

  const displayName = profile?.username || user?.email?.split('@')[0] || '用户';

  return (
    <>
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        height: 56,
        backgroundColor: 'var(--color-card-bg)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="max-w-[1200px] mx-auto h-full flex items-center px-4 gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0 no-underline">
          <img src="/icons.svg" alt="回音堂" className="w-7 h-7 object-contain" />
          <span className="text-lg font-bold hidden sm:block" style={{ color: 'var(--color-text-primary)' }}>
            回音堂
          </span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-auto hidden sm:flex">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              placeholder="搜索帖子、用户..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-full text-sm outline-none transition-all"
              style={{
                backgroundColor: 'var(--color-page-bg)',
                border: '1px solid transparent',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
            />
          </div>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          {isLoading ? null : user ? (
            <>
              <Link
                to="/notifications"
                className="relative p-2 rounded-full hover:bg-[var(--color-page-bg)] transition-colors"
                aria-label="通知"
              >
                <Bell size={20} style={{ color: 'var(--color-text-secondary)' }} />
              </Link>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-0 border-none bg-transparent cursor-pointer"
                >
                  <Avatar name={displayName} url={profile?.avatar_url} size={32} />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div
                      className="absolute right-0 top-full mt-2 w-48 rounded-lg z-20 overflow-hidden"
                      style={{
                        backgroundColor: 'var(--color-card-bg)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {displayName}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {user.email}
                        </div>
                      </div>
                      <Link
                        to={profile ? `/u/${profile.username}` : '#'}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm no-underline hover:bg-[var(--color-page-bg)] transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <UserIcon size={14} />
                        我的主页
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm no-underline hover:bg-[var(--color-page-bg)] transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <SettingsIcon size={14} />
                        设置
                      </Link>
                      {isAdmin(user?.id) && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm no-underline hover:bg-[var(--color-page-bg)] transition-colors"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <Shield size={14} />
                          管理后台
                        </Link>
                      )}
                      <button
                        onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <LogOut size={14} />
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <Link
              to={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white no-underline transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">登录</span>
            </Link>
          )}

          <button
            className="p-2 rounded-full hover:bg-[var(--color-page-bg)] transition-colors sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="菜单"
          >
            {mobileMenuOpen ? (
              <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
            ) : (
              <Menu size={20} style={{ color: 'var(--color-text-secondary)' }} />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="sm:hidden px-4 py-3"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                type="text"
                placeholder="搜索帖子、用户..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-full text-sm outline-none"
                style={{ backgroundColor: 'var(--color-page-bg)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </form>
        </div>
      )}
    </header>

    {/* Impersonation banner */}
    {impersonating && (
      <div
        className="fixed top-14 left-0 right-0 z-40 flex items-center justify-center gap-3 px-4 py-2 text-sm"
        style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
      >
        🎭 正在以 <strong className="mx-1">{impersonating.username}</strong> 的身份发言
        <button
          onClick={stopImpersonation}
          className="px-3 py-0.5 rounded-full text-xs font-medium cursor-pointer border border-white/40 transition-colors hover:bg-white/20"
          style={{ backgroundColor: 'transparent', color: '#fff' }}
        >
          退出
        </button>
      </div>
    )}

    {/* Push content down when impersonation banner is active */}
    {impersonating && <div style={{ height: 40 }} />}
    </>
  );
}
