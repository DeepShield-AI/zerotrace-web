/* ---------------------------------------------------------------------------
 * Shared formatting utilities — single source of truth for all pages/components
 * --------------------------------------------------------------------------- */

/** Coerce a value to number; returns 0 for undefined/null/NaN. */
export function num(v: number | string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

/**
 * Format a count/number into a human-readable short form.
 *   - >= 1M → "1.2M"
 *   - >= 1K → "3.5K"
 *   - otherwise → raw string (or '--' when falsy and not zero)
 */
export function fmtN(n?: number | string | null): string {
  const v = num(n);
  if (!n && n !== 0) return '--';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(n);
}

/**
 * Format bytes into human-readable form.
 *   - >= 1 GB → "1.2 GB"
 *   - >= 1 MB → "3.5 MB"
 *   - >= 1 KB → "8.0 KB"
 *   - otherwise → "512 B" (or '--' when falsy and not zero)
 */
export function fmtB(n?: number | string | null): string {
  const v = num(n);
  if (!n && n !== 0) return '--';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + ' GB';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' MB';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' KB';
  return v + ' B';
}

/**
 * Format latency in milliseconds.
 *   - >= 1000ms → "1.25s"
 *   - >= 1ms    → "42ms"
 *   - < 1ms     → "350μs"
 */
export function fmtLatency(n?: number | string | null): string {
  const v = num(n);
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return Math.round(v) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}

/**
 * Format duration from microseconds.
 *   - >= 1M μs (1s) → "1.25s"
 *   - >= 1K μs (1ms) → "42ms"
 *   - < 1ms → "350μs"
 */
export function fmtDurationUs(us?: number | string | null): string {
  const v = num(us) / 1000; // μs → ms
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return v.toFixed(0) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}

/** Return "HH:MM" portion of an ISO-ish timestamp. */
export function tsLabel(ts: string): string {
  return ts ? ts.slice(11, 16) : '';
}

/**
 * Human-readable relative time ("3m ago", "just now", etc.).
 * Accepts ISO strings (with or without 'Z'), space-separated timestamps,
 * or a numeric epoch in ms.
 */
export function ago(ts: string | number | null | undefined): string {
  if (!ts) return '';
  try {
    let d: number;
    if (typeof ts === 'number') {
      d = Date.now() - ts;
    } else {
      // Handle various timestamp formats
      const normalized = ts.includes('Z') ? ts : ts.includes('T') ? ts + 'Z' : ts.replace(' ', 'T') + 'Z';
      d = Date.now() - new Date(normalized).getTime();
    }
    if (isNaN(d)) return '';
    const m = Math.floor(Math.abs(d) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  } catch {
    return '';
  }
}

/* ---------------------------------------------------------------------------
 * Agent status helpers
 * --------------------------------------------------------------------------- */

export interface AgentLike {
  STATE: number;
  SYNCED_CONTROLLER_AT?: string | null;
}

/** Agent is online when STATE=1 and last controller sync was < 5 min ago.
 *  DB stores UTC timestamps without timezone — we append 'Z' so JS parses as UTC.
 *  Matches AgentSetup.tsx stale threshold (5 min). */
export function isOnline(a: AgentLike): boolean {
  if (a.STATE !== 1) return false;
  const synced = a.SYNCED_CONTROLLER_AT;
  if (!synced) return false;
  try {
    // Parse as UTC (append 'Z' — consistent with AgentSetup.asUtc)
    const d = new Date(synced.includes('Z') || synced.includes('+') ? synced : synced + 'Z');
    if (isNaN(d.getTime())) return false;
    const age = Date.now() - d.getTime();
    return Math.abs(age) < 5 * 60_000; // 5 min threshold matches AgentSetup
  } catch {
    return false;
  }
}

/** Agent is stale when STATE=1 but last controller sync was > 5 min ago. */
export function isStale(a: AgentLike): boolean {
  if (a.STATE !== 1) return false;
  return !isOnline(a);
}

export type AgentStatus = 'online' | 'stale' | 'offline';

export function agentStatus(a: AgentLike): AgentStatus {
  if (isOnline(a)) return 'online';
  if (isStale(a)) return 'stale';
  return 'offline';
}

export function agentStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'online': return '#41c464';   // severity-ok
    case 'stale': return '#deab3e';    // severity-warn
    case 'offline': return '#eb364b';   // severity-alert
  }
}

export function agentStatusLabel(status: AgentStatus): string {
  switch (status) {
    case 'online': return 'Online';
    case 'stale': return 'Stale';
    case 'offline': return 'Offline';
  }
}
