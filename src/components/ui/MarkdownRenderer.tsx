import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Convert @username to profile links before Markdown rendering
function linkifyMentions(text: string): string {
  return text.replace(/@([一-鿿\w]{2,30})/g, (_, name) => `[@${name}](/u/${encodeURIComponent(name)})`);
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, ...props }) => (
            <a
              href={href}
              {...props}
              target={href?.startsWith('/u/') ? undefined : '_blank'}
              rel={href?.startsWith('/u/') ? undefined : 'noopener noreferrer'}
            />
          ),
        }}
      >
        {linkifyMentions(content)}
      </ReactMarkdown>
    </div>
  );
}
