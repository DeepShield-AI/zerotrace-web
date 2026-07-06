import type { Story } from '@ladle/react';
import { CodeBlock, InlineCode } from './CodeBlock';

export default { title: 'UI/CodeBlock' };

export const Bash: Story = () => (
  <CodeBlock code="curl -s https://api.zerotrace.io/v1/metrics/list" language="bash" />
);

export const Json: Story = () => (
  <CodeBlock
    code={'{\n  "service_name": "api-gateway",\n  "request_count": 12345,\n  "status": "ok"\n}'}
    language="json"
  />
);

export const Long: Story = () => (
  <CodeBlock
    maxHeight={200}
    language="bash"
    code={Array.from({ length: 30 }, (_, i) => `echo "Line ${i + 1}: processing..."`).join('\n')}
  />
);

export const InlineCode_Default: Story = () => <InlineCode>npm install zerotrace-agent</InlineCode>;
