import { useState } from 'react';

// ── Types ──────────────────────────────────────────────

export interface ModifyFunction {
  name: string;
  description: string;
  params?: { label: string; options: string[] }[];
}

export interface ModifyCategory {
  key: string;
  label: string;
  description: string;
  functions: ModifyFunction[];
}

// ── All Modify categories with their functions ──────────

export const MODIFY_CATEGORIES: ModifyCategory[] = [
  {
    key: 'arithmetic', label: 'Arithmetic',
    description: 'Apply mathematical functions to transform metric values.',
    functions: [
      { name: 'Absolute value', description: 'Convert all values to their absolute (non-negative) magnitude.' },
      { name: 'Log 2', description: 'Apply base-2 logarithm. Useful for compressing wide value ranges.' },
      { name: 'Log 10', description: 'Apply base-10 logarithm. Commonly used for request counts and byte sizes.' },
      { name: 'Cumulative sum', description: 'Running total across the time window. Each point is the sum of all previous values.' },
      { name: 'Power', description: 'Raise each value to the specified exponent.', params: [{ label: 'Exponent', options: ['2', '3', '4', '0.5'] }] },
      { name: 'Integral', description: 'Compute the area under the curve over time. Useful for converting rates back to totals.' },
    ],
  },
  {
    key: 'interpolation', label: 'Interpolation',
    description: 'Fill missing data points to create a continuous time series.',
    functions: [
      { name: 'Linear', description: 'Draw a straight line between known data points to fill gaps.' },
      { name: 'Step', description: 'Hold the last known value until the next data point (staircase pattern).' },
      { name: 'Previous', description: 'Fill gaps with the most recent non-null value (forward fill).' },
      { name: 'Next', description: 'Fill gaps with the next non-null value (backward fill).' },
      { name: 'Zero', description: 'Replace all missing values with zero. Simple but can create misleading drops.' },
    ],
  },
  {
    key: 'timeshift', label: 'Timeshift',
    description: 'Shift the time series to compare current vs historical behavior.',
    functions: [
      { name: 'Timeshift', description: 'Offset the entire series by a fixed duration. Overlay with the original to compare week-over-week or day-over-day trends.', params: [{ label: 'Offset', options: ['1 hour', '1 day', '1 week', '1 month', 'Custom'] }] },
    ],
  },
  {
    key: 'rate', label: 'Rate',
    description: 'Convert cumulative counters to per-second (or per-interval) rates.',
    functions: [
      { name: 'Per second', description: 'Compute the per-second rate of change. Standard for counter metrics.' },
      { name: 'Per minute', description: 'Compute the per-minute rate of change. Easier to read for slow-changing metrics.' },
      { name: 'Per hour', description: 'Compute the per-hour rate. Useful for low-frequency business metrics.' },
      { name: 'Per day', description: 'Compute the daily rate of change. Best for daily-aggregated data.' },
    ],
  },
  {
    key: 'smoothing', label: 'Smoothing',
    description: 'Reduce noise and highlight trends by averaging neighboring points.',
    functions: [
      { name: 'Moving average', description: 'Simple sliding window average. Wider windows produce smoother curves but add lag.', params: [{ label: 'Window', options: ['1 min', '5 min', '15 min', '1 hour', 'Auto'] }] },
      { name: 'Exponential moving average', description: 'Weighted average favoring recent points. Responds faster to changes than simple moving average.', params: [{ label: 'Alpha', options: ['0.1', '0.3', '0.5', '0.7', '0.9'] }] },
      { name: 'Gaussian', description: 'Apply a Gaussian kernel for smooth, bell-curve-weighted averaging.' },
    ],
  },
  {
    key: 'rollup', label: 'Rollup',
    description: 'Aggregate raw data points into fixed time intervals before graphing.',
    functions: [
      { name: 'Average (avg)', description: 'Mean of all points in each interval. Best for typical-value analysis.' },
      { name: 'Sum', description: 'Total of all points in each interval. Use for counter and throughput metrics.' },
      { name: 'Minimum', description: 'Lowest value in each interval. Highlights best-case performance.' },
      { name: 'Maximum', description: 'Highest value in each interval. Exposes worst-case spikes.' },
      { name: 'Count', description: 'Number of data points in each interval. Helps detect reporting gaps.' },
      { name: 'Median (P50)', description: '50th percentile. More robust than average against outliers.' },
      { name: 'P75', description: '75th percentile — upper quartile of values in each interval.' },
      { name: 'P90', description: '90th percentile. Common SLO target for latency metrics.' },
      { name: 'P95', description: '95th percentile. Standard for API latency monitoring.' },
      { name: 'P99', description: '99th percentile. Captures tail latency — the worst 1% of user experiences.' },
    ],
  },
  {
    key: 'groupby', label: 'Group By',
    description: 'Split a single metric into multiple series based on tag values.',
    functions: [
      { name: 'host', description: 'Create one line per host. Compare CPU/memory across your fleet.' },
      { name: 'service', description: 'Create one line per service. Break down request rates by microservice.' },
      { name: 'environment', description: 'Create one line per environment (prod, staging, dev).' },
      { name: 'region', description: 'Create one line per cloud region. Identify regional performance differences.' },
      { name: 'availability-zone', description: 'Create one line per AZ. Monitor zone-level health.' },
      { name: 'pod', description: 'Create one line per Kubernetes pod. Useful for containerized workloads.' },
      { name: 'Custom tag...', description: 'Group by any custom tag on this metric. Type the tag key to use it.' },
    ],
  },
  {
    key: 'rank', label: 'Rank',
    description: 'Filter to show only the top or bottom N series by value.',
    functions: [
      { name: 'Top N', description: 'Keep only the N series with the highest values. Reduces chart clutter when many hosts/services are reporting.', params: [{ label: 'N', options: ['3', '5', '10', '20', '50'] }] },
      { name: 'Bottom N', description: 'Keep only the N series with the lowest values. Useful for finding under-utilized resources.', params: [{ label: 'N', options: ['3', '5', '10', '20', '50'] }] },
      { name: 'Percentile rank', description: 'Assign each series a percentile rank based on its current value.' },
    ],
  },
  {
    key: 'count', label: 'Count',
    description: 'Count data points or events matching specific criteria.',
    functions: [
      { name: 'Count non-null values', description: 'Count the number of real (non-null) data points in each interval.' },
      { name: 'Count zero crossings', description: 'Count how many times the signal crosses zero. Useful for oscillation detection.' },
      { name: 'Count anomalies', description: 'Count the number of data points flagged as anomalous per interval.' },
    ],
  },
  {
    key: 'regression', label: 'Regression',
    description: 'Fit trend lines and project future values from historical data.',
    functions: [
      { name: 'Linear regression', description: 'Fit a straight trend line through the data. Shows the overall direction (up/down/flat).' },
      { name: 'Polynomial regression', description: 'Fit a curved trend line. Captures acceleration or deceleration patterns.', params: [{ label: 'Degree', options: ['2', '3', '4'] }] },
      { name: 'Forecast', description: 'Project the trend forward to predict future values. Uses linear extrapolation with confidence bands.', params: [{ label: 'Horizon', options: ['1 hour', '6 hours', '1 day', '1 week'] }] },
    ],
  },
  {
    key: 'algorithms', label: 'Algorithms',
    description: 'Apply detection algorithms to find patterns, anomalies, and structural changes.',
    functions: [
      { name: 'Anomaly detection', description: 'Flag points that deviate significantly from the expected range. Uses mean ± N×standard deviation bands with configurable sensitivity.', params: [{ label: 'Sensitivity', options: ['Low', 'Medium', 'High'] }] },
      { name: 'Outlier detection', description: 'Identify individual extreme values using interquartile range (IQR). More robust than standard deviation for skewed data.', params: [{ label: 'Sensitivity', options: ['Low', 'Medium', 'High'] }] },
      { name: 'Change point detection', description: 'Detect points in time where the statistical properties of the series shift (mean shift, variance change).' },
      { name: 'Seasonal decomposition', description: 'Separate the time series into trend, seasonal, and residual components for analysis.' },
    ],
  },
  {
    key: 'exclusion', label: 'Exclusion',
    description: 'Remove unwanted data points or series from the visualization.',
    functions: [
      { name: 'Exclude null values', description: 'Remove data points with null, undefined, or NaN values from the series.' },
      { name: 'Exclude outliers', description: 'Remove points outside the interquartile range (Q1−1.5×IQR to Q3+1.5×IQR).' },
      { name: 'Exclude by tag', description: 'Filter out series matching a specific tag value (e.g., exclude a noisy test host).', params: [{ label: 'Tag', options: ['host:web-01', 'env:staging', 'region:us-east-1'] }] },
      { name: 'Exclude below threshold', description: 'Remove all data points whose value falls below the given threshold.', params: [{ label: 'Threshold', options: ['0', '1', '5', '10', '100'] }] },
      { name: 'Exclude above threshold', description: 'Remove all data points whose value exceeds the given threshold (spike removal).', params: [{ label: 'Threshold', options: ['90', '95', '99', '100'] }] },
    ],
  },
];

// ── Component ─────────────────────────────────────────────

export default function ModifyMenu({ onSelect, onClose }: {
  onSelect: (cat: string, fn: string, params?: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [activeCat, setActiveCat] = useState<string>('arithmetic');
  const [hoveredFn, setHoveredFn] = useState<string | null>(null);

  const category = MODIFY_CATEGORIES.find(c => c.key === activeCat);
  const hovered = hoveredFn ? category?.functions.find(f => f.name === hoveredFn) : null;

  return (
    <div className="absolute top-full mt-1 left-0 bg-bg-elevated border border-border rounded-lg shadow-2xl z-50 flex" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
      {/* ── Left: Category list ── */}
      <div className="w-[170px] border-r border-border-subtle py-1 shrink-0">
        <div className="px-3 py-1.5 border-b border-border-subtle">
          <input placeholder="Search functions" className="w-full text-[11px] px-2 py-1 border border-border rounded bg-bg-elevated focus:outline-none focus:border-accent-primary" />
        </div>
        {MODIFY_CATEGORIES.map(c => (
          <button key={c.key}
            onClick={() => { setActiveCat(c.key); setHoveredFn(null); }}
            onMouseEnter={() => setActiveCat(c.key)}
            className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between transition-colors ${
              activeCat === c.key ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-fg-secondary hover:bg-bg-subtle'
            }`}>
            {c.label}
            <span className="text-[10px] text-fg-tertiary">›</span>
          </button>
        ))}
      </div>

      {/* ── Middle: Functions ── */}
      <div className="w-[190px] border-r border-border-subtle py-1 shrink-0">
        <div className="px-3 py-1 text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider border-b border-border-subtle mb-0.5">
          Functions
        </div>
        {category?.functions.map(fn => (
          <button key={fn.name}
            onClick={() => onSelect(activeCat, fn.name, fn.params ? Object.fromEntries(fn.params.map(p => [p.label, p.options[0]])) : undefined)}
            onMouseEnter={() => setHoveredFn(fn.name)}
            onMouseLeave={() => setHoveredFn(null)}
            className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
              hoveredFn === fn.name
                ? 'bg-accent-primary/5 text-fg-primary'
                : 'text-fg-secondary hover:bg-bg-subtle hover:text-fg-primary'
            }`}>
            {fn.name}
            {fn.params && fn.params.length > 0 && (
              <div className="flex gap-1 mt-0.5">
                {fn.params.map(p => (
                  <span key={p.label} className="text-[10px] text-fg-tertiary bg-bg-muted px-1.5 py-0.5 rounded">{p.label}: {p.options[0]}</span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ── Right: Description panel (category or hovered function) ── */}
      <div className="flex-1 py-3 px-4 min-w-0">
        {hovered ? (
          <>
            <div className="text-[11px] font-semibold text-fg-primary mb-1">{hovered.name}</div>
            <p className="text-[11px] text-fg-tertiary leading-relaxed">{hovered.description}</p>
            {hovered.params && hovered.params.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border-subtle">
                <div className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1">Parameters</div>
                {hovered.params.map(p => (
                  <div key={p.label} className="flex items-center gap-1.5 text-[11px] mt-0.5">
                    <span className="text-fg-secondary font-medium">{p.label}</span>
                    <span className="text-fg-tertiary">—</span>
                    <span className="text-fg-tertiary">{p.options.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-[11px] font-semibold text-fg-primary mb-1">{category?.label}</div>
            <p className="text-[11px] text-fg-tertiary leading-relaxed">{category?.description}</p>
            {category && category.functions.length > 0 && (
              <p className="text-[10px] text-fg-tertiary/60 mt-2">Hover over a function to see details</p>
            )}
          </>
        )}
      </div>

      {/* Close button */}
      <button onClick={onClose} className="absolute top-2 right-2 text-fg-tertiary hover:text-fg-secondary text-sm">✕</button>
    </div>
  );
}
