/* ---------------------------------------------------------------------------
 * Shared API types — single source of truth for typed API responses
 * --------------------------------------------------------------------------- */

/** Agent/host record from the infrastructure data endpoint. */
export interface AgentItem {
  ID: number;
  NAME: string;
  CTRL_IP: string;
  STATE: number;
  SYNCED_CONTROLLER_AT: string;
}

/** L4 (transport-layer) aggregate stats. */
export interface L4Stats {
  cnt: number;
  tx: number;
  rx: number;
}

/** L7 (application-layer) aggregate stats. */
export interface L7Stats {
  cnt: number;
  avg_latency?: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

/** A top-N L7 endpoint entry. */
export interface TopEndpoint {
  name: string;
  cnt: number;
  avg_latency?: number;
}

/** A top-N L4 talker (src → dst pair). */
export interface TopTalker {
  src: string;
  dst: string;
  cnt: number;
}

/** A single flow-rate timeseries point. */
export interface FlowRatePoint {
  ts: string;
  cnt: number;
}

/** A single L4 bandwidth timeseries point (tx/rx bytes). */
export interface L4BandwidthPoint {
  ts: string;
  tx: number;
  rx: number;
}

/** A single L7 request-rate timeseries point. */
export interface L7RatePoint {
  ts: string;
  cnt: number;
}

/** Full response shape of GET /data/overview. */
export interface DataOverviewResponse {
  agents: { list: AgentItem[]; online: number };
  l4_stats: L4Stats[];
  l7_stats: L7Stats[];
  top_l7: TopEndpoint[];
  top_l4: TopTalker[];
  flow_rate: FlowRatePoint[];
  l4_bandwidth: L4BandwidthPoint[];
  l7_rate: L7RatePoint[];
}
