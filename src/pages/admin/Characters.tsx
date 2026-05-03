import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { adminGetAllCharacters } from '../../lib/api';
import AdminGuard from '../../components/layout/AdminGuard';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import type { AICharacter } from '../../lib/types';

export default function AdminCharacters() {
  const [characters, setCharacters] = useState<AICharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminGetAllCharacters().then(setCharacters).finally(() => setIsLoading(false));
  }, []);

  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <h1 className="text-xl font-bold mb-2">AI 角色管理</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          共 {characters.length} 个角色
        </p>

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {characters.map((c) => {
              return (
                <div
                  key={c.id}
                  className="rounded-lg p-4 flex items-center gap-4"
                  style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}
                >
                  <Avatar name={(c as any).username || ''} url={(c as any).avatar_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {(c as any).username}
                      </span>
                      <Badge type="verified" />
                      {c.is_active ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8F5E9', color: 'var(--color-success)' }}>启用</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FFEBEE', color: 'var(--color-danger)' }}>禁用</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {c.era} · 每日上限 {c.daily_reply_limit} · {c.model_provider}/{c.model_name}
                    </div>
                  </div>
                  <Link
                    to={`/admin/characters/${c.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white no-underline transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Pencil size={12} /> 编辑
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
