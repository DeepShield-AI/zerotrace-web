import type { Story } from '@ladle/react';
import MiniSparkline from './MiniSparkline';

export default { title: 'UI/MiniSparkline' };

const data = [12, 18, 15, 22, 19, 25, 21, 28, 24, 30, 27, 32, 29, 35, 31, 38, 34, 40, 37, 42, 39, 44, 41, 45];

export const Default: Story = () => <MiniSparkline data={data} />;

export const Small: Story = () => <MiniSparkline data={data.slice(0, 12)} width={50} height={18} />;

export const Wide: Story = () => <MiniSparkline data={data} width={140} height={36} />;

export const Info: Story = () => <MiniSparkline data={data} color="var(--accent-info)" />;

export const Success: Story = () => <MiniSparkline data={data} color="var(--accent-success)" />;

export const Empty: Story = () => <MiniSparkline data={[]} />;

export const Single: Story = () => <MiniSparkline data={[42]} />;
