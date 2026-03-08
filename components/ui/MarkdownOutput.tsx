'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MarkdownOutputProps {
  output: string
  className?: string
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-sm font-bold text-dracula-purple mt-3 mb-1 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xs font-bold text-dracula-cyan mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-dracula-green mt-2 mb-0.5 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-xs text-dracula-light/80 leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="text-xs text-dracula-light/80 list-disc list-inside mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-xs text-dracula-light/80 list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-xs text-dracula-light/80 ml-2">{children}</li>
  ),
  pre: ({ children }) => (
    <pre className="text-xs font-mono bg-dracula-dark rounded p-2 mb-2 overflow-x-auto whitespace-pre">{children}</pre>
  ),
  code: ({ children, className }) => {
    if (className) {
      return <code className={`${className} text-dracula-light`}>{children}</code>
    }
    return (
      <code className="text-xs font-mono text-dracula-cyan bg-dracula-dark/60 rounded px-1 py-0.5">{children}</code>
    )
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-dracula-comment pl-3 my-2 text-xs text-dracula-comment italic">{children}</blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-dracula-light">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-dracula-light/90">{children}</em>
  ),
  hr: () => <hr className="border-t border-dracula-dark my-3" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-dracula-cyan underline hover:text-dracula-blue">
      {children}
    </a>
  ),
}

export function MarkdownOutput({ output, className = '' }: MarkdownOutputProps) {
  return (
    <div className={`overflow-y-auto ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {output}
      </ReactMarkdown>
    </div>
  )
}
