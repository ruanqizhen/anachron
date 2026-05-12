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

  // 1. Normalize line endings and handle multiple empty lines with ZWSP
  const rawLines = text.split(/\r?\n/);
  const processedLines: string[] = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const nextLine = rawLines[i + 1];
    
    processedLines.push(line);
    
    // If there's a next line and it's not an empty line break
    if (nextLine !== undefined) {
      if (line.trim() === '' && nextLine.trim() === '') {
        // Handle consecutive empty lines by inserting ZWSP
        processedLines.push('\u200B');
      } else if (line.trim() !== '' && nextLine.trim() !== '') {
        // Single newline case: check if we should "paragraph-ize" it
        const isSpecial = (l: string) => l.trim().match(/^(\s*[*+-]|\s*\d+\.|\s*#|\s*>|\s*```)/);
        if (!isSpecial(line) && !isSpecial(nextLine)) {
          // Both are normal text lines -> force a paragraph break
          processedLines.push('');
        }
      }
    }
  }
  
  let processed = processedLines.join('\n');
  
  // 2. Linkify mentions
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
