import { useState, useCallback } from 'react';

export function CodeBlock({ code, language = 'bash', maxHeight }: { code: string; language?: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }, [code]);

  return (
    <div className="bg-code-bg rounded-lg overflow-hidden border border-code-border">
      <div className="flex items-center justify-between px-4 py-2 border-b border-code-border">
        <span className="text-2xs font-mono uppercase tracking-wider text-fg-tertiary">{language}</span>
        <button onClick={handleCopy}
          className={`text-2xs font-medium px-2 py-0.5 rounded transition-colors ${
            copied ? 'bg-accent-success/20 text-accent-success' : 'text-fg-tertiary hover:text-fg-inverse hover:bg-code-border'
          }`}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-code-sm font-mono text-code-fg leading-relaxed whitespace-pre-wrap" style={maxHeight ? { maxHeight } : {}}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="inline px-1.5 py-0.5 rounded text-code-xs font-mono bg-bg-muted text-accent-primary border-border-subtle border">
      {children}
    </code>
  );
}
