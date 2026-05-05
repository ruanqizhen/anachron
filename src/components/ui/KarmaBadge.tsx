interface KarmaBadgeProps {
  karma?: number;
  className?: string;
}

export default function KarmaBadge({ karma = 0, className = '' }: KarmaBadgeProps) {
  let title = '庶民';
  let color = '#888888';
  let bg = '#F0F0F0';
  let border = '#E0E0E0';

  if (karma >= 1000) {
    title = '诸侯';
    color = '#D97706'; // Amber 600
    bg = '#FEF3C7'; // Amber 100
    border = '#FDE68A'; // Amber 200
  } else if (karma >= 200) {
    title = '举人';
    color = '#059669'; // Emerald 600
    bg = '#D1FAE5'; // Emerald 100
    border = '#A7F3D0'; // Emerald 200
  } else if (karma >= 50) {
    title = '秀才';
    color = '#2563EB'; // Blue 600
    bg = '#DBEAFE'; // Blue 100
    border = '#BFDBFE'; // Blue 200
  } else if (karma >= 10) {
    title = '士人';
    color = '#4B5563'; // Gray 600
    bg = '#F3F4F6'; // Gray 100
    border = '#E5E7EB'; // Gray 200
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${className}`}
      style={{
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        lineHeight: 1,
      }}
      title={`声望值: ${karma}`}
    >
      {title}
    </span>
  );
}
