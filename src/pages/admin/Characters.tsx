import { useState, useEffect } from 'react';
import { adminGetAllCharacters, adminCreateCharacter, adminDeleteCharacter } from '../../lib/api';
import Badge from '../../components/ui/Badge';
import AdminListLayout from '../../components/admin/AdminListLayout';
import AdminListItem from '../../components/admin/AdminListItem';
import type { AICharacter } from '../../lib/types';

interface AdminCharacterRow extends AICharacter {
  username?: string;
  avatar_url?: string | null;
}

export default function AdminCharacters() {
  const [characters, setCharacters] = useState<AdminCharacterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newChar, setNewChar] = useState({ username: '', era: '', birth_year: '', death_year: '', tags: '', personality: '', comedy: '', style: '' });
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');

  async function load() {
    setIsLoading(true);
    try {
      const data = await adminGetAllCharacters();
      setCharacters(data);
    } catch (err: unknown) {
      setMsg('加载失败: ' + (err instanceof Error ? err.message : String(err)));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    let active = true;
    adminGetAllCharacters()
      .then(data => {
        if (active) {
          setCharacters(data);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setMsg('加载失败: ' + (err instanceof Error ? err.message : String(err)));
          setIsLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  const filtered = characters.filter(c => c.username?.toLowerCase().includes(filter.toLowerCase()));

  const FIELD_STYLE: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    outline: 'none', fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-page-bg)',
    width: '100%'
  };

  return (
    <AdminListLayout
      title="AI 角色管理"
      count={filtered.length}
      countLabel="个角色"
      isLoading={isLoading}
      filter={filter}
      onFilterChange={setFilter}
      onCreateClick={() => setShowCreate(!showCreate)}
      createButtonLabel="新建角色"
      error={msg}
      createForm={showCreate && (
        <div className="rounded-xl p-4 mb-6 flex flex-col gap-4 shadow-lg animate-in fade-in zoom-in duration-200" style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-primary)' }}>
          <div className="flex items-center justify-between">
            <span className="font-bold">新建 AI 角色</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="用户名" value={newChar.username} onChange={e => setNewChar({...newChar, username: e.target.value})} style={FIELD_STYLE} />
            <input placeholder="时代" value={newChar.era} onChange={e => setNewChar({...newChar, era: e.target.value})} style={FIELD_STYLE} />
            <input placeholder="标签 (逗号分隔)" value={newChar.tags} onChange={e => setNewChar({...newChar, tags: e.target.value})} style={FIELD_STYLE} />
            <input placeholder="生年" value={newChar.birth_year} onChange={e => setNewChar({...newChar, birth_year: e.target.value})} style={FIELD_STYLE} />
            <input placeholder="卒年" value={newChar.death_year} onChange={e => setNewChar({...newChar, death_year: e.target.value})} style={FIELD_STYLE} />
          </div>
          <textarea placeholder="人格提示词" value={newChar.personality} onChange={e => setNewChar({...newChar, personality: e.target.value})} rows={2} style={FIELD_STYLE} />
          <textarea placeholder="喜剧方向" value={newChar.comedy} onChange={e => setNewChar({...newChar, comedy: e.target.value})} rows={2} style={FIELD_STYLE} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-muted)' }}>取消</button>
            <button onClick={async () => {
              if (!newChar.username.trim()) { setMsg('请输入用户名'); return; }
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
                load();
              } catch (err: unknown) { setMsg('添加失败: ' + (err instanceof Error ? err.message : String(err))); }
            }} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-[var(--color-primary)] border-none cursor-pointer">创建角色</button>
          </div>
        </div>
      )}
    >
      {filtered.map(c => {
        const username = c.username || '';
        return (
          <AdminListItem
            key={c.id}
            avatarName={username}
            avatarUrl={c.avatar_url || undefined}
            title={
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{username}</span>
                <Badge type="verified" />
                {c.is_active ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>启用</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>禁用</span>
                )}
              </div>
            }
            subtitle={
              <div className="flex flex-col gap-0.5 opacity-60">
                <span>{c.era}</span>
              </div>
            }
            editLink={`/admin/characters/${c.id}`}
            onDelete={async () => {
              if (!confirm(`确定删除角色「${username}」？`)) return;
              try {
                await adminDeleteCharacter(c.id);
                load();
              } catch (err: unknown) { setMsg('删除失败: ' + (err instanceof Error ? err.message : String(err))); }
            }}
          />
        );
      })}
    </AdminListLayout>
  );
}

