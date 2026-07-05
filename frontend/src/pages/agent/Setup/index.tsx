import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { ALL_CARDS, SSI_LANGUAGES, getInstallCmd } from './data';
import type { Platform, CardInfo } from './data';

// ════════════════════════ STEP CIRCLE COMPONENT ════════════════════════
function StepCircle({ num, active, done }: { num: number; active: boolean; done: boolean }) {
  if (done) {
    return (
      <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-accent-success-bg text-accent-success shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
      </span>
    );
  }
  return (
    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${active ? 'bg-accent-primary text-fg-inverse' : 'bg-bg-muted text-fg-tertiary'}`}>
      {num}
    </span>
  );
}

export default function AgentSetup() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<Platform>('linux');
  const [apiKey, setApiKey] = useState('');
  const [newKeyData, setNewKeyData] = useState<{ id: number; key: string; source: 'created' | 'revealed' } | null>(null);
  const [keyCreating, setKeyCreating] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [tags, setTags] = useState('');
  const [activeTab, setActiveTab] = useState<'setup' | 'rules' | 'errors'>('setup');
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyRevealing, setKeyRevealing] = useState(false);
  const [revealingKeyId, setRevealingKeyId] = useState<number | null>(null);
  const isKeyTruncated = apiKey.length > 0 && apiKey.includes('...');

  const host = '202.112.237.37';
  const navigate = useNavigate();

  // Load API keys and agents
  const { data: apiKeysData, refetch: refetchApiKeys } = useQuery({ queryKey: ['apiKeys'], queryFn: () => api.listApiKeys() });
  const apiKeys = (apiKeysData as any)?.api_keys || [];
  // Auto-select first API key prefix on load
  useEffect(() => {
    if (apiKeys.length > 0 && !apiKey) setApiKey(apiKeys[0].key_prefix + '...');
  }, [apiKeys, apiKey]);

  const { data: agentsData } = useQuery({ queryKey: ['agentStatus'], queryFn: () => api.getAgentStatus(), refetchInterval: 10000 });
  const agents = (agentsData as any)?.agents || (agentsData as any)?.DATA || [];

  // Step completion tracking
  const step1Done = true; // Platform is always selected (default: linux)
  const step2Done = apiKey.length > 0;
  const step3Done = false; // Install step — user action outside the app
  const step4Done = agents.length > 0;

  // Generate new API key
  const handleCreateKey = useCallback(async () => {
    setKeyCreating(true);
    setKeyError('');
    try {
      const d = await api.createApiKey({ name: 'Agent Key', scopes: ['*'] });
      const created = d?.api_key;
      if (created?.id && created?.key) {
        // createApiKey returns the full key — no need for a second reveal call
        setNewKeyData({ id: created.id, key: created.key, source: 'created' });
        refetchApiKeys();
      }
    } catch (err: any) {
      setKeyError(err?.message || 'Failed to create API key');
    } finally {
      setKeyCreating(false);
    }
  }, []);

  // Select existing key — reveal full key via API
  const handleSelectExistingKey = useCallback(async (k: any) => {
    setRevealingKeyId(k.id);
    setKeyRevealing(true);
    setKeyError('');
    try {
      const revealed = await api.revealApiKey(k.id);
      const fullKey = revealed?.key || '';
      if (fullKey && !fullKey.includes('...')) {
        setApiKey(fullKey);
        setNewKeyData({ id: k.id, key: fullKey, source: 'revealed' });
      } else {
        setKeyError('Cannot reveal this key. Create a new one or paste it manually.');
      }
    } catch (err: any) {
      setKeyError(err?.message || 'Failed to reveal API key. Create a new one or paste it manually.');
    } finally {
      setKeyRevealing(false);
      setRevealingKeyId(null);
    }
  }, []);

  // Copy to clipboard with feedback (works on both HTTP and HTTPS)
  const handleCopy = useCallback(async (text: string, isKey = false) => {
    const onSuccess = () => {
      if (isKey) {
        setKeyCopied(true);
        setTimeout(() => setKeyCopied(false), 3000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    try {
      // Try modern Clipboard API first (requires HTTPS or localhost)
      await navigator.clipboard.writeText(text);
      onSuccess();
    } catch {
      // Fallback for HTTP: use execCommand via a temporary textarea
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          onSuccess();
        } else {
          console.warn('Copy failed: execCommand returned false');
        }
      } catch (fallbackErr) {
        console.warn('Copy failed:', fallbackErr);
      }
    }
  }, []);

  const installCmd = getInstallCmd(platform, apiKey, host);
  const sections = [...new Set(ALL_CARDS.map(c => c.section))];

  // Agent stats
  const onlineCount = agents.filter((a: any) => (a.state ?? a.STATE ?? 0) === 1).length;
  const staleCount = agents.filter((a: any) => (a.state ?? a.STATE ?? 0) === 2).length;
  const offlineCount = agents.filter((a: any) => (a.state ?? a.STATE ?? 0) === 3).length;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-fg-primary">{t('apmIntro.setupApm')}</h1>
          <p className="text-sm text-[#506e81] mt-0.5">Guided onboarding — instrument your services in minutes</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-fg-tertiary">
          <span>⚠ {t('apmIntro.instrumentationErrors')}</span>
          <span className="bg-bg-muted px-1.5 py-0.5 rounded-full">0 Detected</span>
        </div>
      </div>

      {/* APM top sub-nav */}
      <div className="flex items-center gap-0 mb-6 border-b border-border">
        {['APM Set up', 'Services', 'Traces', 'Profiles'].map(t => (
          <button
            key={t}
            onClick={() => { if (t === 'Services') navigate('/apm'); if (t === 'Traces') navigate('/apm?view=traces'); if (t === 'Profiles') navigate('/profiling'); }}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] ${t === 'APM Set up' ? 'text-accent-primary border-accent-primary' : 'text-[#506e81] border-transparent hover:text-fg-primary hover:border-border'}`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto text-[13px] text-[#506e81] flex items-center gap-1 cursor-pointer" onClick={() => navigate('/apm/settings')}>
          Settings
          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8z"/></svg>
        </div>
      </div>

      <div className="flex gap-6">
        {/* LEFT: Step progress sidebar */}
        <div className="w-[220px] shrink-0 space-y-1">
          {[
            { key: 'setup', num: null, title: t('apmIntro.setupApm'), sub: 'Guided onboarding', icon: 'setup' },
            { key: 'rules', num: null, title: t('apmIntro.instrumentationRules'), sub: '0 Rules', icon: 'rules' },
            { key: 'errors', num: null, title: t('apmIntro.instrumentationErrors'), sub: agents.length > 0 ? 'No Errors' : '0 Detected', icon: 'warn' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key as any)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${activeTab === item.key ? 'border-accent-primary bg-accent-primary/10' : 'border-transparent hover:bg-bg-subtle'}`}
            >
              <div className="flex items-start gap-2.5">
                {item.icon === 'setup' && <div className="w-1 h-5 bg-accent-primary rounded-full shrink-0 mt-0.5" />}
                {item.icon === 'rules' && (
                  <svg className="w-4 h-4 text-fg-tertiary mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20V10m6 10V4M6 20v-4"/>
                  </svg>
                )}
                {item.icon === 'warn' && (
                  <svg className="w-4 h-4 text-fg-tertiary mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
                  </svg>
                )}
                <div>
                  <p className="text-[13px] font-semibold text-fg-primary">{item.title}</p>
                  <p className="text-[11px] text-fg-tertiary">{item.sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* RIGHT: Main content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'setup' && (
            <div className="space-y-6">
              {/* ═══ STEP 1: Select Platform ═══ */}
              <div data-testid="setup-step-1">
                <div className="flex items-center gap-3 mb-4">
                  <StepCircle num={1} active={true} done={step1Done} />
                  <div>
                    <h3 className="text-sm font-semibold text-fg-primary">Select your deployment platform</h3>
                    <p className="text-[12px] text-fg-tertiary">Choose where your services are running</p>
                  </div>
                </div>
                {sections.map(sec => (
                  <div key={sec} className="mb-5">
                    <div className="text-[10px] font-semibold text-[#506e81] uppercase tracking-wider mb-2">{sec}</div>
                    <div className="flex gap-3">
                      {ALL_CARDS.filter(c => c.section === sec).map(c => (
                        <button
                          key={c.key}
                          onClick={() => setPlatform(c.key)}
                          data-testid={`setup-platform-${c.key}`}
                          className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${platform === c.key ? 'border-accent-primary bg-accent-primary/10 shadow-sm' : 'border-border bg-bg-elevated hover:border-border'}`}
                        >
                          <div className="text-2xl mb-1">{c.icon}</div>
                          <div className="text-[12px] font-semibold text-fg-primary">{c.label}</div>
                          {c.ssi && <div className="text-[10px] text-accent-primary mt-0.5 font-medium">SSI available</div>}
                          <div className="text-[10px] text-fg-tertiary mt-1 leading-tight">{c.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* SSI Banner for Linux */}
                {platform === 'linux' && (
                  <div className="bg-accent-primary/10 border border-[#d4c4ed] rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-accent-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                      </svg>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-fg-primary">Single Step Instrumentation</p>
                        <p className="text-[12px] text-[#506e81] mt-0.5">
                          Automatically installs the correct APM libraries via the Agent, instrumenting services without code changes.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {SSI_LANGUAGES.map(lang => (
                            <span key={lang} className="inline-flex items-center gap-1 px-2.5 py-1 bg-bg-elevated border border-border rounded-full text-[11px] font-medium text-[#506e81]">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ STEP 2: API Key ═══ */}
              <div data-testid="setup-step-2">
                <div className="flex items-center gap-3 mb-4">
                  <StepCircle num={2} active={!step2Done} done={step2Done} />
                  <div>
                    <h3 className="text-sm font-semibold text-fg-primary">Configure your API Key</h3>
                    <p className="text-[12px] text-fg-tertiary">Generate a key to authenticate your agents</p>
                  </div>
                </div>

                {/* Existing keys selector */}
                {apiKeys.length > 0 && (
                  <div className="mb-4">
                    <label className="text-[11px] font-semibold text-[#506e81] uppercase tracking-wider block mb-2">Existing Keys</label>
                    <p className="text-[11px] text-fg-tertiary mb-2">Click a key to reveal and use it in the install command.</p>
                    <div className="flex flex-wrap gap-2">
                      {apiKeys.map((k: any, i: number) => {
                        const isRevealing = revealingKeyId === k.id;
                        const isActive = newKeyData?.id === k.id && !isKeyTruncated;
                        return (
                          <button
                            key={i}
                            onClick={() => handleSelectExistingKey(k)}
                            disabled={keyRevealing}
                            className={`px-3 py-1.5 text-[12px] rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              isActive
                                ? 'border-accent-success bg-accent-success-bg text-accent-success font-medium'
                                : isRevealing
                                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                                : 'border-border text-[#506e81] hover:border-border hover:bg-bg-subtle'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {isRevealing && (
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="32" /></svg>
                              )}
                              {isActive && (
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                              )}
                              {k.name || `Key ${i + 1}`}
                              <span className="text-fg-tertiary font-mono">({k.key_prefix})</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {keyError && (
                      <p className="text-[12px] text-accent-danger mt-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        {keyError}
                      </p>
                    )}
                  </div>
                )}

                {/* Generate new key */}
                {!newKeyData ? (
                  <div>
                    <button
                      onClick={() => { setKeyError(''); handleCreateKey(); }}
                      disabled={keyCreating}
                      className="px-5 py-2.5 bg-accent-primary text-fg-inverse text-[13px] font-semibold rounded-md hover:bg-[#4a1d8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="generate-key-btn"
                    >
                      {keyCreating ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="32" /></svg>
                          Generating...
                        </span>
                      ) : (
                        apiKeys.length === 0 ? '+ Generate New API Key' : '+ Create New Key'
                      )}
                    </button>
                    {keyError && <p className="text-[12px] text-accent-danger mt-2">{keyError}</p>}
                  </div>
                ) : (
                  /* Revealed key card */
                  <div className={`rounded-lg p-4 ${newKeyData.source === 'created' ? 'bg-accent-success-bg border border-[#b8dfca]' : 'bg-accent-primary/10 border border-[#d4c4ed]'}`} data-testid="key-reveal-card">
                    <div className="flex items-start gap-3">
                      <svg className={`w-5 h-5 shrink-0 mt-0.5 ${newKeyData.source === 'created' ? 'text-accent-success' : 'text-accent-primary'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                      </svg>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-fg-primary">
                          {newKeyData.source === 'created' ? 'API Key Created' : 'API Key Revealed'}
                        </p>
                        {newKeyData.source === 'created' ? (
                          <p className="text-[12px] text-accent-danger font-medium mt-1">
                            Copy this key now. You won't be able to see it again.
                          </p>
                        ) : (
                          <p className="text-[12px] text-[#506e81] mt-1">
                            Key revealed — it's now embedded in the install command below.
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <code className="flex-1 bg-bg-elevated border border-border rounded px-3 py-2 text-[12px] font-mono text-fg-primary break-all select-all">
                            {newKeyData.key}
                          </code>
                          <button
                            onClick={() => {
                              handleCopy(newKeyData.key, true);
                              setApiKey(newKeyData.key);
                            }}
                            className={`px-3 py-2 text-[12px] font-semibold rounded-md transition-colors shrink-0 ${keyCopied ? 'bg-accent-success-bg text-accent-success border border-[#b8dfca]' : 'bg-accent-primary text-fg-inverse hover:bg-[#4a1d8a]'}`}
                          >
                            {keyCopied ? '✓ Copied!' : newKeyData.source === 'created' ? 'Copy & Use' : 'Copy Key'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual API key input */}
                <div className="mt-4">
                  <label className="text-[11px] font-semibold text-[#506e81] uppercase tracking-wider block mb-1">
                    Or paste a key manually
                  </label>
                  <div className="relative max-w-md">
                    <input
                      value={apiKey}
                      onChange={e => { setApiKey(e.target.value); setKeyError(''); }}
                      placeholder="zt_..."
                      className={`w-full h-9 px-3 pr-8 text-[13px] border rounded bg-bg-elevated placeholder:text-fg-disabled focus:outline-none focus:border-accent-primary ${
                        isKeyTruncated ? 'border-accent-warning' : apiKey.length > 0 ? 'border-accent-success' : 'border-border'
                      }`}
                    />
                    {apiKey.length > 0 && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        {isKeyTruncated ? (
                          <svg className="w-4 h-4 text-accent-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>
                        ) : (
                          <svg className="w-4 h-4 text-accent-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                        )}
                      </span>
                    )}
                  </div>
                  {isKeyTruncated && (
                    <p className="text-[11px] text-accent-warning mt-1">This appears to be a truncated key. Use the full key for the agent to authenticate.</p>
                  )}
                </div>
              </div>

              {/* ═══ STEP 3: Install Agent ═══ */}
              <div data-testid="setup-step-3">
                <div className="flex items-center gap-3 mb-4">
                  <StepCircle num={3} active={step2Done && !step4Done} done={step3Done} />
                  <div>
                    <h3 className="text-sm font-semibold text-fg-primary">Install the Agent</h3>
                    <p className="text-[12px] text-fg-tertiary">Run this command on your {ALL_CARDS.find(c => c.key === platform)?.label} host</p>
                  </div>
                </div>

                {isKeyTruncated && (
                  <div className="bg-accent-warning-bg border border-[#f5d5b0] rounded-lg p-3 mb-3 text-[12px] text-[#8b6914] flex items-start gap-2">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>
                    <div>
                      <span className="font-semibold">API key is incomplete.</span> Click an existing key above or create a new one to pre-fill the full key in the command below.
                    </div>
                  </div>
                )}

                {!isKeyTruncated && apiKey.length > 0 && (
                  <div className="bg-accent-success-bg border border-[#b8dfca] rounded-lg p-3 mb-3 text-[12px] text-fg-primary flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                    <span>API key ready — the install command below includes your full key.</span>
                  </div>
                )}

                {!step2Done && !isKeyTruncated && (
                  <div className="bg-accent-warning-bg border border-[#f5d5b0] rounded-lg p-3 mb-3 text-[12px] text-[#8b6914]">
                    ⚠ Generate or paste an API key in Step 2 to pre-fill the command.
                  </div>
                )}

                <div className="bg-[#1a1d24] rounded-lg p-4 relative" data-testid="install-command">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-3.5 h-3.5 text-fg-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">Install Command</span>
                    {isKeyTruncated && <span className="text-[10px] text-accent-warning font-medium">— key needed</span>}
                    {!isKeyTruncated && apiKey.length > 0 && <span className="text-[10px] text-accent-success font-medium">— key embedded</span>}
                  </div>
                  <button
                    onClick={() => handleCopy(installCmd)}
                    className={`absolute top-3 right-3 text-[11px] hover:text-white px-2 py-1 rounded transition-colors ${copied ? 'bg-accent-success-bg text-accent-success' : 'text-fg-tertiary bg-[#2d313a] hover:bg-[#3d414a]'}`}
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                  <pre className="text-[12px] text-[#c8cdd0] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap pr-20" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
                    {installCmd}
                  </pre>
                </div>

                {/* Tags configuration */}
                <div className="mt-4 max-w-lg">
                  <label className="text-[11px] font-semibold text-[#506e81] uppercase tracking-wider block mb-1">
                    Tags <span className="font-normal normal-case text-fg-tertiary">(optional)</span>
                  </label>
                  <input
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="env:production team:backend region:us-east-1"
                    className="w-full h-9 px-3 text-[13px] border border-border rounded bg-bg-elevated placeholder:text-fg-disabled focus:outline-none focus:border-accent-primary"
                  />
                </div>
              </div>

              {/* ═══ STEP 4: Verify & Continue ═══ */}
              <div data-testid="setup-step-4">
                <div className="flex items-center gap-3 mb-4">
                  <StepCircle num={4} active={step2Done} done={step4Done} />
                  <div>
                    <h3 className="text-sm font-semibold text-fg-primary">Verify & Continue</h3>
                    <p className="text-[12px] text-fg-tertiary">Agents appear here once they connect to the controller</p>
                  </div>
                </div>

                {/* Agent stats summary */}
                {agents.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-bg-elevated border border-border rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-[#506e81]">{agents.length}</p>
                      <p className="text-[10px] font-semibold text-fg-tertiary uppercase">Total</p>
                    </div>
                    <div className="bg-bg-elevated border border-border rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-accent-success">{onlineCount}</p>
                      <p className="text-[10px] font-semibold text-fg-tertiary uppercase">Online</p>
                    </div>
                    <div className="bg-bg-elevated border border-border rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-accent-warning">{staleCount}</p>
                      <p className="text-[10px] font-semibold text-fg-tertiary uppercase">Stale</p>
                    </div>
                    <div className="bg-bg-elevated border border-border rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-accent-danger">{offlineCount}</p>
                      <p className="text-[10px] font-semibold text-fg-tertiary uppercase">Offline</p>
                    </div>
                  </div>
                )}

                {/* Connected agents table */}
                <div className="bg-bg-elevated border border-border rounded-lg">
                  {agents.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 rounded-full bg-bg-muted flex items-center justify-center mx-auto mb-3 relative">
                        <svg className="w-7 h-7 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>
                        </svg>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent-warning rounded-full border-2 border-white animate-pulse" />
                      </div>
                      <p className="text-[13px] font-medium text-fg-primary">Waiting for agents to connect...</p>
                      <p className="text-[12px] text-fg-tertiary mt-1">
                        {t('apmIntro.noAgentsYet')}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider">
                          <th className="py-2 px-4">Agent</th>
                          <th className="py-2 px-4">IP</th>
                          <th className="py-2 px-4">Status</th>
                          <th className="py-2 px-4">Version</th>
                          <th className="py-2 px-4">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((a: any, i: number) => {
                          const st = a.state ?? a.STATE ?? 0;
                          const statusInfo = st === 1 ? { label: 'Online', color: '#2DB88D' }
                            : st === 2 ? { label: 'Stale', color: '#E2903C' }
                            : st === 3 ? { label: 'Offline', color: '#E65C5C' }
                            : { label: 'Unknown', color: '#8b9bb4' };
                          return (
                          <tr key={i} className="border-b border-border-subtle">
                            <td className="py-2.5 px-4 font-medium text-fg-primary">{a.name || a.NAME || `Agent-${i + 1}`}</td>
                            <td className="py-2.5 px-4 text-[#506e81] font-mono text-[12px]">{a.ctrl_ip || a.CTRL_IP || '—'}</td>
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: statusInfo.color }} />
                                <span className="text-[12px] font-medium" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-[12px] text-fg-tertiary">{a.version || a.VERSION || '—'}</td>
                            <td className="py-2.5 px-4 text-fg-tertiary">{a.synced_controller_at || a.SYNCED_CONTROLLER_AT || '—'}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Continue button */}
                <div className="flex items-center gap-3 mt-6 pt-2 border-t border-border">
                  <button
                    onClick={() => navigate('/apm')}
                    className="px-6 py-2.5 bg-accent-primary text-fg-inverse text-sm font-semibold rounded-md hover:bg-[#4a1d8a] transition-colors"
                    data-testid="continue-to-apm"
                  >
                    {t('apmIntro.continueToAPM')}
                  </button>
                  <span className="text-[12px] text-fg-tertiary">
                    {agents.length > 0
                      ? `${agents.length} agent(s) connected. ${t('apmIntro.agentWillReport')}`
                      : t('apmIntro.agentWillReport')}
                  </span>
                </div>
              </div>

              {/* Benefits grid */}
              <div className="grid grid-cols-3 gap-3 pt-4">
                {[
                  { t: 'Distributed Tracing', d: 'Trace requests across services with flame graphs and waterfall views' },
                  { t: 'Service Map', d: 'Visualize service dependencies and detect bottlenecks automatically' },
                  { t: 'Performance Metrics', d: 'Monitor latency, throughput, and error rates with pre-built dashboards' },
                ].map(f => (
                  <div key={f.t} className="p-3 bg-bg-subtle rounded-lg border border-border">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-accent-success-bg flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-accent-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-fg-primary">{f.t}</p>
                        <p className="text-[11px] text-[#8b9bb4] mt-0.5">{f.d}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="bg-bg-elevated border border-border rounded-lg p-16 text-center">
              <svg className="w-12 h-12 text-border mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <h3 className="text-base font-semibold text-fg-primary mb-1">{t('apmIntro.noRules')}</h3>
              <p className="text-sm text-fg-tertiary max-w-md mx-auto">
                {t('apmIntro.noRulesDesc')}
              </p>
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="bg-bg-elevated border border-border rounded-lg p-16 text-center">
              <div className="w-12 h-12 rounded-full bg-accent-success-bg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-accent-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-fg-primary mb-1">{t('apmIntro.noErrors')}</h3>
              <p className="text-sm text-fg-tertiary max-w-md mx-auto">
                {t('apmIntro.noErrorsDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
