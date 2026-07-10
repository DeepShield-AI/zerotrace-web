import type { Story } from '@ladle/react';
import StatCard from './StatCard';

export default { title: 'UI/StatCard' };

const sparkline = [12, 18, 15, 22, 19, 25, 21, 28, 24, 30, 27, 32, 29, 35, 31, 38, 34, 40, 37, 42];

export const Default: Story = () => <StatCard label="CPU Usage" value="42.3%" color="var(--accent-primary)" />;

export const WithSparkline: Story = () => <StatCard label="CPU Usage" value="42.3%" color="var(--accent-primary)" sparkline={sparkline} />;

export const SubText: Story = () => <StatCard label="Requests" value="12.5K" sub="+5.2% vs last hour" color="var(--accent-info)" />;

export const Info: Story = () => <StatCard label="Disk Free" value="234 GB" color="var(--accent-info)" />;

export const Success: Story = () => <StatCard label="Uptime" value="99.97%" color="var(--accent-success)" />;

export const Warning: Story = () => <StatCard label="Error Rate" value="3.2%" color="var(--accent-warning)" />;

export const Empty: Story = () => <StatCard label="No Data" value="--" color="var(--fg-tertiary)" />;
