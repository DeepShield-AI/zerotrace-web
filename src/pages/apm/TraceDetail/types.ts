// ── TraceDetail types ──

export interface SpanData {
  trace_id: string; span_id: string; parent_span_id: string;
  span_kind?: string; service_name: string; app_service_name?: string;
  operation_name: string; request_type: string; duration_us: number | string;
  status_code: number | string; response_status?: number | string;
  start_time: string; start_time_us?: string; end_time_us?: string;
  span_status: string; flow_id: string; request_domain?: string;
  endpoint?: string; app_instance?: string; error_message?: string;
  x_request_id_0?: string; x_request_id_1?: string;
  attribute_names?: string[]; attribute_values?: string[];
  l7_protocol?: string; biz_protocol?: string;
  syscall_trace_id_request?: number; syscall_trace_id_response?: number;
}

export interface SpanNode extends SpanData {
  children: SpanNode[]; depth: number;
}

export interface TraceData {
  trace_id: string; start_time: string | null; end_time: string | null;
  duration_us: number; root_service: string | null;
  span_count: number; error_count: number; status: string;
  services?: string[]; tag_keys?: string[]; spans: SpanData[];
}
