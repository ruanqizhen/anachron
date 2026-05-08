import { useState } from 'react';
import { X } from 'lucide-react';
import MarkdownEditor from '../ui/MarkdownEditor';

interface EditDialogProps {
  title?: string;
  content: string;
  isThread?: boolean;
  onSave: (title: string | undefined, content: string) => Promise<void>;
  onClose: () => void;
}

export default function EditDialog({ title: initialTitle, content: initialContent, isThread, onSave, onClose }: EditDialogProps) {
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isThread && title.trim().length < 5) {
      setError('标题至少 5 个字符');
      return;
    }
    if (content.trim().length < (isThread ? 20 : 5)) {
      setError(`正文至少 ${isThread ? 20 : 5} 个字符`);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(isThread ? title.trim() : undefined, content.trim());
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full rounded-xl flex flex-col overflow-auto"
        style={{
          maxWidth: '90vw', width: 800, minHeight: 400, maxHeight: '85vh',
          backgroundColor: 'var(--color-card-bg)', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          resize: 'both',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-bold m-0" style={{ color: 'var(--color-text-primary)' }}>
            编辑{isThread ? '帖子' : '评论'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--color-page-bg)] transition-colors cursor-pointer border-none bg-transparent"
          >
            <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {isThread && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-transparent"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
          )}

          <MarkdownEditor value={content} onChange={setContent} />

          {error && (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDED', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
