import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Pre-process text to preserve formatting
function preprocessMarkdown(text: string): string {
  if (!text) return '';

  // 1. Linkify mentions
  let processed = text.replace(/@([一-鿿\w]{2,30})/g, (_, name) => `[@${name}](/u/${encodeURIComponent(name)})`);
  
  // 2. Handle multiple consecutive empty lines to ensure they are rendered
  // (Standard Markdown collapses multiple empty lines)
  processed = processed.replace(/\n(\s*\n){2,}/g, '\n\n\u200B\n');

  return processed;
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  ],
};

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
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
        {preprocessMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}
