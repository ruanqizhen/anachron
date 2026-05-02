import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, X, LogIn } from 'lucide-react';
import Avatar from '../ui/Avatar';

export default function NavBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // TODO: Replace with real auth state
  const currentUser = null as null | { username: string; display_name: string; avatar_url: string | null };

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
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
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 no-underline">
          <span className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
            ⏳
          </span>
          <span className="text-lg font-bold hidden sm:block" style={{ color: 'var(--color-text-primary)' }}>
            Anachron
          </span>
        </Link>

        {/* Search */}
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

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUser ? (
            <>
              <button
                className="relative p-2 rounded-full hover:bg-[var(--color-page-bg)] transition-colors"
                aria-label="通知"
              >
                <Bell size={20} style={{ color: 'var(--color-text-secondary)' }} />
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                />
              </button>
              <Avatar name={currentUser.display_name} url={currentUser.avatar_url} size={32} />
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white no-underline transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">登录</span>
            </Link>
          )}

          {/* Mobile menu toggle */}
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

      {/* Mobile search - slides down */}
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
  );
}
