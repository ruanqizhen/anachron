import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastEvent } from '../../lib/toast';

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEvent>;
      setToasts((prev) => [...prev, customEvent.detail]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== customEvent.detail.id));
      }, 3000);
    };

    window.addEventListener('anachron-toast', handleToast);
    return () => window.removeEventListener('anachron-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            borderLeft: `4px solid ${
              t.type === 'success' ? 'var(--color-success)' :
              t.type === 'error' ? 'var(--color-danger)' :
              'var(--color-primary)'
            }`,
            color: 'var(--color-text-primary)',
          }}
        >
          {t.type === 'success' && <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />}
          {t.type === 'error' && <AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />}
          {t.type === 'info' && <Info size={18} style={{ color: 'var(--color-primary)' }} />}
          <span className="text-sm font-medium">{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="ml-2 p-1 rounded-full hover:bg-[var(--color-page-bg)] transition-colors cursor-pointer border-none bg-transparent"
            aria-label="关闭"
          >
            <X size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>
      ))}
    </div>
  );
}
