import type { Story } from '@ladle/react';
import { useState } from 'react';
import { Modal, SlidePanel, Tooltip } from './Overlay';

export default { title: 'UI/Overlay' };

export const Modal_Open: Story = () => {
  return <Modal open={true} onClose={() => {}} title="Confirm Action">Are you sure you want to proceed?</Modal>;
};

export const Modal_Closed: Story = () => {
  return <Modal open={false} onClose={() => {}} title="Confirm Action">Are you sure?</Modal>;
};

export const SlidePanel_Open: Story = () => {
  return <SlidePanel open={true} onClose={() => {}} title="Details"><div className="p-4">Panel content</div></SlidePanel>;
};

export const Tooltip_Default: Story = () => (
  <div className="pt-12 pl-12">
    <Tooltip content="This is a helpful tooltip">
      <span className="px-3 py-1 bg-bg-muted rounded cursor-help">Hover me</span>
    </Tooltip>
  </div>
);

export const Tooltip_Long: Story = () => (
  <div className="pt-12 pl-12">
    <Tooltip content="CPU usage has exceeded the 90% threshold for more than 5 minutes on web-01.prod">
      <span className="px-3 py-1 bg-accent-danger-bg text-accent-danger rounded cursor-help">⚠ Alert</span>
    </Tooltip>
  </div>
);
