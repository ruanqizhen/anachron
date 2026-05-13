import { useEffect, useRef, type ReactNode, type TextareaHTMLAttributes, type Ref } from 'react';
import { ImagePlus } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useImageUpload } from '../../lib/useImageUpload';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> };
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  showToolbar?: boolean;
  showResize?: boolean;
  hideLabel?: boolean;
  children?: ReactNode;
}

export default function MarkdownEditor({
  value, onChange, textareaProps, className = '',
  minHeight = 150, maxHeight = 600, showToolbar = true, showResize = true, hideLabel = false, children,
}: MarkdownEditorProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const { handlePaste, handleFileChange } = useImageUpload({
    userId: user?.id,
    onInsert: (md) => {
      const PLACEHOLDER = '![Uploading image...]()';
      if (value.includes(PLACEHOLDER)) {
        onChange(value.replace(`\n${PLACEHOLDER}\n`, md ? `\n${md}\n` : ''));
        return;
      }
      if (!md) return;
      const ta = containerRef.current?.querySelector('textarea');
      if (!ta) { onChange(value + md); return; }
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      onChange(value.slice(0, start) + md + value.slice(end));
    },
    onPlaceholder: () => '\n![Uploading image...]()\n',
  });

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div className={`flex-1 flex flex-col ${className}`}>
      {showToolbar && (
        <div className="flex items-center justify-between mb-1.5 px-1">
          {!hideLabel && <label className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">正文 (Markdown)</label>}
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer transition-all hover:brightness-110 active:scale-95 shadow-sm"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <ImagePlus size={14} /> 贴图
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      )}
      <div ref={containerRef} className="relative flex-1 flex flex-col rounded-xl border focus-within:border-[var(--color-primary)] transition-all bg-[var(--color-page-bg)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/10"
        style={{ borderColor: 'var(--color-border)' }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full flex-1 px-3 py-2.5 outline-none text-sm bg-transparent"
          style={{ color: 'var(--color-text-primary)', resize: 'none', minHeight }}
          {...textareaProps}
        />
        {children}
        {showResize && (
          <div
            className="h-2 cursor-s-resize hover:bg-[var(--color-primary)]/10 transition-colors flex items-center justify-center group border-t border-dashed"
            style={{ borderColor: 'var(--color-border)' }}
            onMouseDown={(e) => {
              e.preventDefault();
              const c = e.currentTarget.parentElement;
              if (!c) return;
              const startY = e.clientY;
              const startH = c.offsetHeight;
              const onMove = (ev: MouseEvent) => { c.style.height = Math.max(minHeight, Math.min(maxHeight, startH + ev.clientY - startY)) + 'px'; c.style.flex = 'none'; };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] transition-colors opacity-30 group-hover:opacity-100" />
              <div className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] transition-colors opacity-30 group-hover:opacity-100" />
              <div className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] transition-colors opacity-30 group-hover:opacity-100" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
