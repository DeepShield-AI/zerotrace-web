import type { Story } from '@ladle/react';
import { Table, TableSkeleton, MetricCard, Badge, EmptyState, SearchInput, Button } from './Table';

export default { title: 'UI/Table' };

// ── Table ─────────────────────────────────────────
const columns = [
  { key: 'name', label: 'Name', render: (r: any) => <span>{r.name}</span> },
  { key: 'status', label: 'Status', render: (r: any) => r.status },
];
const rows = [
  { name: 'api-gateway', status: 'ok' },
  { name: 'billing-svc', status: 'error' },
  { name: 'user-svc', status: 'ok' },
];

export const Table_Default: Story = () => <Table columns={columns} data={rows} rowKey={(r) => r.name} />;
export const Table_Loading: Story = () => <Table columns={columns} data={[]} loading rowKey={(r) => r.name} />;
export const Table_Empty: Story = () => <Table columns={columns} data={[]} emptyTitle="No data" emptyDesc="Nothing to show" rowKey={(r) => r.name} />;

export const Skeleton: Story = () => <TableSkeleton cols={4} rows={6} />;

// ── MetricCard ────────────────────────────────────
export const MetricCard_Default: Story = () => <MetricCard label="Requests" value="12,345" sub="+5.2% from last hour" />;
export const MetricCard_WithColor: Story = () => <MetricCard label="Error Rate" value="3.8%" sub="Above threshold" color="#e65c5c" />;

// ── Badge ─────────────────────────────────────────
export const Badge_Success: Story = () => <Badge label="Active" variant="success" />;
export const Badge_Warning: Story = () => <Badge label="Degraded" variant="warning" />;
export const Badge_Error: Story = () => <Badge label="Failed" variant="error" />;
export const Badge_Purple: Story = () => <Badge label="New" variant="purple" />;
export const Badge_Default: Story = () => <Badge label="Normal" variant="default" />;

// ── EmptyState ────────────────────────────────────
export const EmptyState_Search: Story = () => <EmptyState icon="search" title="No results" description="Try adjusting your filters" />;
export const EmptyState_Box: Story = () => <EmptyState icon="box" title="No items" description="Create your first item to get started" />;
export const EmptyState_Check: Story = () => <EmptyState icon="check" title="All clear" description="No issues detected" />;

// ── SearchInput ───────────────────────────────────
export const SearchInput_Default: Story = () => <SearchInput value="" onChange={() => {}} placeholder="Search..." />;
export const SearchInput_Filled: Story = () => <SearchInput value="api-gateway" onChange={() => {}} />;

// ── Button ────────────────────────────────────────
export const Button_Primary: Story = () => <Button label="Save" variant="primary" />;
export const Button_Default: Story = () => <Button label="Cancel" variant="default" />;
export const Button_Ghost: Story = () => <Button label="More" variant="ghost" />;
export const Button_Small: Story = () => <Button label="Export" size="sm" variant="default" />;
