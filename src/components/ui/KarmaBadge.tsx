interface KarmaBadgeProps {
  karma?: number;
  className?: string;
}

export default function KarmaBadge({ karma = 0, className = '' }: KarmaBadgeProps) {
  let level = 1;
  if (karma >= 1000) level = 5;
  else if (karma >= 200) level = 4;
  else if (karma >= 50) level = 3;
  else if (karma >= 10) level = 2;

  const medals = '🎖️'.repeat(level);

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${className}`}
      title={`声望值: ${karma}`}
      style={{ fontSize: 14, lineHeight: 1 }}
    >
      {medals}
    </span>
  );
}
