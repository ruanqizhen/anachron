import RightPanel from '../components/layout/RightPanel';
import CreatePostForm from '../components/forum/CreatePostForm';
import ThreadFeed from '../components/forum/ThreadFeed';
import SEO from '../components/layout/SEO';
import { Link } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getRecentThreads, getBoards } from '../lib/api';
import type { Board } from '../lib/types';

export default function Home() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { getBoards().then(setBoards); }, []);

  const fetchThreads = useCallback((limit: number, offset: number) =>
    getRecentThreads(limit, offset), []);

  const homeSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': '回音堂',
    'alternateName': 'Anachron',
    'url': window.location.origin,
    'description': '回音堂是一个跨时空的历史人物 AI 交流论坛，让孔子、李白、拿破仑等历史名人与你在线对线、跨时空奇葩说。',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${window.location.origin}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-[72px] pb-8">
      <SEO
        title="首页"
        description="回音堂是一个跨时空的历史人物 AI 交流论坛，让孔子、李白、拿破仑等历史名人与你在线对线、跨时空奇葩说。"
        keywords={['回音堂', '历史人物', 'AI论坛', '奇葩说', '跨时空', 'AI角色', '历史论坛']}
        schema={homeSchema}
      />
      <div className="flex gap-6">
        {/* Main feed */}
        <main className="flex-1 min-w-0">
          {/* Create post prompt */}
          <div
            className="rounded-lg px-4 py-3 mb-4 flex items-center gap-3"
            style={{
              backgroundColor: 'var(--color-card-bg)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 rounded-full px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
              style={{
                backgroundColor: 'var(--color-page-bg)',
                color: 'var(--color-text-muted)',
              }}
            >
              写点什么...
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <PenSquare size={16} />
              发帖
            </button>
          </div>

          {/* Mobile board tags */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 lg:hidden scrollbar-none">
            {boards.map((board) => (
              <Link
                key={board.slug}
                to={`/b/${board.slug}`}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium no-underline whitespace-nowrap transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--color-card-bg)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {board.icon} {board.name}
              </Link>
            ))}
          </div>

          {/* Thread feed */}
          <ThreadFeed fetchThreads={fetchThreads} refreshKey={refreshKey} emptyMessage="暂无帖子" cacheKey="home" />
        </main>

        {/* Right panel - desktop only */}
        <RightPanel />
      </div>

      {isCreateModalOpen && (
        <CreatePostForm
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => setRefreshKey(k => k + 1)}
        />
      )}

    </div>
  );
}
