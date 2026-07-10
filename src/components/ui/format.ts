export const fmt = (n?: number | string): string => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
};

export const fmtNum = (n?: number | string): string => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return v != null ? v.toLocaleString() : '0';
};

export const fmtShort = (n?: number): string => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(1);
};
