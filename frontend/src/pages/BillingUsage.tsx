import { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';

interface HourlyPoint { hour: string; quantity: string; }
interface UsageProduct { product_key: string; total_quantity: string; hourly_count: number; }

const fmtShort = (n?: number): string => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

export default function BillingUsage() {
  const [usage, setUsage] = useState<UsageProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [hourlyData, setHourlyData] = useState<HourlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.getBillingUsage()
      .then(r => {
        const prods = r.products || [];
        setUsage(prods);
        if (prods.length > 0) setSelectedProduct(prods[0].product_key);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    setChartLoading(true);
    api.getBillingHourlyUsage(selectedProduct)
      .then(r => setHourlyData(r.records || []))
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [selectedProduct]);

  const quantities = useMemo(() => hourlyData.map(d => parseFloat(d.quantity) || 0), [hourlyData]);
  const stats = useMemo(() => {
    const total = quantities.reduce((a, b) => a + b, 0);
    const max = Math.max(...quantities, 0);
    const avg = quantities.length ? total / quantities.length : 0;
    const min = Math.min(...quantities, 0);
    const sorted = [...quantities].sort((a, b) => a - b);
    const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] || max : 0;
    return { total, max, avg, min, p99, count: quantities.length };
  }, [quantities]);

  const displayData = showAll ? hourlyData : hourlyData.slice(-48);
  const barMax = Math.max(...displayData.map(d => parseFloat(d.quantity) || 0), 1);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-8 w-8 border-2 border-[#007bff] border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#212529]">Hourly Usage</h2>
        <p className="text-sm text-[#6c757d] mt-1">Monitor per-hour usage by product — identify peaks and track consumption patterns</p>
      </div>

      {/* Product pills */}
      <div className="flex flex-wrap gap-2">
        {usage.map(p => {
          const total = parseFloat(p.total_quantity) || 0;
          return (
            <button key={p.product_key} onClick={() => setSelectedProduct(p.product_key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedProduct === p.product_key
                  ? 'bg-[#007bff] text-white shadow-md'
                  : 'bg-white border border-[#dee2e6] text-[#495057] hover:border-gray-300 hover:bg-[#f8f9fa]'
              }`}>
              {p.product_key}
              <span className={`ml-1.5 text-xs ${selectedProduct === p.product_key ? 'text-white/70' : 'text-[#6c757d]'}`}>
                {fmtShort(total)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Usage', value: fmtShort(stats.total), color: 'text-[#007bff]' },
          { label: 'Peak', value: fmtShort(stats.max), color: 'text-[#e67e22]' },
          { label: '99th %ile', value: fmtShort(stats.p99), color: 'text-[#6f42c1]' },
          { label: 'Average', value: fmtShort(stats.avg), color: 'text-blue-600' },
          { label: 'Data Points', value: String(stats.count), color: 'text-[#495057]' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#dee2e6] rounded-lg p-4">
            <p className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wider">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-white border border-[#dee2e6] rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-[#495057]">{selectedProduct} — Hourly Usage Chart</h3>
          <button onClick={() => setShowAll(!showAll)}
            className="text-xs text-[#007bff] hover:text-[#0056b3] font-medium">
            {showAll ? 'Show last 48 hours' : 'Show all'}
          </button>
        </div>

        {chartLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-[#007bff] border-t-transparent rounded-full" />
          </div>
        ) : displayData.length === 0 ? (
          <div className="text-center py-16 text-[#dee2e6]">No hourly usage data available for {selectedProduct}</div>
        ) : (
          <>
            <div className="flex items-end gap-[2px] h-48 overflow-x-auto pb-6">
              {displayData.map((d, i) => {
                const qty = parseFloat(d.quantity) || 0;
                const h = Math.max((qty / barMax) * 100, 2);
                const isPeak = qty === stats.max && stats.max > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-[8px] relative group"
                    title={`${d.hour}: ${qty.toLocaleString()}`}>
                    <div className={`absolute -top-5 text-[9px] font-mono text-[#6c757d] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>
                      {qty.toLocaleString()}
                    </div>
                    <div className={`w-full rounded-t-sm transition-all hover:opacity-80 flex-shrink-0 ${isPeak ? 'bg-amber-400' : 'bg-[#f0f7ff]0'}`}
                      style={{ height: `${h}%` }} />
                    {(i % 6 === 0 || i === displayData.length - 1) && (
                      <span className="text-[9px] text-[#6c757d] mt-1.5 whitespace-nowrap tabular-nums">
                        {new Date(d.hour + 'Z').getUTCHours().toString().padStart(2, '0')}:00
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-6 text-xs text-[#6c757d] pt-4 border-t border-[#dee2e6]">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#f0f7ff]0" /> Normal</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-400" /> Peak ({fmtShort(stats.max)})</div>
              <span className="ml-auto">Showing {displayData.length} of {hourlyData.length} data points</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
