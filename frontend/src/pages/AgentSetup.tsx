import { useState } from 'react';
import { api } from '../api/client';

type Platform = 'linux' | 'docker' | 'kubernetes';

const PLATFORMS: { key: Platform; label: string; desc: string }[] = [
  { key: 'linux', label: 'Linux', desc: 'Linux (kernel 4.14+) · AMD64 / ARM64' },
  { key: 'docker', label: 'Docker', desc: 'Docker 20.10+ (host network) · AMD64 / ARM64' },
  { key: 'kubernetes', label: 'Kubernetes', desc: 'K8s 1.21+ · AMD64 / ARM64 via Helm' },
];

function buildInstallCmd(p: Platform, host: string, port: string): string {
  switch (p) {
    case 'linux':
      return `curl -fsSL http://${host}:${port}/agent/install.sh | bash`;
    case 'docker':
      return `docker pull registry.cn-hongkong.aliyuncs.com/deepflow-ce/deepflow-agent:latest
sudo mkdir -p /etc/deepflow-agent
cat << EOF | sudo tee /etc/deepflow-agent/deepflow-agent.yaml
controller-ips:
  - ${host}
controller-port: 30035
EOF
docker run -d --net=host --name deepflow-agent \\
  -v /etc/deepflow-agent:/etc/deepflow-agent \\
  registry.cn-hongkong.aliyuncs.com/deepflow-ce/deepflow-agent:latest`;
    case 'kubernetes':
      return `helm repo add deepflow https://deepflowio.github.io/deepflow
helm repo update
helm install deepflow-agent deepflow/deepflow-agent \\
  --set controller.ips[0]="${host}" \\
  --set controller.port=30035 \\
  --namespace deepflow --create-namespace`;
  }
}

export default function AgentSetup() {
  const [activeTab, setActiveTab] = useState<'setup' | 'rules'>('setup');
  const [platform, setPlatform] = useState<Platform>('linux');
  const [deployment, setDeployment] = useState('container');
  const [apiKey, setApiKey] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyLoading, setKeyLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);

  const host = window.location.hostname || '202.112.237.37';
  const port = '5173';
  const installCmd = buildInstallCmd(platform, host, port);

  // Load API keys
  useState(() => {
    api.listApiKeys().then(d => {
      const keys = (d as any)?.api_keys || [];
      if (keys.length > 0) setApiKey(keys[0].key_prefix + '...');
      setKeyLoading(false);
    }).catch(() => setKeyLoading(false));
  });

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1C2B34] mb-0.5">Set up APM</h1>
        <p className="text-sm text-[#506e81]">Start monitoring your services with application observability</p>
      </div>

      {/* Tabs: Set up APM | Instrumentation Rules */}
      <div className="flex gap-0 mb-6 border-b border-[#d1d9e0]">
        <button onClick={() => setActiveTab('setup')}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] transition-colors ${activeTab === 'setup' ? 'text-[#632CA6] border-[#632CA6]' : 'text-[#506e81] border-transparent hover:text-[#1C2B34]'}`}>
          Set up APM
        </button>
        <button onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] transition-colors ${activeTab === 'rules' ? 'text-[#632CA6] border-[#632CA6]' : 'text-[#506e81] border-transparent hover:text-[#1C2B34]'}`}>
          Instrumentation Rules
          <span className="ml-1.5 text-[11px] text-[#8b9bb4] bg-[#f0f2f5] px-1.5 py-0.5 rounded-full">0 Rules</span>
        </button>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[#8b9bb4]">
          <span>⚠ Instrumentation Errors</span>
          <span className="bg-[#f0f2f5] px-1.5 py-0.5 rounded-full">0 Detected</span>
        </div>
      </div>

      {activeTab === 'setup' ? (
        <div className="space-y-6">
          {/* Step 1: Where are your services deployed? */}
          <div className="bg-white border border-[#d1d9e0] rounded-lg p-6">
            <h3 className="text-sm font-semibold text-[#1C2B34] mb-4">
              <span className="text-[#632CA6] font-bold mr-1.5">1</span>
              Where are your services deployed?
            </h3>
            <div className="flex gap-3 mb-6">
              {[
                { key: 'container', label: 'Container Based', icon: '📦', desc: 'Docker, Kubernetes, ECS' },
                { key: 'host', label: 'Host Based', icon: '🖥️', desc: 'Linux VMs, bare metal' },
                { key: 'serverless', label: 'Serverless', icon: '☁️', desc: 'Lambda, Cloud Functions', disabled: true },
              ].map(opt => (
                <button key={opt.key} onClick={() => !opt.disabled && setDeployment(opt.key)}
                  disabled={opt.disabled}
                  className={`flex-1 p-4 rounded-lg border-2 text-left transition-all ${opt.disabled ? 'border-[#e9ecef] bg-[#f8f9fb] opacity-50 cursor-not-allowed' : deployment === opt.key ? 'border-[#632CA6] bg-[#f0f2f5]' : 'border-[#d1d9e0] bg-white hover:border-[#adb5bd]'}`}>
                  <div className="text-2xl mb-1">{opt.icon}</div>
                  <div className="text-sm font-semibold text-[#1C2B34]">{opt.label}</div>
                  <div className="text-[11px] text-[#8b9bb4] mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Platform tabs */}
            <div className="border-t border-[#d1d9e0] pt-4">
              <div className="text-xs font-semibold text-[#506e81] uppercase tracking-wider mb-3">Select Platform</div>
              <div className="flex gap-2 mb-6">
                {PLATFORMS.map(p => (
                  <button key={p.key} onClick={() => setPlatform(p.key)}
                    className={`px-4 py-2.5 rounded-md text-[13px] font-medium transition-all ${platform === p.key ? 'bg-[#632CA6] text-white shadow-sm' : 'bg-[#f0f2f5] text-[#506e81] hover:bg-[#e9ecef]'}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Selected platform description */}
              <div className="bg-[#f8f9fb] border border-[#e9ecef] rounded-lg p-4 mb-4">
                <div className="text-xs font-semibold text-[#1C2B34] mb-1">
                  {PLATFORMS.find(p => p.key === platform)?.label} —
                  <span className="text-[#506e81] font-normal ml-1">{PLATFORMS.find(p => p.key === platform)?.desc}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Installation command */}
          <div className="bg-white border border-[#d1d9e0] rounded-lg p-6">
            <h3 className="text-sm font-semibold text-[#1C2B34] mb-4">
              <span className="text-[#632CA6] font-bold mr-1.5">2</span>
              Install the agent
            </h3>
            <p className="text-[13px] text-[#506e81] mb-4">Run this command on your {PLATFORMS.find(p => p.key === platform)?.label} host:</p>
            <div className="bg-[#1a1d24] rounded-lg p-4 mb-4 relative">
              <button onClick={() => { navigator.clipboard.writeText(installCmd); }}
                className="absolute top-3 right-3 text-[11px] text-[#8b9bb4] hover:text-white bg-[#2d313a] hover:bg-[#3d414a] px-2 py-1 rounded transition-colors">
                Copy
              </button>
              <pre className="text-[12px] text-[#c8cdd0] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
{installCmd}
              </pre>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#8b9bb4]">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Make sure you have root/sudo access on the target machine.
            </div>
          </div>

          {/* Step 3: API Key config */}
          <div className="bg-white border border-[#d1d9e0] rounded-lg p-6">
            <h3 className="text-sm font-semibold text-[#1C2B34] mb-4">
              <span className="text-[#632CA6] font-bold mr-1.5">3</span>
              Configuration (optional)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#506e81] uppercase tracking-wider block mb-1.5">API Key</label>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Auto-detected from your account" disabled={keyLoading}
                  className="w-full h-9 px-3 text-[13px] border border-[#d1d9e0] rounded bg-white text-[#1C2B34] placeholder:text-[#adb5bd] disabled:bg-[#f8f9fb] focus:outline-none focus:border-[#632CA6]" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#506e81] uppercase tracking-wider block mb-1.5">Tags (comma separated)</label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="env:prod, team:platform"
                  className="w-full h-9 px-3 text-[13px] border border-[#d1d9e0] rounded bg-white text-[#1C2B34] placeholder:text-[#adb5bd] focus:outline-none focus:border-[#632CA6]" />
              </div>
            </div>
          </div>

          {/* After instrumentation */}
          <div className="bg-white border border-[#d1d9e0] rounded-lg p-6">
            <h3 className="text-sm font-semibold text-[#1C2B34] mb-4">After instrumentation you'll be able to...</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { t: 'Distributed Tracing', d: 'Trace requests across services with flame graphs and waterfall views' },
                { t: 'Service Map', d: 'Visualize service dependencies and detect bottlenecks automatically' },
                { t: 'Performance Metrics', d: 'Monitor latency, throughput, and error rates with pre-built dashboards' },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-[#f8f9fb] rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-[#e8f5e9] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-[#2DB88D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1C2B34]">{f.t}</p>
                    <p className="text-[12px] text-[#506e81] mt-1">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Instrumentation Rules tab */
        <div className="bg-white border border-[#d1d9e0] rounded-lg p-16 text-center">
          <svg className="w-12 h-12 text-[#d1d9e0] mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <h3 className="text-base font-semibold text-[#1C2B34] mb-1">No instrumentation rules</h3>
          <p className="text-sm text-[#8b9bb4] max-w-md mx-auto">Instrumentation rules will appear here once you configure auto-instrumentation policies for your services.</p>
        </div>
      )}

      {/* Agent verification section */}
      <div className="bg-white border border-[#d1d9e0] rounded-lg p-6 mt-6">
        <h3 className="text-sm font-semibold text-[#1C2B34] mb-4">Connected Agents</h3>
        {agents.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[#8b9bb4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
            </div>
            <p className="text-[13px] text-[#8b9bb4]">No agents connected yet</p>
            <p className="text-[11px] text-[#adb5bd] mt-1">Run the installation command above to connect your first agent</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-[#d1d9e0] text-left text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider">
              <th className="py-2 px-4">Agent</th><th className="py-2 px-4">IP</th><th className="py-2 px-4">Status</th><th className="py-2 px-4">Last Seen</th>
            </tr></thead>
            <tbody>
              {agents.map((a: any, i: number) => (
                <tr key={i} className="border-b border-[#f0f2f5]">
                  <td className="py-2.5 px-4 font-medium text-[#1C2B34]">{a.name || `Agent-${i + 1}`}</td>
                  <td className="py-2.5 px-4 text-[#506e81] font-mono text-[12px]">{a.ctrl_ip || '—'}</td>
                  <td className="py-2.5 px-4"><span className="inline-flex items-center gap-1.5 text-[#2DB88D]"><span className="w-1.5 h-1.5 rounded-full bg-[#2DB88D]"/>Online</span></td>
                  <td className="py-2.5 px-4 text-[#8b9bb4]">{a.synced_controller_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
