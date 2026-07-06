// ── FlameGraph types ──

export interface FlameSpan {
  span_id: string;
  parent_span_id: string;
  service_name: string;
  operation_name: string;
  duration_us: number | string;
  span_status: string;
  status_code?: number | string;
  error_message?: string;
  [key: string]: any;
}

export interface FlameNode {
  span: FlameSpan;
  children: FlameNode[];
  depth: number;
}

export interface LayoutRect {
  x: number; y: number; w: number; h: number;
  spanId: string;
  serviceName: string;
  operationName: string;
  durationUs: number;
  isError: boolean;
  hasChildren: boolean;
  depth: number;
  color: string;
}

export interface FlameGraphProps {
  spans: FlameSpan[];
  height?: number;
  onSpanSelect?: (spanId: string) => void;
  selectedSpanId?: string | null;
}
