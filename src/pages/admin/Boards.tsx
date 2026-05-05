import { useState, useEffect } from 'react';
import { Pencil, Trash2, PlusCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { getBoards, adminCreateBoard, adminUpdateBoard, adminDeleteBoard } from '../../lib/api';
import AdminGuard from '../../components/layout/AdminGuard';
import type { Board } from '../../lib/types';

export default function AdminBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  // New board form
  const [nName, setNName] = useState('');
  const [nSlug, setNSlug] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nEra, setNEra] = useState('');
  const [nIcon, setNIcon] = useState('');

  // Edit form
  const [eName, setEName] = useState('');
  const [eSlug, setESlug] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eEra, setEEra] = useState('');
  const [eIcon, setEIcon] = useState('');
  const [eOrder, setEOrder] = useState(0);

  async function load() {
    setIsLoading(true);
    setBoards(await getBoards());
    setIsLoading(false);
  }
  useEffect(() => { setTimeout(() => load(), 0); }, []);

  const F = { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', outline: 'none', fontSize: 13, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)' };

  async function moveUp(idx: number) {
    if (idx === 0) return;
    const a = boards[idx];
    const b = boards[idx - 1];
    await adminUpdateBoard(a.id, { name: a.name, slug: a.slug, description: a.description, era_tag: a.era_tag, icon: a.icon, display_order: b.display_order });
    await adminUpdateBoard(b.id, { name: b.name, slug: b.slug, description: b.description, era_tag: b.era_tag, icon: b.icon, display_order: a.display_order });
    load();
  }

  async function moveDown(idx: number) {
    if (idx === boards.length - 1) return;
    const a = boards[idx];
    const b = boards[idx + 1];
    await adminUpdateBoard(a.id, { name: a.name, slug: a.slug, description: a.description, era_tag: a.era_tag, icon: a.icon, display_order: b.display_order });
    await adminUpdateBoard(b.id, { name: b.name, slug: b.slug, description: b.description, era_tag: b.era_tag, icon: b.icon, display_order: a.display_order });
    load();
  }

  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">版块管理</h1>
            <p className="text-sm m-0" style={{ color: 'var(--color-text-secondary)' }}>{boards.length} 个版块</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <PlusCircle size={14} /> 新建版块
          </button>
        </div>

        {showCreate && (
          <div className="rounded-lg p-4 mb-4 flex flex-wrap items-center gap-2" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
            <input placeholder="名称" value={nName} onChange={e => setNName(e.target.value)} style={F} />
            <input placeholder="slug" value={nSlug} onChange={e => setNSlug(e.target.value)} style={F} />
            <input placeholder="描述" value={nDesc} onChange={e => setNDesc(e.target.value)} style={F} />
            <input placeholder="时代标签" value={nEra} onChange={e => setNEra(e.target.value)} style={{...F, width: 80}} />
            <input placeholder="图标" value={nIcon} onChange={e => setNIcon(e.target.value)} style={{...F, width: 60}} />
            <button onClick={async () => {
              if (!nName || !nSlug) { setMsg('名称和 slug 必填'); return; }
              await adminCreateBoard({ name: nName, slug: nSlug, description: nDesc, era_tag: nEra, icon: nIcon || '' });
              setNName(''); setNSlug(''); setNDesc(''); setNEra(''); setNIcon(''); setShowCreate(false);
              load();
            }} className="px-3 py-1.5 rounded text-xs font-medium text-white bg-[var(--color-success)] border-none cursor-pointer">创建</button>
          </div>
        )}

        {msg && <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{msg}</p>}

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {boards.map((b, i) => (
              <div key={b.id} className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
                {editing === b.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input value={eName} onChange={e => setEName(e.target.value)} style={F} />
                    <input value={eSlug} onChange={e => setESlug(e.target.value)} style={{...F, width: 120}} />
                    <input value={eDesc} onChange={e => setEDesc(e.target.value)} style={{...F, width: 120}} />
                    <input value={eEra} onChange={e => setEEra(e.target.value)} style={{...F, width: 80}} />
                    <input value={eIcon} onChange={e => setEIcon(e.target.value)} style={{...F, width: 50}} />
                    <input type="number" value={eOrder} onChange={e => setEOrder(Number(e.target.value))} style={{...F, width: 50}} />
                    <button onClick={async () => {
                      await adminUpdateBoard(b.id, { name: eName, slug: eSlug, description: eDesc, era_tag: eEra, icon: eIcon, display_order: eOrder });
                      setEditing(null); load();
                    }} className="px-2 py-1 rounded text-xs font-medium text-white bg-[var(--color-success)] border-none cursor-pointer">保存</button>
                    <button onClick={() => setEditing(null)} className="px-2 py-1 rounded text-xs font-medium border-none cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>取消</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => moveUp(i)} className="p-0.5 rounded cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-muted)' }}><ChevronUp size={14} /></button>
                      <button onClick={() => moveDown(i)} className="p-0.5 rounded cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-muted)' }}><ChevronDown size={14} /></button>
                    </div>
                    <span className="text-lg">{b.icon || ''}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{b.name}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>/{b.slug} · {b.era_tag} · 顺序 {b.display_order}</span>
                    </div>
                    <button onClick={() => { setEditing(b.id); setEName(b.name); setESlug(b.slug); setEDesc(b.description); setEEra(b.era_tag); setEIcon(b.icon); setEOrder(b.display_order); }}
                      className="p-1.5 rounded cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-secondary)' }}><Pencil size={14} /></button>
                    <button onClick={async () => { if (confirm('确定删除？')) { await adminDeleteBoard(b.id); load(); } }}
                      className="p-1.5 rounded cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
