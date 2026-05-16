import { useState, useEffect } from 'react';
import { Pencil, Trash2, UserCheck, PlusCircle } from 'lucide-react';
import { adminGetVirtualUsers, adminUpdateUser, adminDeleteUser, adminCreateVirtualUser } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import AdminGuard from '../../components/layout/AdminGuard';
import Avatar from '../../components/ui/Avatar';
import AvatarUpload from '../../components/ui/AvatarUpload';

interface AdminUser {
  id: string;
  username: string;
  avatar_url: string;
  bio: string | null;
  created_at: string;
}

export default function AdminVirtualUsers() {
  const { startImpersonation } = useAuth();
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

  useEffect(() => { setTimeout(() => load(), 0); }, []);

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
    padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)',
    outline: 'none', fontSize: 13, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)',
  };

  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">虚拟用户管理</h1>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none" style={{ backgroundColor: 'var(--color-primary)' }}>
            <PlusCircle size={14} /> 新建虚拟用户
          </button>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{users.length} 个虚拟用户</p>

        {showCreate && (
          <div className="rounded-lg p-4 mb-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>新建虚拟用户</span>
              {msg && <span className="text-xs" style={{ color: 'var(--color-danger)' }}>{msg}</span>}
            </div>
            <div className="flex gap-2">
              <input placeholder="用户名" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-sm border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              <input placeholder="头像 URL (可选)" value={newAvatar} onChange={e => setNewAvatar(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-sm border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div className="flex gap-2">
              <input placeholder="简介 (可选)" value={newBio} onChange={e => setNewBio(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-sm border outline-none bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              <button onClick={async () => {
                setMsg('');
                if (!newName.trim()) { setMsg('请输入用户名'); return; }
                try { 
                  await adminCreateVirtualUser(newName.trim(), newBio.trim(), newAvatar.trim()); 
                  setNewName(''); setNewBio(''); setNewAvatar(''); setShowCreate(false); load(); 
                }
                catch (err: unknown) { setMsg('操作失败: ' + (err instanceof Error ? err.message : String(err))); }
              }} className="px-6 py-1.5 rounded text-sm font-medium text-white bg-[var(--color-success)] border-none cursor-pointer shrink-0">创建</button>
            </div>
          </div>
        )}

        {msg && <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{msg}</p>}

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map(u => (
              <div key={u.id} className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
                <Avatar name={u.username} url={u.avatar_url} size={36} />
                <div className="flex-1 min-w-0">
                  {editing === u.id ? (
                    <div className="flex flex-col gap-3 p-1">
                      <AvatarUpload
                        currentUrl={u.avatar_url}
                        name={u.username}
                        userId={u.id}
                        adminMode
                        onUrlChange={setEditAvatar}
                      />
                      <div className="flex gap-2">
                        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="用户名" style={{ ...FIELD_STYLE, flex: 1 }} />
                        <input value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="简介" style={{ ...FIELD_STYLE, flex: 1 }} />
                        <button onClick={() => handleSave(u.id)} className="px-4 py-1.5 rounded text-xs font-medium text-white bg-[var(--color-success)] border-none cursor-pointer">保存</button>
                        <button onClick={() => setEditing(null)} className="px-4 py-1.5 rounded text-xs font-medium border-none cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{u.username}</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(u.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      {u.bio && <p className="text-xs m-0" style={{ color: 'var(--color-text-secondary)' }}>{u.bio.slice(0, 60)}</p>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startImpersonation({ profileId: u.id, username: u.username, avatarUrl: u.avatar_url })}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border-none cursor-pointer"
                    style={{ color: '#fff', backgroundColor: 'var(--color-success)' }}
                  >
                    <UserCheck size={11} /> 以此身份发言
                  </button>
                  <button
                    onClick={() => { setEditing(u.id); setEditName(u.username); setEditBio(u.bio || ''); setEditAvatar(u.avatar_url || ''); }}
                    className="p-1.5 rounded cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)]"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(u.id, u.username)}
                    className="p-1.5 rounded cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)]"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
