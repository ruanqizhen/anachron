import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Board } from '../../lib/types';

interface AdminEditDialogProps {
  title?: string;
  content: string;
  createdAt: string;
  boardId?: string;
  boards?: Board[];
  isThread?: boolean;
  onSave: (data: { title?: string; content: string; boardId?: string; createdAt: string }) => Promise<void>;
  onClose: () => void;
}

export default function AdminEditDialog({
  title: initTitle, content: initContent, createdAt: initCreatedAt,
  boardId: initBoardId, boards, isThread, onSave, onClose,
}: AdminEditDialogProps) {
  const [title, setTitle] = useState(initTitle || '');
  const [content, setContent] = useState(initContent);
  const [boardId, setBoardId] = useState(initBoardId || '');
  const [createdAt, setCreatedAt] = useState(initCreatedAt.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (boards?.length && !boardId) setBoardId(boards[0].id);
  }, [boards, boardId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (isThread && title.trim().length < 2) { setError('标题至少 2 个字符'); return; }
    if (content.trim().length < 5) { setError('正文至少 5 个字符'); return; }
    setSaving(true);
    try {
      await onSave({
        title: isThread ? title.trim() : undefined,
        content: content.trim(),
        boardId: isThread ? boardId : undefined,
        createdAt: new Date(createdAt).toISOString(),
      });
      onClose();
    } catch (err: any) { setError(err.message || '保存失败'); }
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    outline: 'none', fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)',
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl flex flex-col max-h-[90vh]" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-bold m-0" style={{ color: 'var(--color-text-primary)' }}>管理员编辑{isThread ? '帖子' : '回复'}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-page-bg)] cursor-pointer border-none bg-transparent">
            <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {isThread && boards && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">版块</label>
                <select value={boardId} onChange={e => setBoardId(e.target.value)} style={inputStyle}>
                  {boards.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">发帖时间</label>
                <input type="datetime-local" value={createdAt} onChange={e => setCreatedAt(e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}
          {!isThread && (
            <div>
              <label className="block text-sm font-medium mb-1">发帖时间</label>
              <input type="datetime-local" value={createdAt} onChange={e => setCreatedAt(e.target.value)} style={{ ...inputStyle, width: 280 }} />
            </div>
          )}
          {isThread && (
            <div>
              <label className="block text-sm font-medium mb-1">标题</label>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} style={inputStyle} />
            </div>
          )}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium mb-1">正文</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className="flex-1 min-h-[150px] rounded-lg border outline-none text-sm resize-none bg-transparent px-3 py-2" style={inputStyle} />
          </div>
          {error && <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDED', color: 'var(--color-danger)' }}>{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-secondary)' }}>取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
