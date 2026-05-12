import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, UserCheck, PlusCircle, Trash2 } from 'lucide-react';
import { adminGetAllCharacters, adminCreateCharacter, adminDeleteCharacter } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import AdminGuard from '../../components/layout/AdminGuard';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import type { AICharacter } from '../../lib/types';

export default function AdminCharacters() {
  const { startImpersonation } = useAuth();
  const [characters, setCharacters] = useState<AICharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newChar, setNewChar] = useState({ username: '', era: '', birth_year: '', death_year: '', tags: '', personality: '', comedy: '', style: '' });
  const [createMsg, setCreateMsg] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    adminGetAllCharacters().then(setCharacters).finally(() => setIsLoading(false));
  }, []);

  const filtered = filter.trim()
    ? characters.filter(c => (c as any).username?.toLowerCase().includes(filter.toLowerCase()))
    : characters;

  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">AI 角色管理</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <PlusCircle size={14} /> 新建角色
          </button>
        </div>
        <input
          type="text"
          placeholder="搜索角色名..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full px-3 py-2 mb-4 rounded-lg border outline-none text-sm bg-transparent"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        />
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          共 {filtered.length} 个角色
        </p>

        {showCreate && (
          <div className="rounded-lg p-4 mb-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
            <h3 className="text-sm font-bold m-0">新建 AI 角色</h3>
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="用户名" value={newChar.username} onChange={e => setNewChar({...newChar, username: e.target.value})} className="px-2 py-1.5 rounded text-xs border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              <input placeholder="时代" value={newChar.era} onChange={e => setNewChar({...newChar, era: e.target.value})} className="px-2 py-1.5 rounded text-xs border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              <input placeholder="标签 (逗号分隔)" value={newChar.tags} onChange={e => setNewChar({...newChar, tags: e.target.value})} className="px-2 py-1.5 rounded text-xs border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              <input placeholder="生年" value={newChar.birth_year} onChange={e => setNewChar({...newChar, birth_year: e.target.value})} className="px-2 py-1.5 rounded text-xs border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              <input placeholder="卒年" value={newChar.death_year} onChange={e => setNewChar({...newChar, death_year: e.target.value})} className="px-2 py-1.5 rounded text-xs border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <textarea placeholder="人格提示词" value={newChar.personality} onChange={e => setNewChar({...newChar, personality: e.target.value})} rows={2} className="px-2 py-1.5 rounded text-xs border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            <textarea placeholder="喜剧方向" value={newChar.comedy} onChange={e => setNewChar({...newChar, comedy: e.target.value})} rows={2} className="px-2 py-1.5 rounded text-xs border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            <div className="flex items-center gap-3">
              <button onClick={async () => {
                setCreateMsg('');
                try {
                  await adminCreateCharacter({
                    username: newChar.username, era: newChar.era,
                    birth_year: parseInt(newChar.birth_year) || null,
                    death_year: parseInt(newChar.death_year) || null,
                    tags: newChar.tags.split(',').map(s => s.trim()).filter(Boolean),
                    personality: newChar.personality, comedy: newChar.comedy, style: newChar.style || '文言白话',
                  });
                  setShowCreate(false);
                  setNewChar({ username: '', era: '', birth_year: '', death_year: '', tags: '', personality: '', comedy: '', style: '' });
                  const list = await adminGetAllCharacters(); setCharacters(list);
                } catch (err: unknown) { setCreateMsg((err as Error).message); }
              }} className="px-4 py-1.5 rounded text-xs font-medium text-white bg-[var(--color-primary)] border-none cursor-pointer">创建</button>
              {createMsg && <span className="text-xs" style={{ color: 'var(--color-danger)' }}>{createMsg}</span>}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((c) => {
              return (
                <div
                  key={c.id}
                  className="rounded-lg p-4 flex items-center gap-4"
                  style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}
                >
                  <Avatar name={(c as unknown as { username?: string }).username || ''} url={(c as unknown as { avatar_url?: string }).avatar_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {(c as unknown as { username?: string }).username}
                      </span>
                      <Badge type="verified" />
                      {c.is_active ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8F5E9', color: 'var(--color-success)' }}>启用</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FFEBEE', color: 'var(--color-danger)' }}>禁用</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {c.era}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => startImpersonation({
                        profileId: c.id,
                        username: (c as unknown as { username?: string }).username || '',
                        avatarUrl: (c as unknown as { avatar_url?: string }).avatar_url || null,
                      })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-colors"
                      style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
                    >
                      <UserCheck size={12} /> 以此身份发言
                    </button>
                    <Link
                      to={`/admin/characters/${c.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white no-underline transition-colors"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Pencil size={12} /> 编辑
                    </Link>
                    <button
                      onClick={async () => {
                        const name = (c as unknown as { username?: string }).username || '';
                        if (!confirm(`确定删除角色「${name}」？`)) return;
                        try {
                          await adminDeleteCharacter(c.id);
                          const list = await adminGetAllCharacters();
                          setCharacters(list);
                        } catch (err: unknown) {
                          alert('删除失败: ' + ((err as Error).message || '未知错误'));
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-colors"
                      style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                    >
                      <Trash2 size={12} /> 删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
