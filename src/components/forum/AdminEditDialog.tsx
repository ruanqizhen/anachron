import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import MarkdownEditor from '../ui/MarkdownEditor';
import type { Board } from '../../lib/types';
import BCDateTimePicker, { formatBCDate, parseBCDate } from '../ui/BCDateTimePicker';

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
  const initialParsed = parseBCDate(initCreatedAt);
  const [content, setContent] = useState(initContent);
  const [boardId, setBoardId] = useState(initBoardId || (boards?.length ? boards[0].id : ''));
  const [year, setYear] = useState(initialParsed.year);
  const [monthDayTime, setMonthDayTime] = useState(initialParsed.monthDayTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (boards?.length && !boardId) {
      setTimeout(() => setBoardId(boards[0].id), 0);
    }
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
        createdAt: formatBCDate(year, monthDayTime) || new Date().toISOString(),
      });
      onClose();
    } catch (err: unknown) { setError((err as Error).message || '保存失败'); }
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    outline: 'none', fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)',
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full rounded-xl flex flex-col overflow-auto" style={{
        maxWidth: '90vw', width: 800, minHeight: 400, maxHeight: '85vh',
        backgroundColor: 'var(--color-card-bg)', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        resize: 'both',
      }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-bold m-0" style={{ color: 'var(--color-text-primary)' }}>管理员编辑{isThread ? '帖子' : '回复'}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-page-bg)] cursor-pointer border-none bg-transparent">
            <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {isThread && boards ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">版块</label>
                <select value={boardId} onChange={e => setBoardId(e.target.value)} style={inputStyle}>
                  {boards.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
                </select>
              </div>
              <BCDateTimePicker
                isoString={formatBCDate(year, monthDayTime) || ''}
                onChange={(val) => {
                  const p = parseBCDate(val);
                  setYear(p.year);
                  setMonthDayTime(p.monthDayTime);
                }}
                label="发帖时间"
              />
            </div>
          ) : (
            <BCDateTimePicker
              isoString={formatBCDate(year, monthDayTime) || ''}
              onChange={(val) => {
                const p = parseBCDate(val);
                setYear(p.year);
                setMonthDayTime(p.monthDayTime);
              }}
              label={isThread ? "发帖时间" : "回复时间"}
              className="max-w-md"
            />
          )}

          {isThread && (
            <div>
              <label className="block text-sm font-medium mb-1">标题</label>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} style={inputStyle} />
            </div>
          )}

          <MarkdownEditor value={content} onChange={setContent} />
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
