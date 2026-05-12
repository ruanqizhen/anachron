import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Pre-process text to preserve formatting
function preprocessMarkdown(text: string): string {
  if (!text) return '';

  // 1. Normalize line endings and preserve multiple empty lines with ZWSP
  let processed = text.replace(/\n\n+/g, (match) => {
    return '\n' + '\u200B\n'.repeat(match.length - 1);
  });
  
  // 2. Convert single newlines to double newlines (paragraphs)
  // This makes every "Enter" act as a paragraph break as requested
  // We use a replacement that avoids already-doubled lines
  processed = processed.replace(/([^\n])\n([^\n\u200B])/g, '$1\n\n$2');
  
  // 3. Linkify mentions
  processed = processed.replace(/@([一-鿿\w]{2,30})/g, (_, name) => `[@${name}](/u/${encodeURIComponent(name)})`);
  
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
        remarkPlugins={[remarkGfm]}
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
