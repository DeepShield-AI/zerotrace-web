import type { Story } from '@ladle/react';
import { LiveIndicator, StatusDot, TimeRange } from './Indicators';

export default { title: 'UI/Indicators' };

export const LiveIndicator_Active: Story = () => <LiveIndicator active />;
export const LiveIndicator_Inactive: Story = () => <LiveIndicator active={false} />;

export const StatusDot_Online: Story = () => <StatusDot status="online" />;
export const StatusDot_OnlineMd: Story = () => <StatusDot status="online" size="md" />;
export const StatusDot_Warning: Story = () => <StatusDot status="warning" />;
export const StatusDot_Offline: Story = () => <StatusDot status="offline" />;
export const StatusDot_Error: Story = () => <StatusDot status="error" />;

export const TimeRange_Default: Story = () => (
  <TimeRange
    value="1h"
    onChange={() => {}}
    options={[
      { key: '5m', label: '5m' },
      { key: '15m', label: '15m' },
      { key: '1h', label: '1h' },
      { key: '4h', label: '4h' },
    ]}
  />
);
