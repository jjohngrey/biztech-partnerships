import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1.5 text-[15px] font-semibold text-zinc-100 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1.5 text-[14px] font-semibold text-zinc-100 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 mb-1 text-[13px] font-semibold text-zinc-200 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 mb-1 text-[13px] font-semibold text-zinc-200 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-2 text-[13px] leading-5 text-zinc-400 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-zinc-200 underline underline-offset-2 hover:text-white"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc pl-5 text-[13px] leading-5 text-zinc-400 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal pl-5 text-[13px] leading-5 text-zinc-400 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded bg-white/[0.06] px-1 py-[1px] font-mono text-[12px] text-zinc-200">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mt-2 mb-2 overflow-auto rounded bg-white/[0.04] p-2 font-mono text-[12px] text-zinc-300">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-white/15 pl-3 italic text-zinc-400">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-white/[0.09]" />,
};

export function MarkdownNotes({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
