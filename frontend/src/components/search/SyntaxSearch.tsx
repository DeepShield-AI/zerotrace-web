import { useState, useRef, useCallback } from 'react';

// ── Token types ─────────────────────────────────────────

type TokenType = 'service' | 'operation' | 'status' | 'duration' | 'env' | 'number' | 'text';

interface Token { type: TokenType; value: string; }

const KEYWORDS: { prefix: string; type: TokenType; color: string }[] = [
  { prefix: 'service:',   type: 'service',   color: '#8c4fff' },
  { prefix: 'operation:', type: 'operation', color: '#128fea' },
  { prefix: 'status:',    type: 'status',    color: '#f27c00' },
  { prefix: 'duration:',  type: 'duration',  color: '#1cb96d' },
  { prefix: 'env:',       type: 'env',       color: '#ed1978' },
];

function tokenize(input: string): Token[] {
  if (!input.trim()) return [];
  const tokens: Token[] = [];
  let remaining = input;
  while (remaining.length > 0) {
    let matched = false;
    for (const kw of KEYWORDS) {
      if (remaining.toLowerCase().startsWith(kw.prefix)) {
        const after = remaining.slice(kw.prefix.length);
        const end = after.search(/[\s><]/);
        const val = end === -1 ? after : after.slice(0, end);
        if (val) tokens.push({ type: kw.type, value: kw.prefix + val });
        remaining = end === -1 ? '' : after.slice(end);
        matched = true;
        break;
      }
    }
    if (!matched) {
      let next = remaining.length;
      for (const kw of KEYWORDS) {
        const idx = remaining.toLowerCase().indexOf(kw.prefix);
        if (idx !== -1 && idx < next) next = idx;
      }
      const text = remaining.slice(0, next).trim();
      if (text) {
        if (/^[><]\d/.test(text)) tokens.push({ type: 'number', value: text.match(/^[><]\S+/)?.[0] || text });
        else tokens.push({ type: 'text', value: text });
      }
      remaining = remaining.slice(next);
    }
  }
  return tokens;
}

function tokenColor(t: TokenType): string {
  return KEYWORDS.find(k => k.type === t)?.color ?? 'var(--fg-primary)';
}

// ── Component ────────────────────────────────────────────

export default function SyntaxSearch({
  value, onChange,
  scope = 'All Spans',
  scopeOptions = ['All Spans', 'All Traces', 'Error Spans', 'Slow Traces'],
  onScopeChange,
}: {
  value: string; onChange: (v: string) => void;
  scope?: string; scopeOptions?: string[]; onScopeChange?: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (inputRef.current && hlRef.current) hlRef.current.scrollLeft = inputRef.current.scrollLeft;
  }, []);

  const tokens = tokenize(value);
  const hasValue = value.length > 0;

  return (
    <div>
      {/* ── Main search row: [a] [input] [in scope ▾] [</>] [✨] ── */}
      <div className={`flex items-stretch rounded-md overflow-hidden border-2 transition-colors bg-bg-elevated ${
        focused ? 'border-[#3B82F6]' : 'border-[#D1D5DB]'
      }`}>
        {/* 1. "a" button: 32x32px, light purple bg, bold white "a" */}
        <button
          className="flex items-center justify-center shrink-0 bg-[#E9D5FF] hover:bg-[#C4B5FD] transition-colors"
          style={{ width: 32, minWidth: 32 }}
          title="Natural language search"
        >
          <span className="text-[15px] font-bold text-[#7C3AED] leading-none">a</span>
        </button>

        {/* 2. Search input */}
        <div className="relative flex-1 min-w-0">
          {/* Highlight layer */}
          <div ref={hlRef} className="absolute inset-0 flex items-center pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="whitespace-nowrap text-[14px] pl-3 w-full overflow-hidden" style={{ fontFamily: 'Geist Mono, monospace' }}>
              {!hasValue ? (
                <span className="text-[#9CA3AF]">
                  Search for any tag or attribute on your spans. Press <kbd className="text-[11px] bg-[#F3F4F6] border border-[#D1D5DB] rounded px-1.5 py-0.5 font-mono text-[#6B7280]">Space</kbd> to search using natural language queries.
                </span>
              ) : codeMode ? (
                <span className="text-fg-primary">{value}</span>
              ) : (
                tokens.map((t, i) => (
                  <span key={i} style={{ color: tokenColor(t.type), fontWeight: 500 }}>{t.value}{' '}</span>
                ))
              )}
            </div>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => { if (e.key === 'Escape') { onChange(''); inputRef.current?.focus(); } }}
            onScroll={syncScroll}
            className="w-full h-10 pl-3 pr-2 text-[14px] font-mono bg-transparent focus:outline-none text-transparent caret-fg-primary"
            style={{ fontFamily: 'Geist Mono, monospace' }}
            spellCheck={false} autoComplete="off" placeholder=""
          />
        </div>

        {/* 3. Scope dropdown: "in All Spans ▾" */}
        {onScopeChange && (
          <div className="flex items-center shrink-0 border-l border-[#D1D5DB] pl-3 pr-1">
            <span className="text-[12px] text-[#6B7280] mr-1">in</span>
            <div className="relative">
              <select
                value={scope}
                onChange={e => onScopeChange(e.target.value)}
                className="appearance-none bg-transparent text-[12px] font-medium text-fg-secondary cursor-pointer hover:text-fg-primary focus:outline-none pr-5 py-1"
              >
                {scopeOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <svg className="absolute right-0.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-[#9CA3AF] pointer-events-none" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l4 4 4-4"/></svg>
            </div>
          </div>
        )}

        {/* 4. </> Code mode toggle */}
        <button
          onClick={() => setCodeMode(!codeMode)}
          className={`flex items-center justify-center shrink-0 border-l border-[#D1D5DB] transition-colors ${
            codeMode ? 'text-[#3B82F6] bg-[#EFF6FF]' : 'text-[#6B7280] hover:text-fg-primary hover:bg-[#F9FAFB]'
          }`}
          style={{ width: 36, minWidth: 36 }}
          title={codeMode ? 'Switch to visual search' : 'Raw query mode'}
        >
          <span className="text-[13px] font-mono font-bold">&lt;/&gt;</span>
        </button>

        {/* 5. Magic wand: purple bg, white icon */}
        <button
          className="flex items-center justify-center shrink-0 bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors rounded-r-sm"
          style={{ width: 36, minWidth: 36 }}
          title="AI query suggestions"
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2l1.5 6L2 9l4.5 5 2-6 5-2-5.5-3L3 2z"/>
            <path d="M8 8l1.5 1.5"/>
          </svg>
        </button>
      </div>

      {/* Code mode syntax hint */}
      {codeMode && (
        <div className="mt-1.5 text-[11px] font-mono text-fg-tertiary flex items-center gap-1">
          <span className="text-fg-tertiary/60">Syntax:</span>
          <span style={{ color: '#8c4fff' }}>service:</span><span className="text-fg-tertiary/60">name</span>
          <span style={{ color: '#128fea' }}>operation:</span><span className="text-fg-tertiary/60">path</span>
          <span style={{ color: '#f27c00' }}>status:</span><span className="text-fg-tertiary/60">ok|error</span>
          <span style={{ color: '#1cb96d' }}>duration:</span><span className="text-fg-tertiary/60">&gt;500ms</span>
        </div>
      )}
    </div>
  );
}
