import React from 'react';
import { Table, Input, Button, Tag, Select, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';

interface TracesExplorerProps {
  services: any[];
  traces: any[];
  tracesTotal: number;
  okTotal: number;
  errorTotal: number;
  trState: string;
  trError: string | null;
  latencyHistogram?: any;
  query: string;
  onQueryChange: (q: string) => void;
  onTracesRefresh: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  tagKeys: string[];
  facetStatus: string;
  facetService: string;
  facetDuration: string;
  onFacetStatusChange: (s: string) => void;
  onFacetServiceChange: (s: string) => void;
  onFacetDurationChange: (q: string) => void;
  timeRange: any;
  onTimeRangeChange: (r: any) => void;
}

const TracesExplorer: React.FC<TracesExplorerProps> = ({
  traces,
  tracesTotal,
  okTotal,
  errorTotal,
  trState,
  query,
  onQueryChange,
  onTracesRefresh,
  onLoadMore,
  hasMore,
  services,
  facetStatus,
  facetService,
  facetDuration,
  onFacetStatusChange,
  onFacetServiceChange,
  onFacetDurationChange,
}) => {
  const columns = [
    {
      title: 'Trace ID',
      dataIndex: 'trace_id',
      key: 'trace_id',
      render: (id: string) => <span className="font-mono text-xs">{id?.slice(0, 16)}…</span>,
    },
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
      render: (s: string) => <Tag color="blue">{s}</Tag>,
    },
    {
      title: 'Operation',
      dataIndex: 'operation',
      key: 'operation',
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      render: (d: number) => d != null ? `${d.toFixed(1)}ms` : '-',
      sorter: (a: any, b: any) => (a.duration_ms || 0) - (b.duration_ms || 0),
    },
    {
      title: 'Status',
      dataIndex: 'status_code',
      key: 'status_code',
      render: (s: number) => (
        <Tag color={s === 0 ? 'green' : 'red'}>{s === 0 ? 'OK' : 'ERROR'}</Tag>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Facets */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select
          value={facetStatus || undefined}
          onChange={onFacetStatusChange}
          placeholder="Status"
          allowClear
          style={{ width: 120 }}
          options={[
            { label: 'OK', value: 'ok' },
            { label: 'Error', value: 'error' },
          ]}
        />
        <Select
          value={facetService || undefined}
          onChange={onFacetServiceChange}
          placeholder="Service"
          allowClear
          style={{ width: 180 }}
          options={services.map((s: any) => ({ label: s.service_name || s, value: s.service_name || s }))}
        />
        <Select
          value={facetDuration || undefined}
          onChange={onFacetDurationChange}
          placeholder="Duration"
          allowClear
          style={{ width: 140 }}
          options={[
            { label: '< 100ms', value: 'lt100' },
            { label: '100ms - 1s', value: '100to1000' },
            { label: '> 1s', value: 'gt1000' },
          ]}
        />
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search traces..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={onTracesRefresh}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span>Total: <strong>{tracesTotal}</strong></span>
        <span className="text-green-500">OK: <strong>{okTotal}</strong></span>
        <span className="text-red-500">Errors: <strong>{errorTotal}</strong></span>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={traces}
        rowKey="trace_id"
        loading={trState === 'loading'}
        pagination={false}
        size="small"
      />

      {hasMore && (
        <div className="text-center">
          <Button onClick={onLoadMore} loading={trState === 'loading'}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};

export default TracesExplorer;
