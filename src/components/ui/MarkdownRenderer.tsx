import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function preprocessMarkdown(text: string): string {
  if (!text) return '';
  let processed = text.replace(/@([一-鿿\w]{2,30})/g, (_, name) => `[@${name}](/u/${encodeURIComponent(name)})`);
  processed = processed.replace(/\n(\s*\n){2,}/g, '\n\n​\n');
  return processed;
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  ],
};

const remarkPlugins = [remarkGfm, remarkBreaks] as const;
const rehypePlugins = [[rehypeSanitize, sanitizeSchema]] as unknown as never;
const markdownComponents = {
  a: ({ href, ...props }: any) => (
    <a
      href={href}
      {...props}
      target={href?.startsWith('/u/') ? undefined : '_blank'}
      rel={href?.startsWith('/u/') ? undefined : 'noopener noreferrer'}
    />
  ),
};

function MarkdownRendererInner({ content, className = '' }: MarkdownRendererProps) {
  const processed = useMemo(() => preprocessMarkdown(content), [content]);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins as any}
        rehypePlugins={rehypePlugins as any}
        components={markdownComponents as any}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

const MarkdownRenderer = memo(MarkdownRendererInner);
export default MarkdownRenderer;
