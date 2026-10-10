export default function Footer() {
  const linkStyle: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    textDecoration: 'none',
  };

  return (
    <footer
      className="w-full mt-12"
      style={{
        borderTop: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-card-bg)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <span style={{ color: 'var(--color-text-muted)' }}>© 2026 阮奇桢 · 回音堂</span>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/ruanqizhen"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            GitHub
          </a>
          <a href="https://qizhen.xyz/" style={linkStyle}>
            ← 返回主站
          </a>
        </div>
      </div>
    </footer>
  );
}
