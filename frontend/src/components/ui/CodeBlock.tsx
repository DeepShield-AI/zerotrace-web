import { useState, useCallback } from 'react';

export function CodeBlock({ code, language = 'bash', maxHeight }: { code: string; language?: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }, [code]);

  return (
    <div className="bg-[#1A1D24] rounded-lg overflow-hidden border border-[#2D313A]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2D313A]">
        <span className="text-2xs font-mono uppercase tracking-wider text-[#8B9BB4]">{language}</span>
        <button onClick={handleCopy}
          className={`text-2xs font-medium px-2 py-0.5 rounded transition-colors ${
            copied ? 'bg-green-600/20 text-green-400' : 'text-[#8B9BB4] hover:text-white hover:bg-[#2D313A]'
          }`}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-code-sm font-mono text-[#C8CDD0] leading-relaxed whitespace-pre-wrap" style={maxHeight ? { maxHeight } : {}}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="inline px-1.5 py-0.5 rounded text-code-xs font-mono bg-[#F1F3F5] text-[#632CA6] border border-[#E9ECEF]">
      {children}
    </code>
  );
}
