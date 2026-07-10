import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id?: number | string }>({
  columns, rows, onRowClick, emptyMessage = 'No data',
}: {
  columns: Column<T>[]; rows: T[]; onRowClick?: (row: T) => void; emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider">
            {columns.map(col => (
              <th key={col.key} className={`py-2 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                style={col.width ? { width: col.width } : {}}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-16 text-center text-fg-disabled text-sm">{emptyMessage}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
                className={`border-b border-border-subtle ${onRowClick ? 'cursor-pointer hover:bg-bg-subtle/50 transition-colors' : ''}`}>
                {columns.map(col => (
                  <td key={col.key} className={`py-2.5 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
