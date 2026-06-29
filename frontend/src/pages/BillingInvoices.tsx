import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

interface Invoice {
  id: number; period_start: string; period_end: string;
  subtotal: string; discount: string; total: string;
  currency: string; status: string; issued_at: string | null; created_at: string;
}
interface LineItem {
  id: number; product_key: string; description: string;
  commitment_quantity: string; commitment_unit_price: string; commitment_total: string;
  overage_quantity: string; overage_unit_price: string; overage_total: string;
  line_total: string;
}

function formatCurrency(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return '$' + n.toFixed(2);
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    paid: 'bg-[#c8e6c9] text-emerald-700',
    open: 'bg-blue-100 text-blue-700',
    draft: 'bg-[#f1f3f5] text-[#495057]',
    void: 'bg-[#ffcdd2] text-[#dc3545]',
  };
  return `px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${map[status] || map.draft}`;
};

export default function BillingInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBillingInvoices();
      setInvoices(data.invoices || []);
    } catch { /* ignored */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const loadDetail = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setDetailLoading(true);
    try {
      const data = await api.getBillingInvoiceDetail(inv.id);
      setLineItems(data.line_items || []);
    } catch { /* ignored */ } finally { setDetailLoading(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-8 w-8 border-2 border-[#007bff] border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold text-[#212529] mb-1">Invoices</h2>
      <p className="text-sm text-[#6c757d] mb-6">View and download your billing invoices</p>

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-[#6c757d]">No invoices yet</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice List */}
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {invoices.map(inv => (
              <button key={inv.id} onClick={() => loadDetail(inv)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedInvoice?.id === inv.id
                    ? 'border-[#007bff] ring-2 ring-[#cce5ff] bg-[#f0f7ff]/30'
                    : 'border-[#dee2e6] bg-white hover:border-gray-300'
                }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#6c757d] font-mono">{inv.period_start} – {inv.period_end}</span>
                  <span className={statusBadge(inv.status)}>{inv.status.toUpperCase()}</span>
                </div>
                <p className="text-lg font-bold text-[#212529]">{formatCurrency(inv.total)}</p>
                <p className="text-[11px] text-[#6c757d] mt-1">
                  {inv.issued_at ? `Issued ${new Date(inv.issued_at).toLocaleDateString()}` : 'Draft — not yet issued'}
                </p>
              </button>
            ))}
          </div>

          {/* Invoice Detail */}
          <div className="lg:col-span-2 min-h-[400px]">
            {!selectedInvoice ? (
              <div className="flex items-center justify-center h-full bg-white border border-[#dee2e6] rounded-lg">
                <p className="text-[#dee2e6] text-sm">Select an invoice to view details</p>
              </div>
            ) : detailLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin h-6 w-6 border-2 border-[#007bff] border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="bg-white border border-[#dee2e6] rounded-lg p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#212529]">Invoice #{selectedInvoice.id}</h3>
                    <p className="text-xs text-[#6c757d] mt-0.5">{selectedInvoice.period_start} – {selectedInvoice.period_end}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#212529]">{formatCurrency(selectedInvoice.total)}</p>
                    <span className={statusBadge(selectedInvoice.status)}>{selectedInvoice.status.toUpperCase()}</span>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#dee2e6] text-left text-[11px] font-semibold text-[#6c757d] uppercase tracking-wider">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium text-right">Commitment</th>
                      <th className="pb-3 font-medium text-right">Overage</th>
                      <th className="pb-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map(item => {
                      const commitQty = parseFloat(item.commitment_quantity);
                      const overQty = parseFloat(item.overage_quantity);
                      return (
                        <tr key={item.id} className="border-b border-[#f1f3f5]">
                          <td className="py-3">
                            <p className="font-medium text-[#212529] capitalize">{item.product_key.replace(/_/g, ' ')}</p>
                            <p className="text-[11px] text-[#6c757d]">{item.description}</p>
                          </td>
                          <td className="py-3 text-right">
                            {commitQty > 0 ? (
                              <>
                                <p className="font-medium text-[#495057]">{formatCurrency(item.commitment_total)}</p>
                                <p className="text-[11px] text-[#6c757d]">{commitQty.toLocaleString()} × {formatCurrency(item.commitment_unit_price)}</p>
                              </>
                            ) : <span className="text-[#dee2e6]">—</span>}
                          </td>
                          <td className="py-3 text-right">
                            {overQty > 0 ? (
                              <>
                                <p className="font-medium text-[#e67e22]">{formatCurrency(item.overage_total)}</p>
                                <p className="text-[11px] text-[#6c757d]">{overQty.toLocaleString()} × {formatCurrency(item.overage_unit_price)}</p>
                              </>
                            ) : <span className="text-[#dee2e6]">—</span>}
                          </td>
                          <td className="py-3 text-right font-semibold text-[#212529]">{formatCurrency(item.line_total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#dee2e6]">
                      <td colSpan={3} className="pt-3 text-right text-sm text-[#6c757d]">Subtotal</td>
                      <td className="pt-3 text-right text-sm font-bold text-[#212529]">{formatCurrency(selectedInvoice.subtotal)}</td>
                    </tr>
                    {parseFloat(selectedInvoice.discount) > 0 && (
                      <tr>
                        <td colSpan={3} className="text-right text-sm text-[#28a745]">Discount</td>
                        <td className="text-right text-sm font-medium text-[#28a745]">-{formatCurrency(selectedInvoice.discount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="pt-2 text-right text-base font-semibold text-[#212529]">Total</td>
                      <td className="pt-2 text-right text-base font-bold text-[#212529]">{formatCurrency(selectedInvoice.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
