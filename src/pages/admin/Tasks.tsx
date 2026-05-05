import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play } from 'lucide-react';
import { adminGetTaskQueue, adminCancelTask, adminAddResponseTask, adminGetAllCharacters } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import AdminGuard from '../../components/layout/AdminGuard';

export default function AdminTasks() {
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [characters, setCharacters] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addCharId, setAddCharId] = useState('');
  const [addThreadId, setAddThreadId] = useState('');
  const [addPostId, setAddPostId] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    setIsLoading(true);
    const [t, c] = await Promise.all([
      adminGetTaskQueue(),
      adminGetAllCharacters(),
    ]);
    setTasks(t);
    setCharacters(c);
    setIsLoading(false);
  }

  useEffect(() => { setTimeout(() => load(), 0); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await adminAddResponseTask(addCharId, addThreadId, addPostId);
      setMsg('任务已添加，character-responder 将自动处理');
      setShowAdd(false);
      load();
    } catch (err: unknown) {
      setMsg('添加失败: ' + ((err as Error).message || ''));
    }
  }

  return (
    <AdminGuard>
      <div className="max-w-[1000px] mx-auto px-4 pt-[72px] pb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">任务队列</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (!supabase) return;
                await supabase.functions.invoke('dispatcher', { body: {} });
                load();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none transition-colors"
              style={{ backgroundColor: 'var(--color-success)' }}
            >
              <Play size={12} /> 运行调度器
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus size={12} /> 手动添加
            </button>
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{tasks.length} 个任务</p>

        {showAdd && (
          <form onSubmit={handleAdd} className="rounded-lg p-4 mb-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
            <h3 className="text-sm font-bold m-0">手动添加响应任务（绕过调度器和冷却期）</h3>
            <div className="grid grid-cols-3 gap-3">
              <select value={addCharId} onChange={e => setAddCharId(e.target.value)} required
                className="px-3 py-2 rounded-lg border outline-none text-sm bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                <option value="">选择角色</option>
                {characters.map((c: Record<string, unknown>) => (
                  <option key={c.id as string} value={c.id as string}>{c.username as string}</option>
                ))}
              </select>
              <input placeholder="Thread ID" value={addThreadId} onChange={e => setAddThreadId(e.target.value)} required
                className="px-3 py-2 rounded-lg border outline-none text-sm bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              <input placeholder="触发 Post ID" value={addPostId} onChange={e => setAddPostId(e.target.value)} required
                className="px-3 py-2 rounded-lg border outline-none text-sm bg-transparent" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="px-4 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
                style={{ backgroundColor: 'var(--color-primary)' }}>添加</button>
              {msg && <span className="text-xs" style={{ color: msg.includes('失败') ? 'var(--color-danger)' : 'var(--color-success)' }}>{msg}</span>}
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>暂无任务</div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t: Record<string, unknown>) => (
              <div key={t.id as string} className="rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
                style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
                <div>
                  <span className="font-mono">{(t.id as string).slice(0, 8)}…</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: t.priority === 'high' ? '#FFF3E0' : 'var(--color-page-bg)',
                      color: t.priority === 'high' ? '#E65100' : 'var(--color-text-muted)',
                    }}>
                    {t.priority}
                  </span>
                  <span className="ml-2 px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: t.status === 'pending' ? '#E3F0FD' : t.status === 'dispatched' ? '#E8F5E9' : '#FFEBEE',
                      color: t.status === 'pending' ? 'var(--color-primary)' : t.status === 'dispatched' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                    {t.status}
                  </span>
                  <Link to={`/b/_/t/${t.thread_id}`} className="ml-2 no-underline hover:underline text-xs" style={{ color: 'var(--color-primary)' }}>
                    {t.thread_title || t.thread_id?.slice(0, 8) + '…'}
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {t.execute_after ? new Date(t.execute_after).toLocaleString('zh-CN') : '-'}
                  </span>
                  {(t.status === 'pending' || t.status === 'processing') && (
                    <button onClick={async () => { await adminCancelTask(t.id); load(); }}
                      className="px-2 py-0.5 rounded text-xs font-medium cursor-pointer border-none"
                      style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}>
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
