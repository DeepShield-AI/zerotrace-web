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

export interface OverlaySeries {
  metric: MetricDef;
  points: MetricPoint[];
  color: string;
}
