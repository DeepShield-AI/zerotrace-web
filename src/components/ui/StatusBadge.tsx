export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' | 'md' }) {
  const m: Record<string, string> = {
    active: 'bg-accent-success-bg text-accent-success', paid: 'bg-accent-success-bg text-accent-success',
    open: 'bg-accent-info-bg text-accent-info', pending: 'bg-accent-warning-bg text-accent-warning',
    draft: 'bg-bg-muted text-fg-secondary', canceled: 'bg-accent-danger-bg text-accent-danger',
    error: 'bg-accent-danger-bg text-accent-danger', warning: 'bg-accent-warning-bg text-accent-warning',
    success: 'bg-accent-success-bg text-accent-success', info: 'bg-accent-info-bg text-accent-info',
    failed: 'bg-accent-danger-bg text-accent-danger', triggered: 'bg-accent-danger-bg text-accent-danger',
    resolved: 'bg-accent-success-bg text-accent-success', muted: 'bg-bg-muted text-fg-tertiary',
    critical: 'bg-accent-danger-bg text-accent-danger', healthy: 'bg-accent-success-bg text-accent-success',
  };
  const sizes = { xs: 'px-1.5 py-0 text-[10px]', sm: 'px-2.5 py-0.5 text-[11px]', md: 'px-3 py-1 text-xs' };
  return (
    <span className={`${sizes[size]} rounded-full font-semibold inline-flex items-center gap-1 ${m[status] || m.draft}`}>
      {status.toUpperCase()}
    </span>
  );
}
