// ── Metrics page types ──

export interface MetricDef {
  name: string;
  display_name: string;
  type: string;
  unit: string;
  description: string;
  category: string;
}

export interface MetricPoint {
  ts: string;
  value: number;
}

export interface DistributionItem {
  label: string;
  value: number;
  pct: number;
}

export interface TopListItem {
  label: string;
  value: number;
  pct: number;
}
