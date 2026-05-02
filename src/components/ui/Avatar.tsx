interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}

const COLORS = [
  '#1877F2', '#42B72A', '#F02849', '#FF6900',
  '#8B5CF6', '#0EA5E9', '#EC4899', '#14B8A6',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ name, url, size = 40, className = '' }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = name.charAt(0).toUpperCase();
  const bg = getColor(name);

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none ${className}`}
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.4 }}
      aria-label={name}
    >
      {initial}
    </div>
  );
}
