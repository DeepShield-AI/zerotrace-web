import { useEffect, useState, useCallback, useRef } from 'react';
import { Select, Button, Input, message, Tooltip, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type Platform = 'linux' | 'docker' | 'kubernetes' | 'windows';

interface ApiKeyOption { id: number; name: string; key_prefix: string; status: string; }
interface AgentInfo {
  id: number; name: string; ctrl_ip: string; state: number;
  enable: number; revision: string; synced_controller_at: string;
}
interface PlatformConfig { key: Platform; label: string; osLabel: string; archLabel: string; icon: string; }

const platforms: PlatformConfig[] = [
  { key: 'linux', label: 'Linux', osLabel: 'Linux (kernel 4.14+)', archLabel: 'AMD64 / ARM64',
    icon: 'M20.8 13.4c-.2.1-.3.2-.3.3l-.8 3.6c-.1.5-.4.9-.8 1.2-.4.3-.8.5-1.2.5-.6 0-1-.3-1.3-.8-.3-.4-.4-1-.2-1.7l.5-2.3c.1-.2-.1-.3-.2-.4-.2-.1-.5-.1-.9-.1H9.8c-.3 0-.5 0-.6.1-.1.1 0 .3.1.5l.5 2.3c.2.7.1 1.3-.2 1.7s-1 .8-1.7.8c-.4 0-.8-.2-1.2-.5s-.7-.7-.8-1.2l-.8-3.6c0-.1-.1-.2-.3-.3-.2 0-.5.1-1 .4L2 14l1 3c.4 1.3 1.1 2.2 2 2.8.9.6 1.8.9 2.7.9.9 0 1.8-.2 2.5-.6.6-.3 1.1-.9 1.4-1.6.2-.5.5-.9.7-1 .1-.1.3-.1.5 0 .3.2.6.6 1 1.2.4.8.9 1.3 1.5 1.6.7.4 1.5.6 2.5.6 1 0 2-.3 3-1 .9-.7 1.5-1.6 1.9-2.8l1-3-.3-.3c-.3-.1-.6-.2-.8-.2zM12 2C9.5 2 7.6 3 6.3 4.9 5.7 5.8 5.3 6.9 5.1 8c-.1.3 0 .7.1 1 .2.3.5.5.8.6.3.1.9.2 1.7.4 1.4.5 2.2 1 2.4 1.3.2.3.3.7.2 1.1-.1.4-.4.8-.8 1-.4.2-1 .3-1.7.2-.5 0-.9-.1-1.1-.4-.2-.3-.3-.7-.2-1.1l.2-1c0-.2 0-.3-.1-.3-.1 0-.3 0-.5.1L4 11c-.2 0-.3.1-.3.3 0 .2 0 .4.1.7.1.7.4 1.6.9 2.5.5.8 1 1.5 1.5 2 .7.6 1.5 1 2.5 1s1.8-.4 2.5-1c.6-.6 1.1-1.4 1.6-2.3.3-.8.5-1.5.6-2.2.1-.3 0-.7-.1-1-.2-.3-.5-.5-.8-.6-.3-.1-.9-.2-1.8-.5-1.4-.5-2.2-1-2.3-1.3-.1-.3-.1-.7.2-1.1.3-.3.7-.7 1.3-.9.5-.2 1.1-.2 1.6-.1.3.1.5.3.7.6.1.3.1.7 0 1.1l-.2 1c-.1.2 0 .4.2.5.2.1.6.1 1.1-.1l1.5-.3c.2-.1.3-.2.3-.4 0-.2-.1-.4-.2-.7-.1-.7-.4-1.6-.9-2.5-.5-.8-1-1.5-1.5-2C16.1 3 15.3 2.4 14.3 2c-.7-.1-1.4-.1-2.3 0z' },
  { key: 'docker', label: 'Docker', osLabel: 'Docker 20.10+ (host network)', archLabel: 'AMD64 / ARM64',
    icon: 'M21.4 13.2l-3.5 2-3.5-2V9.1L17.9 7l3.5 2.1v4.1zM9.6 13.2l-3.5 2-3.5-2V9.1L6.1 7l3.5 2.1v4.1zM15.5 2.5l3.5 2v4.1l-3.5-2V2.5zM3.7 2.5l3.5 2v4.1l-3.5-2V2.5zM14.1 14.6l3.8-2.2v4.4l-3.8 2.2v-4.4zM3.9 14.5l3.8 2.3v4.4l-3.8-2.2v-4.5zM10.7 10.6l3.8 2.2-3.8 2.2-3.8-2.3 3.8-2.1z' },
  { key: 'kubernetes', label: 'Kubernetes', osLabel: 'K8s 1.21+', archLabel: 'AMD64 / ARM64',
    icon: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 15.5L7 14l1.4-1.4 2.1 2.1 5.1-5.1L17 11l-6.5 6.5z' },
  { key: 'windows', label: 'Windows', osLabel: 'Not supported', archLabel: 'via Linux host',
    icon: 'M3 6h8v8H3V6zm10 0h8v8h-8V6zm-10 10h8v8H3v-8zm10 0h8v8h-8v-8z' },
];

/* ---------- Command builders — install does NOT include API key ---------- */
function buildInstallCmd(p: Platform, host: string): string {
  switch (p) {
    case 'linux':
      return [
        '# The script auto-detects OS/arch and configures the controller address.',
        '# ZEROTRACE_CONTROLLER_IP and SERVER_URL are derived from the download host.',
        'curl -fsSL http://' + host + ':3001/agent/install.sh | bash',
      ].join('\n');
    case 'docker':
      return [
        '# Pull the agent image (no API key needed yet)',
        'docker pull registry.cn-hongkong.aliyuncs.com/deepflow-ce/deepflow-agent:latest',
        '',
        '# Create minimal config on the host (controller address only)',
        'sudo mkdir -p /etc/deepflow-agent',
        'cat << EOF | sudo tee /etc/deepflow-agent/deepflow-agent.yaml',
        'controller-ips:',
        '  - ' + host,
        'controller-port: 30035',
        'EOF',
      ].join('\n');
    case 'kubernetes':
      return [
        'helm repo add deepflow https://deepflowio.github.io/deepflow',
        'helm repo update',
      ].join('\n');
    case 'windows':
      return '# DeepFlow agent does not support Windows.\n# Deploy on a Linux host in the same network segment.';
  }
}

function buildRunCmd(p: Platform, apiKey: string, host: string, tags: string): string {
  const key = apiKey || 'YOUR_API_KEY';
  const tagEnv = tags.trim() ? 'ZT_TAGS="' + tags.trim() + '" ' : '';

  switch (p) {
    case 'linux':
      return 'sudo ' + tagEnv + 'ZT_API_KEY=' + key + ' \\\n'
        + '  /opt/zerotrace-agent/bin/zerotrace-agent \\\n'
        + '  -c /opt/zerotrace-agent/etc/zerotrace-agent.yaml';
    case 'docker': {
      const lines = [
        'docker run -d \\',
        '  --name deepflow-agent \\',
        '  --privileged \\',
        '  --cap-add SYS_ADMIN --cap-add SYS_RESOURCE --cap-add SYS_PTRACE \\',
        '  --cap-add NET_ADMIN --cap-add NET_RAW --cap-add IPC_LOCK \\',
        '  --network=host --pid=host \\',
        '  -v /etc/deepflow-agent/deepflow-agent.yaml:/etc/deepflow-agent/deepflow-agent.yaml:ro \\',
        '  -v /sys/kernel/debug:/sys/kernel/debug:ro \\',
        '  -v /var/run/docker.sock:/var/run/docker.sock:ro \\',
      ];
      if (tags.trim()) lines.push('  -e ZT_TAGS="' + tags.trim() + '" \\');
      lines.push('  -e ZT_API_KEY=' + key + ' \\');
      lines.push('  registry.cn-hongkong.aliyuncs.com/deepflow-ce/deepflow-agent:latest');
      return lines.join('\n');
    }
    case 'kubernetes': {
      const lines = [
        '# Create a Secret for the API key',
        'kubectl -n deepflow create secret generic agent-api-key \\',
        '  --from-literal=key=' + key,
        '',
        '# Install with values (key injected from secret at runtime)',
        'helm install deepflow-agent deepflow/deepflow-agent \\',
        '  --namespace deepflow --create-namespace \\',
        '  --set agent.controllerIP=' + host + ' \\',
        '  --set agent.controllerPort=30035 \\',
      ];
      if (tags.trim()) lines.push('  --set agent.tags="' + tags.trim() + '" \\');
      lines.push('  --set agent.apiKeySecret=agent-api-key');
      return lines.join('\n');
    }
    case 'windows':
      return '# Not supported';
  }
}

/* ---------- Components ---------- */
function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for HTTP (non-localhost) contexts
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip title={copied ? t('common.copied') : t('common.copy')}>
      <button onClick={() => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all duration-200">
        {copied
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        }
      </button>
    </Tooltip>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      {lang && <span className="absolute top-3 left-4 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">{lang}</span>}
      <CopyButton text={code} />
      <pre className="bg-zinc-950 text-zinc-200 rounded-2xl p-5 pt-10 text-sm font-mono leading-relaxed overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}

function StepNum({ n, done }: { n: number; done?: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-100'}`}>
      {done ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg> : n}
    </div>
  );
}

/* ---------- Agent status polling ---------- */
function useAgentPolling(active: boolean) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    setPolling(true);
    try {
      const data = await api.getAgentStatus();
      const rawList = data?.DATA || data?.agents || [];
      // DeepFlow returns UPPERCASE field names — normalize to camelCase
      const list: AgentInfo[] = rawList.map((a: any) => ({
        id: a.ID ?? a.id ?? 0,
        name: a.NAME ?? a.name ?? 'Unknown',
        ctrl_ip: a.CTRL_IP ?? a.ctrl_ip ?? '',
        state: a.STATE ?? a.state ?? 0,
        enable: a.ENABLE ?? a.enable ?? 0,
        revision: a.REVISION ?? a.revision ?? '',
        synced_controller_at: a.SYNCED_CONTROLLER_AT ?? a.synced_controller_at ?? '',
      }));
      setAgents(list);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Cannot reach zerotrace-server');
    } finally { setPolling(false); }
  }, []);

  useEffect(() => {
    if (active) { poll(); intervalRef.current = setInterval(poll, 8000); }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, poll]);

  return { agents, polling, error };
}

// DB stores UTC timestamps without timezone. Append Z so JS parses as UTC, not local.
function asUtc(ts: string): Date { return new Date(ts.includes('Z') || ts.includes('+') ? ts : ts + 'Z'); }
function timeAgo(ts: string, t: (key: string, opts?: any) => string): string {
  if (!ts) return '';
  const d = Date.now() - asUtc(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return t('agentSetup.justNow');
  if (m < 60) return t('agentSetup.minutesAgo', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('agentSetup.hoursAgo', { h });
  return t('agentSetup.daysAgo', { d: Math.floor(h / 24) });
}
function stale(ts: string): boolean { return !ts || Date.now() - asUtc(ts).getTime() > 5 * 60000; }

function AgentStatusCard({ agents, polling, error }: { agents: AgentInfo[]; polling: boolean; error: string }) {
  const { t } = useTranslation();
  const active = agents.filter(a => a.state === 1 && !stale(a.synced_controller_at));
  const expired = agents.filter(a => a.state === 1 && stale(a.synced_controller_at));
  const n = agents.length;

  if (error && n === 0) {
    return (
      <div className="bento-card">
        <div className="flex items-start gap-4"><StepNum n={5} /><div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900 mb-1">{t('agentSetup.step5Title')}</h3>
          <p className="text-sm text-zinc-500 mb-3">{t('agentSetup.cannotReach')}</p>
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl p-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-soft" />{error}</div>
        </div></div></div>);
  }

  return (
    <div className="bento-card">
      <div className="flex items-start gap-4"><StepNum n={5} done={active.length > 0} /><div className="flex-1">
        <h3 className="text-lg font-semibold text-zinc-900 mb-1">{t('agentSetup.step5Title')}</h3>
        <p className="text-sm text-zinc-500 mb-3">
          {t('agentSetup.step5Desc')}{polling && <Spin size="small" className="ml-2" />}
        </p>
        {n === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            </div>
            <p className="text-sm font-medium text-zinc-600">{t('agentSetup.noAgents')}</p>
            <p className="text-xs text-zinc-400 mt-1">{t('agentSetup.noAgentsDesc')}</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-4 mb-3">
              {active.length > 0 && <span className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 dot-live" /><span className="font-medium text-zinc-700">{active.length} {t('agentSetup.active')}</span></span>}
              {expired.length > 0 && <span className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="font-medium text-zinc-500">{expired.length} {t('agentSetup.stale')}</span></span>}
              <span className="text-xs text-zinc-400">{n} {t('agentSetup.registered')}</span>
            </div>
            {active.map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3 bg-emerald-50/30 border border-emerald-100 rounded-xl mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dot-live shrink-0" />
                  <div className="min-w-0"><p className="text-sm font-medium text-zinc-800 truncate">{a.name}</p><p className="text-xs text-zinc-400">{a.ctrl_ip} &middot; {a.revision} &middot; {timeAgo(a.synced_controller_at, t)}</p></div>
                </div>
                <span className="text-xs text-emerald-600 font-medium shrink-0">{t('agentSetup.connected')}</span>
              </div>
            ))}
            {expired.length > 0 && (
              <details className="mt-2"><summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 py-1">{expired.length}{expired.length > 1 ? t('agentSetup.staleAgents') : t('agentSetup.staleAgent')}</summary>
                <div className="mt-2 space-y-1">{expired.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /><span className="text-xs text-zinc-600 truncate">{a.name}</span><span className="text-xs text-zinc-400">{a.ctrl_ip}</span></div>
                    <span className="text-xs text-zinc-400">{timeAgo(a.synced_controller_at, t)}</span>
                  </div>
                ))}</div>
              </details>
            )}
          </div>
        )}
      </div></div></div>);
}

/* ---------- Main page ---------- */
export default function AgentSetup() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<Platform>('linux');
  const [apiKeys, setApiKeys] = useState<ApiKeyOption[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [selectedKeyValue, setSelectedKeyValue] = useState('');
  const [keysLoading, setKeysLoading] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  const host = '202.112.237.37';
  const hasKey = !!selectedKeyValue;

  useEffect(() => { loadKeys(); }, []);
  const loadKeys = async () => {
    setKeysLoading(true);
    try { const data = await api.listApiKeys(); setApiKeys(data.api_keys?.filter((k: ApiKeyOption) => k.status === 'active') || []); } catch { /* */ }
    finally { setKeysLoading(false); }
  };
  const handleSelectKey = async (id: number) => {
    setSelectedKeyId(id);
    try {
      const data = await api.revealApiKey(id);
      setSelectedKeyValue(data.key);
    } catch (err: any) {
      message.error('Failed to reveal key: ' + (err.message || 'unknown error'));
      setSelectedKeyValue('');
    }
    setNewKeyValue('');
  };
  const handlePasteKey = (val: string) => { setSelectedKeyValue(val.trim()); if (val.trim()) setSelectedKeyId(-1); };
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return; setCreatingKey(true);
    try { const data = await api.createApiKey({ name: newKeyName.trim(), scopes: ['ingest:*'] }); setNewKeyValue(data.api_key.key); setSelectedKeyValue(data.api_key.key); message.success('Key created'); loadKeys(); }
    catch (err: any) { message.error(err.message); }
    finally { setCreatingKey(false); }
  };

  const installCmd = buildInstallCmd(platform, host);
  const runCmd = buildRunCmd(platform, selectedKeyValue, host, tagInput);
  const { agents, polling, error: agentError } = useAgentPolling(hasKey);

  return (
    <div className="animate-fade-in">
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{t('agentSetup.title')}</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-xl">{t('agentSetup.subtitle')}</p>

      </div>

      {/* Platform selector */}
      <div className="flex flex-wrap gap-2 mb-10">
        {platforms.map(p => (
          <button key={p.key} onClick={() => setPlatform(p.key)}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${platform === p.key ? 'bg-zinc-900 text-white shadow-elevated' : 'bg-white text-zinc-600 hover:text-zinc-900 border border-zinc-200/60 hover:border-zinc-300'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-70"><path d={p.icon} /></svg>{t(`agentSetup.platforms.${p.key}`)}
          </button>
        ))}
      </div>

      <div className="space-y-8 max-w-3xl stagger-children">

        {/* Step 1 — API Key (Datadog: select key FIRST) */}
        <div className="bento-card">
          <div className="flex items-start gap-4">
            <StepNum n={1} done={hasKey} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">{t('agentSetup.step1Title')}</h3>
              <p className="text-sm text-zinc-500 mb-4">{t('agentSetup.step1Desc')}</p>
              <div className="space-y-3">
                <Select loading={keysLoading} placeholder={t('agentSetup.selectKeyPlaceholder')} value={selectedKeyId} onChange={handleSelectKey} className="w-full" size="large"
                  options={apiKeys.map(k => ({ value: k.id, label: <div className="flex items-center gap-3"><span className="font-medium text-sm">{k.name}</span><code className="text-xs text-zinc-400 font-mono">{k.key_prefix}</code></div> }))}
                  notFoundContent={<div className="py-4 text-center text-sm text-zinc-400">{t('agentSetup.noActiveKeys')}</div>} />
                <Input.Password placeholder={t('agentSetup.orPasteKey')} value={selectedKeyId === -1 ? selectedKeyValue : ''} onChange={e => handlePasteKey(e.target.value)} className="h-11 font-mono" />
                <div className="flex gap-2 pt-2 border-t border-zinc-100">
                  <Input placeholder={t('agentSetup.newKeyName')} value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="h-10 flex-1" />
                  <Button loading={creatingKey} onClick={handleCreateKey} className="h-10 font-medium">{t('dashboard.generate')}</Button>
                </div>
                {newKeyValue && (<div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl"><p className="text-xs text-emerald-700 mb-1 font-medium">{t('agentSetup.keyCreatedCopyNow')}</p><code className="text-xs font-mono text-emerald-800 break-all select-all">{newKeyValue}</code></div>)}
              </div>
              {hasKey && <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t('agentSetup.keyReady')}</div>}
            </div>
          </div>
        </div>

        {/* Step 2 — Tags (optional) */}
        <div className="bento-card">
          <div className="flex items-start gap-4">
            <StepNum n={2} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">{t('agentSetup.step2Title')}</h3>
              <p className="text-sm text-zinc-500 mb-3">{t('agentSetup.step2Desc')}</p>
              <Input placeholder={t('agentSetup.tagsPlaceholder')} value={tagInput} onChange={e => setTagInput(e.target.value)} className="h-11 font-mono text-sm" />
            </div>
          </div>
        </div>

        {/* Step 3 — Install (no API key in command) */}
        <div className="bento-card">
          <div className="flex items-start gap-4">
            <StepNum n={3} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">{t('agentSetup.step3Title')}</h3>
              <p className="text-sm text-zinc-500 mb-2">{platforms.find(p => p.key === platform)!.osLabel} &middot; {platforms.find(p => p.key === platform)!.archLabel}</p>
              <CodeBlock code={installCmd} lang="shell" />
            </div>
          </div>
        </div>

        {/* Step 4 — Run (API key injected as ZT_API_KEY env var) */}
        <div className="bento-card">
          <div className="flex items-start gap-4">
            <StepNum n={4} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">{t('agentSetup.step4Title')}</h3>
              <p className="text-sm text-zinc-500 mb-2">{t('agentSetup.step4Desc')}</p>
              <CodeBlock code={runCmd} lang="shell" />
              {!hasKey && <p className="text-xs text-amber-600 mt-2">{t('agentSetup.noKeyWarning')}</p>}
            </div>
          </div>
        </div>

        {/* Step 5 — Agent verification (DB-based, like Datadog Infrastructure) */}
        <AgentStatusCard agents={agents} polling={polling} error={agentError} />
      </div>

      <div className="mt-12 pt-8 border-t border-zinc-200/60">
        <p className="text-xs text-zinc-400 max-w-lg">
          {t('agentSetup.footerNote')}
        </p>
      </div>
    </div>
  );
}
