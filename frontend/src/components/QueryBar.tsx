import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagSuggestion {
  tag_key: string;
  cnt: number | string;
}

interface ServiceSuggestion {
  name: string;
  cnt: number | string;
}

interface SuggestionGroup {
  label: string;
  items: SuggestionItem[];
}

interface SuggestionItem {
  text: string;
  description: string;
  insertText: string;
}

// ---------------------------------------------------------------------------
// Built-in query keys
// ---------------------------------------------------------------------------

const BUILTIN_KEYS: SuggestionItem[] = [
  { text: 'service:', description: 'Filter by service name', insertText: 'service:' },
  { text: 'operation:', description: 'Filter by operation/resource', insertText: 'operation:' },
  { text: 'status:', description: 'ok or error', insertText: 'status:' },
  { text: 'duration:', description: 'Latency: >100ms, <1s, >500us', insertText: 'duration:' },
  { text: 'trace_id:', description: 'Filter by trace ID', insertText: 'trace_id:' },
  { text: 'tag:', description: 'Filter by tag: tag:env:production', insertText: 'tag:' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface QueryBarProps {
  value: string;
  onChange: (query: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  start?: number;
  end?: number;
}

export default function QueryBar({ value, onChange, onSubmit, placeholder, start, end }: QueryBarProps) {
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [tags, setTags] = useState<TagSuggestion[]>([])
  const [services, setServices] = useState<ServiceSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available tags and services for autocomplete
  const { data: tagsData } = useQuery({
    queryKey: ['apmTags', start, end],
    queryFn: () => api.getApmTags({ start, end }),
  });
  useEffect(() => {
    if (tagsData) {
      setTags(tagsData.tags || []);
      setServices(tagsData.services || []);
    }
  }, [tagsData]);

  // Determine current token being typed
  const getCurrentContext = useCallback((): { prefix: string; key: string | null } => {
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Find the last space position before cursor
    const lastSpace = textBeforeCursor.lastIndexOf(' ');
    const currentToken = textBeforeCursor.slice(lastSpace + 1);

    // Check if we're after a key: prefix
    const colonPos = currentToken.indexOf(':');
    if (colonPos >= 0 && colonPos === currentToken.length - 1 && !currentToken.slice(colonPos + 1)) {
      return { prefix: currentToken, key: currentToken.slice(0, colonPos + 1) };
    }

    return { prefix: currentToken, key: null };
  }, [value]);

  // Build suggestion list based on current context
  const allSuggestions = useMemo((): SuggestionGroup[] => {
    const { prefix, key } = getCurrentContext();

    if (!prefix && !showSuggestions) return [];

    // If typing a key name (no colon yet), suggest built-in keys
    if (key === null) {
      const matching = BUILTIN_KEYS.filter(k =>
        k.insertText.toLowerCase().startsWith(prefix.toLowerCase())
      );
      if (matching.length > 0) {
        return [{ label: 'Keys', items: matching }];
      }
      return BUILTIN_KEYS.length > 0 ? [{ label: 'Keys', items: BUILTIN_KEYS }] : [];
    }

    // After "service:", suggest service names
    if (key === 'service:') {
      const afterKey = prefix.slice('service:'.length);
      const items: SuggestionItem[] = services
        .filter(s => s.name.toLowerCase().includes(afterKey.toLowerCase()))
        .slice(0, 10)
        .map(s => ({
          text: `service:${s.name}`,
          description: `${s.cnt} requests`,
          insertText: `service:${s.name}`,
        }));
      if (items.length > 0) {
        return [{ label: 'Services', items }];
      }
    }

    // After "status:", suggest ok/error
    if (key === 'status:') {
      const afterKey = prefix.slice('status:'.length);
      const items: SuggestionItem[] = ['ok', 'error']
        .filter(s => s.startsWith(afterKey.toLowerCase()))
        .map(s => ({
          text: `status:${s}`,
          description: s === 'ok' ? 'Successful requests' : 'Failed requests (5xx)',
          insertText: `status:${s}`,
        }));
      if (items.length > 0) {
        return [{ label: 'Status', items }];
      }
    }

    // After "duration:", suggest operators
    if (key === 'duration:') {
      const afterKey = prefix.slice('duration:'.length);
      const items: SuggestionItem[] = [
        { text: 'duration:>100ms', description: 'Slower than 100ms', insertText: 'duration:>100ms' },
        { text: 'duration:>500ms', description: 'Slower than 500ms', insertText: 'duration:>500ms' },
        { text: 'duration:>1s', description: 'Slower than 1 second', insertText: 'duration:>1s' },
        { text: 'duration:<10ms', description: 'Faster than 10ms', insertText: 'duration:<10ms' },
      ].filter(s => s.insertText.toLowerCase().startsWith(prefix.toLowerCase()));
      if (items.length > 0) {
        return [{ label: 'Duration', items }];
      }
    }

    // After "tag:", suggest available tag keys
    if (key === 'tag:') {
      const afterKey = prefix.slice('tag:'.length);
      const items: SuggestionItem[] = tags
        .filter(t => t.tag_key.toLowerCase().includes(afterKey.toLowerCase()))
        .slice(0, 10)
        .map(t => ({
          text: `tag:${t.tag_key}`,
          description: `${t.cnt} occurrences`,
          insertText: `tag:${t.tag_key}`,
        }));
      if (items.length > 0) {
        return [{ label: 'Tags', items }];
      }
    }

    return [];
  }, [getCurrentContext, showSuggestions, services, tags]);

  // Filter suggestions by prefix
  const filteredSuggestions = useMemo(() => {
    return allSuggestions.filter(g => g.items.length > 0);
  }, [allSuggestions]);

  const handleSelect = (item: SuggestionItem) => {
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastSpace = textBeforeCursor.lastIndexOf(' ');
    const before = lastSpace >= 0 ? value.slice(0, lastSpace + 1) : '';
    const textAfterCursor = value.slice(cursorPos);

    const newValue = before + item.insertText + ' ' + textAfterCursor;
    onChange(newValue.trimEnd());
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const flatItems = filteredSuggestions.flatMap(g => g.items);

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
        handleSelect(flatItems[selectedIndex]);
      } else {
        onSubmit();
      }
      return;
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
      return;
    }

    if (e.key === 'Tab' && flatItems.length > 0 && selectedIndex === -1) {
      e.preventDefault();
      handleSelect(flatItems[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const flatFilteredItems = filteredSuggestions.flatMap(g => g.items);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-bg-elevated rounded-xl border border-border/60 px-4 py-2 focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20 transition-all">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" className="text-fg-tertiary shrink-0">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder || 'Search traces…  service:api  operation:GET  status:error  duration:>100ms  tag:env:prod'}
          className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary outline-none font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="text-fg-tertiary hover:text-fg-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-1 left-0 right-0 bg-bg-elevated border border-border rounded-xl shadow-elevated z-50 max-h-72 overflow-y-auto animate-slide-up"
        >
          {filteredSuggestions.map((group, gi) => (
            <div key={group.label}>
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary bg-bg-subtle/50">
                {group.label}
              </div>
              {group.items.map((item, ii) => {
                const globalIndex = filteredSuggestions.slice(0, gi).reduce((acc, g) => acc + g.items.length, 0) + ii;
                return (
                  <button
                    key={item.text}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                      selectedIndex === globalIndex ? 'bg-accent-primary/10 text-accent-primary' : 'hover:bg-bg-subtle text-fg-secondary'
                    }`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <code className="text-xs font-mono flex-1">{item.text}</code>
                    <span className="text-[10px] text-fg-tertiary">{item.description}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Active filter chips */}
      {value && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.split(/\s+/).filter(Boolean).map((token, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-accent-primary/10 text-accent-primary text-[11px] font-mono px-2 py-0.5 rounded-md border border-accent-primary">
              {token}
              <button
                onClick={() => {
                  const tokens = value.split(/\s+/).filter(Boolean);
                  tokens.splice(i, 1);
                  onChange(tokens.join(' '));
                }}
                className="text-accent-primary hover:text-accent-primary ml-0.5"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
