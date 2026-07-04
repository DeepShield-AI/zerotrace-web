export type Platform = 'linux' | 'docker' | 'kubernetes' | 'ecs' | 'windows' | 'lambda';

export interface CardInfo { key: Platform; label: string; icon: string; section: string; ssi: boolean; desc: string; }

export const ALL_CARDS: CardInfo[] = [
  { key: 'docker', label: 'Docker', icon: '🐳', section: 'CONTAINERIZED', ssi: false, desc: 'Run as a container with auto-configuration' },
  { key: 'kubernetes', label: 'Kubernetes', icon: '☸️', section: 'CONTAINERIZED', ssi: false, desc: 'Deploy via Helm chart to your cluster' },
  { key: 'ecs', label: 'Amazon ECS', icon: '☁️', section: 'CONTAINERIZED', ssi: false, desc: 'Add as a sidecar container in task definition' },
  { key: 'linux', label: 'Linux', icon: '🐧', section: 'HOST BASED', ssi: true, desc: 'Bare metal & VMs with Single Step Instrumentation' },
  { key: 'windows', label: 'Windows', icon: '🪟', section: 'HOST BASED', ssi: false, desc: 'Deploy on a Linux host in the same network segment' },
  { key: 'lambda', label: 'AWS Lambda', icon: 'λ', section: 'SERVERLESS', ssi: false, desc: 'Tracing via Lambda Extension layer' },
];

export const SSI_LANGUAGES = ['Java', 'Python', 'Ruby', '.NET', 'Node.js', 'PHP'];

export function getInstallCmd(p: Platform, apiKey: string, host: string): string {
  const port = '5173';
  const keySuffix = apiKey ? ` ZEROTRACE_API_KEY="${apiKey}" bash` : ' bash';
  switch (p) {
    case 'linux': return `curl -fsSL http://${host}:${port}/agent/install.sh | sudo ${keySuffix}`;
    case 'docker': return `docker pull registry.cn-hongkong.aliyuncs.com/deepflow-ce/deepflow-agent:latest
sudo mkdir -p /etc/deepflow-agent
cat << EOF | sudo tee /etc/deepflow-agent/deepflow-agent.yaml
controller-ips:
  - ${host}
controller-port: 30035
EOF
docker run -d --name deepflow-agent --net=host \\
  -v /etc/deepflow-agent:/etc/deepflow-agent \\
  registry.cn-hongkong.aliyuncs.com/deepflow-ce/deepflow-agent:latest`;
    case 'kubernetes': return `helm repo add deepflow https://deepflowio.github.io/deepflow
helm repo update
helm install deepflow-agent deepflow/deepflow-agent \\
  --set controller.ips[0]="${host}" \\
  --set controller.port=30035 \\
  --namespace deepflow --create-namespace`;
    case 'ecs': return `# ECS Task Definition — add agent container:
{
  "image": "registry.cn-hongkong.aliyuncs.com/deepflow-ce/deepflow-agent:latest",
  "environment": [
    {"name": "CONTROLLER_IP", "value": "${host}"}
  ]
}`;
    case 'windows': return `# Windows agent not yet supported.
# Deploy on a Linux host in the same network segment.`;
    case 'lambda': return `# Serverless tracing via AWS Lambda Extension
# Add the Zerotrace layer to your Lambda function
# See: https://docs.zerotrace.com/serverless`;
  }
}
