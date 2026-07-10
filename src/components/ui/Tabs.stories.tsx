import type { Story } from '@ladle/react';
import { Tabs, TabPanel } from './Tabs';

export default { title: 'UI/Tabs' };

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'resources', label: 'Resources' },
  { key: 'errors', label: 'Errors' },
];

export const Tab_First: Story = () => (
  <div>
    <Tabs tabs={tabs} active="overview" onChange={() => {}} />
    <TabPanel><div className="p-4 text-sm">Overview content</div></TabPanel>
  </div>
);

export const Tab_Second: Story = () => (
  <div>
    <Tabs tabs={tabs} active="resources" onChange={() => {}} />
    <TabPanel><div className="p-4 text-sm">Resources content</div></TabPanel>
  </div>
);
