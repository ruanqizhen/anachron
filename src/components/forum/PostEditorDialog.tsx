import { X } from 'lucide-react';
import PostEditor from './PostEditor';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../lib/auth';

interface PostEditorDialogProps {
  mode: 'create' | 'edit' | 'reply';
  isThread?: boolean;
  initialTitle?: string;
  initialContent?: string;
  initialBoardId?: string;
  initialCreatedAt?: string;
  placeholder?: string;
  defaultBoardSlug?: string;
  onSave: (data: any) => Promise<void | boolean>;
  onClose: () => void;
  title?: string;
  draftKey?: string;
}

export default function PostEditorDialog({
  mode, isThread, initialTitle, initialContent, initialBoardId, initialCreatedAt,
  placeholder, defaultBoardSlug, onSave, onClose, title: dialogTitle, draftKey
}: PostEditorDialogProps) {
  const { impersonating, guest } = useAuth();
  const effectiveGuestName = guest?.username || null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-[95%] max-w-4xl rounded-2xl flex flex-col h-[85vh] max-h-[95vh] shadow-2xl animate-in fade-in zoom-in duration-200"
        style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-black m-0 text-[var(--color-text-primary)] tracking-tight">
              {dialogTitle || (mode === 'edit' ? `编辑${isThread ? '帖子' : '内容'}` : (isThread ? '发布新帖子' : '发表回复'))}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {impersonating ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
                  <Avatar name={impersonating.username} url={impersonating.avatarUrl} size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-success)' }}>
                    以「{impersonating.username}」身份
                  </span>
                </div>
              ) : effectiveGuestName && (
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  以「{effectiveGuestName}」身份发布
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--color-page-bg)] transition-all cursor-pointer border-none bg-transparent group"
          >
            <X size={20} className="text-[var(--color-text-secondary)] group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto p-3 sm:p-6">
          <PostEditor
            mode={mode}
            isThread={isThread}
            initialTitle={initialTitle}
            initialContent={initialContent}
            initialBoardId={initialBoardId}
            initialCreatedAt={initialCreatedAt}
            placeholder={placeholder}
            defaultBoardSlug={defaultBoardSlug}
            onSave={async (data) => {
              const result = await onSave(data);
              if (result !== false) onClose();
              return result;
            }}
            onCancel={onClose}
            minHeight={200}
            autoFocus={true}
            draftKey={draftKey}
            className="flex-1"
            showResize={false}
          />
        </div>
      </div>
    </div>
  );
}
