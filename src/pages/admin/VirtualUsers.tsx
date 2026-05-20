import { useState, useEffect } from 'react';
import { adminGetVirtualUsers, adminUpdateUser, adminDeleteUser, adminCreateVirtualUser } from '../../lib/api';
import AvatarUpload from '../../components/ui/AvatarUpload';
import AdminListLayout from '../../components/admin/AdminListLayout';
import AdminListItem from '../../components/admin/AdminListItem';

interface AdminUser {
  id: string;
  username: string;
  avatar_url: string;
  bio: string | null;
  created_at: string;
}

export default function AdminVirtualUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [filter, setFilter] = useState('');

  async function load() {
    setIsLoading(true);
    try {
      const data = await adminGetVirtualUsers();
      setUsers(data);
    } catch (err: unknown) {
      setMsg('加载失败: ' + (err instanceof Error ? err.message : String(err)));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    let active = true;
    adminGetVirtualUsers()
      .then(data => {
        if (active) {
          setUsers(data);
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

  async function handleSave(id: string) {
    setMsg('');
    try {
      await adminUpdateUser(id, editName.trim(), editBio.trim(), editAvatar.trim());
      setEditing(null);
      load();
    } catch (err: unknown) { setMsg('操作失败: ' + (err instanceof Error ? err.message : String(err))); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`确定删除虚拟用户「${name}」？`)) return;
    try {
      await adminDeleteUser(id);
      load();
    } catch (err: unknown) { setMsg('删除失败: ' + (err instanceof Error ? err.message : String(err))); }
  }

  const FIELD_STYLE: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    outline: 'none', fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-page-bg)',
    width: '100%'
  };

  const filtered = users.filter(u => u.username.toLowerCase().includes(filter.toLowerCase()));

  return (
    <AdminListLayout
      title="虚拟用户管理"
      count={filtered.length}
      countLabel="个虚拟用户"
      isLoading={isLoading}
      filter={filter}
      onFilterChange={setFilter}
      onCreateClick={() => setShowCreate(!showCreate)}
      createButtonLabel="新建虚拟用户"
      error={msg}
      createForm={showCreate && (
        <div className="rounded-xl p-4 mb-6 flex flex-col gap-4 shadow-lg animate-in fade-in zoom-in duration-200" style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-primary)' }}>
          <div className="flex items-center justify-between">
            <span className="font-bold">新建虚拟用户</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="用户名" value={newName} onChange={e => setNewName(e.target.value)} style={FIELD_STYLE} />
            <input placeholder="头像 URL (可选)" value={newAvatar} onChange={e => setNewAvatar(e.target.value)} style={FIELD_STYLE} />
          </div>
          <textarea placeholder="简介 (可选)" value={newBio} onChange={e => setNewBio(e.target.value)} rows={2} style={FIELD_STYLE} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-muted)' }}>取消</button>
            <button onClick={async () => {
              if (!newName.trim()) { setMsg('请输入用户名'); return; }
              try { 
                await adminCreateVirtualUser(newName.trim(), newBio.trim(), newAvatar.trim()); 
                setNewName(''); setNewBio(''); setNewAvatar(''); setShowCreate(false); load(); 
              } catch (err: unknown) { setMsg('操作失败: ' + (err instanceof Error ? err.message : String(err))); }
            }} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-[var(--color-primary)] border-none cursor-pointer">创建用户</button>
          </div>
        </div>
      )}
    >
      {filtered.map(u => (
        <AdminListItem
          key={u.id}
          avatarName={u.username}
          avatarUrl={u.avatar_url}
          title={<span className="text-sm font-bold">{u.username}</span>}
          subtitle={
            <div className="flex flex-col gap-1">
              <span className="opacity-60">{new Date(u.created_at).toLocaleDateString('zh-CN')} 加入</span>
              {u.bio && <p className="m-0 line-clamp-1">{u.bio}</p>}
            </div>
          }
          isEditing={editing === u.id}
          onEdit={() => { setEditing(u.id); setEditName(u.username); setEditBio(u.bio || ''); setEditAvatar(u.avatar_url || ''); }}
          onDelete={() => handleDelete(u.id, u.username)}
          editForm={
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">编辑用户: {u.username}</span>
              </div>
              <AvatarUpload
                currentUrl={u.avatar_url}
                name={u.username}
                userId={u.id}
                adminMode
                onUrlChange={setEditAvatar}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase opacity-50 ml-1">用户名</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={FIELD_STYLE} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase opacity-50 ml-1">简介</label>
                  <input value={editBio} onChange={e => setEditBio(e.target.value)} style={FIELD_STYLE} />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-muted)' }}>取消</button>
                <button onClick={() => handleSave(u.id)} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-[var(--color-success)] border-none cursor-pointer">保存修改</button>
              </div>
            </div>
          }
        />
      ))}
    </AdminListLayout>
  );
}

