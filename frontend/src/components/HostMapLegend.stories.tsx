import type { Story } from '@ladle/react';
import HostMapLegend from './HostMapLegend';

export default { title: 'Business/HostMapLegend' };

export const AllOnline: Story = () => <HostMapLegend onlineCount={12} staleCount={0} offlineCount={0} />;
export const Mixed: Story = () => <HostMapLegend onlineCount={8} staleCount={3} offlineCount={1} />;
export const WithOffline: Story = () => <HostMapLegend onlineCount={5} staleCount={2} offlineCount={3} />;
export const Empty: Story = () => <HostMapLegend onlineCount={0} staleCount={0} offlineCount={0} />;
