import { Check } from 'lucide-react';

interface BadgeProps {
  type: 'verified' | 'registered';
}

export default function Badge({ type }: BadgeProps) {
  if (type === 'verified') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full ml-1"
        style={{
          backgroundColor: 'var(--color-badge-verified)',
          width: 16, height: 16,
        }}
        title="AI 认证角色"
        aria-label="认证"
      >
        <Check size={10} strokeWidth={3} color="#fff" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center text-xs px-1.5 py-0.5 rounded ml-1"
      style={{
        backgroundColor: '#E4E6E9',
        color: 'var(--color-badge-registered)',
        fontSize: 11,
        lineHeight: 1,
      }}
      title="注册用户"
      aria-label="注册"
    >
      注册
    </span>
  );
}
