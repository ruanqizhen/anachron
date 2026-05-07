import { type TextareaHTMLAttributes } from 'react';

export default function ResizableTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="relative" style={{ paddingBottom: 12 }}>
      <textarea
        {...props}
        className={`w-full min-h-[80px] px-3 py-2 text-sm border outline-none resize-none bg-transparent rounded-lg ${props.className || ''}`}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', ...props.style }}
      />
      <div
        className="flex items-center justify-center h-4 cursor-s-resize select-none rounded-b-lg"
        style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-page-bg)' }}
        title="拖动调整高度"
        onMouseDown={(e) => {
          e.preventDefault();
          const ta = e.currentTarget.parentElement?.querySelector('textarea');
          if (!ta) return;
          const startY = e.clientY;
          const startH = ta.offsetHeight;
          const onMove = (ev: MouseEvent) => {
            ta.style.height = Math.max(80, Math.min(400, startH + ev.clientY - startY)) + 'px';
          };
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      >
        <span className="text-[10px] tracking-[3px]" style={{ color: 'var(--color-text-muted)', lineHeight: 1 }}>⋮⋮⋮</span>
      </div>
    </div>
  );
}
