import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface AIResponseIndicatorProps {
  threadId: string;
}

const PHRASES = [
  '正在思考如何回应...',
  '正在翻看历史典籍...',
  '正在组织语言...',
  '正在酝酿情绪...',
  '正在审视当今世道...',
  '正在斟酌用词...',
];

export default function AIResponseIndicator({ threadId }: AIResponseIndicatorProps) {
  const [thinkingChar, setThinkingChar] = useState<string | null>(null);
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    async function check() {
      if (cancelled) return;
      try {
        const { data } = await supabase!.rpc('get_ai_thinking_status', {
          p_thread_id: threadId,
        });
        if (!cancelled) {
          if (data && data.length > 0 && data[0].character_name) {
            setThinkingChar(data[0].character_name);
          } else {
            setThinkingChar(null);
          }
        }
      } catch { /* RPC not deployed yet, ignore */ }
    }

    // Check immediately, then poll every 5 seconds
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [threadId]);

  if (!thinkingChar) return null;

  return (
    <div
      className="rounded-lg px-4 py-3 mb-4 flex items-center gap-3 animate-pulse"
      style={{
        backgroundColor: 'var(--color-card-bg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span className="text-lg">🤔</span>
      <div>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {thinkingChar}
        </span>
        <span className="text-sm ml-2" style={{ color: 'var(--color-text-muted)' }}>
          {phrase}
        </span>
      </div>
    </div>
  );
}
