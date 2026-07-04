import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { Button, Spin, Badge } from 'antd';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StorySummary {
  id: string;
  title: string;
  severity: 'Critical' | 'Warning' | 'Info';
  detected_at: number;
  affected_services: string[];
  anomaly_count: number;
}

interface Story extends StorySummary {
  description: string;
  anomalies: Anomaly[];
  root_cause: any;
  suggested_actions: string[];
  evidence: { baseline_window: string; analysis_window: string; total_services_analyzed: number; anomalies_detected: number; };
}

interface Anomaly {
  id: string;
  service_name: string;
  metric: string;
  category: string;
  current_value: number;
  baseline_mean: number;
  baseline_stddev: number;
  z_score: number;
  severity: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ago(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function severityColor(s: string): string {
  switch (s) {
    case 'Critical': return '#E65C5C';
    case 'Warning': return '#E2903C';
    case 'Info': return '#4799EB';
    default: return '#a1a1aa';
  }
}

function severityBadge(s: string): string {
  switch (s) {
    case 'Critical': return 'bg-accent-danger-bg text-accent-danger';
    case 'Warning': return 'bg-accent-warning-bg text-accent-warning';
    case 'Info': return 'bg-blue-100 text-blue-700';
    default: return 'bg-bg-muted text-fg-secondary';
  }
}

function metricLabel(m: string): string {
  switch (m) {
    case 'Latency': return 'Latency';
    case 'ErrorRate': return 'Error Rate';
    case 'RequestRate': return 'Request Rate';
    default: return m;
  }
}

// ---------------------------------------------------------------------------
// Mini markdown (simple bold + links + newlines)
// ---------------------------------------------------------------------------

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        // Bold: **text**
        const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-semibold text-fg-primary">{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        });
        return <p key={i} className="text-xs leading-relaxed text-fg-secondary mb-0.5">{parts}</p>;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GuardianPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch stories on mount
  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.guardianStories();
      setStories(data.stories || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  // Trigger analysis
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const data = await api.guardianAnalyze({});
      setStories(data.stories?.map((s: Story) => ({
        id: s.id,
        title: s.title,
        severity: s.severity,
        detected_at: s.detected_at,
        affected_services: s.affected_services,
        anomaly_count: s.anomalies.length,
      })) || []);
    } catch { /* silent */ }
    finally { setAnalyzing(false); }
  };

  // Fetch story detail
  const viewStory = async (id: string) => {
    try {
      const data = await api.guardianStoryDetail(id);
      setSelectedStory(data as Story);
    } catch { /* silent */ }
  };

  const criticalCount = stories.filter(s => s.severity === 'Critical').length;
  const warningCount = stories.filter(s => s.severity === 'Warning').length;
  const hasActive = criticalCount > 0 || warningCount > 0;

  return (
    <>
      {/* ── Floating indicator button ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl animate-slide-up bg-bg-elevated border border-border"
          title="Guardian Insights"
        >
          <Badge count={criticalCount > 0 ? criticalCount : (warningCount > 0 ? warningCount : 0)} size="small" offset={[-2, 2]}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasActive ? '#E65C5C' : '#632CA6'} strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </Badge>
          <span className="text-xs font-medium text-fg-secondary">
            {hasActive ? `${criticalCount + warningCount} issue(s)` : 'Guardian'}
          </span>
        </button>
      )}

      {/* ── Slide-out panel ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="relative w-[420px] max-w-[90vw] h-full bg-bg-elevated shadow-2xl flex flex-col animate-slide-up">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-subtle" style={{ background: 'linear-gradient(135deg, #632CA6, #8B5CF6)' }}>
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span className="text-sm font-semibold text-white tracking-tight">Guardian Insights</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={runAnalysis} disabled={analyzing} className="w-7 h-7 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-bg-elevated/10 transition-colors" title="Run analysis">
                  {analyzing ? <Spin size="small" /> : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                    </svg>
                  )}
                </button>
                <button onClick={() => { setIsOpen(false); setSelectedStory(null); }} className="w-7 h-7 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-bg-elevated/10 transition-colors" title="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {selectedStory ? (
                /* ── Story Detail ── */
                <div className="p-4 space-y-4">
                  <button onClick={() => setSelectedStory(null)} className="text-xs text-accent-primary hover:text-accent-primary font-medium flex items-center gap-1 mb-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Back to stories
                  </button>

                  <div>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${severityBadge(selectedStory.severity)}`}>
                      {selectedStory.severity}
                    </span>
                    <h3 className="text-base font-semibold text-fg-primary mt-2 leading-snug">{selectedStory.title}</h3>
                    <p className="text-[11px] text-fg-tertiary mt-1">{ago(selectedStory.detected_at)} · {selectedStory.affected_services.length} service(s)</p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-2">Description</h4>
                    <SimpleMarkdown text={selectedStory.description} />
                  </div>

                  {/* Anomaly details */}
                  <div>
                    <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-2">Anomalies ({selectedStory.anomalies.length})</h4>
                    <div className="space-y-2">
                      {selectedStory.anomalies.map((a) => (
                        <div key={a.id} className="bg-bg-subtle border border-border-subtle rounded-lg px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-fg-secondary">{a.service_name}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${severityBadge(a.severity)}`}>{a.severity}</span>
                          </div>
                          <p className="text-[11px] text-fg-secondary mb-1.5">{a.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-fg-tertiary">
                            <span>{metricLabel(a.metric)}</span>
                            <span>Z={a.z_score.toFixed(1)}</span>
                            <span>cur: {a.current_value.toFixed(1)}</span>
                            <span>base: {a.baseline_mean.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedStory.suggested_actions.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-2">Suggested Actions</h4>
                      <ul className="space-y-1.5">
                        {selectedStory.suggested_actions.map((action, i) => (
                          <li key={i} className="text-xs text-fg-secondary flex items-start gap-2">
                            <span className="text-accent-primary mt-0.5 shrink-0">→</span>
                            <SimpleMarkdown text={action} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Story List ── */
                <div className="p-4 space-y-3">
                  {/* Empty state */}
                  {!loading && stories.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #632CA6, #8B5CF6)' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-fg-primary mb-1">No insights yet</h3>
                      <p className="text-xs text-fg-secondary mb-4">Run an analysis to detect anomalies across your services.</p>
                      <Button type="primary" onClick={runAnalysis} loading={analyzing} size="small">
                        Analyze Now
                      </Button>
                    </div>
                  )}

                  {/* Loading */}
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <Spin />
                    </div>
                  )}

                  {/* Story list */}
                  {stories.map((story) => (
                    <button
                      key={story.id}
                      onClick={() => viewStory(story.id)}
                      className="w-full text-left bg-bg-elevated border border-border rounded-lg px-4 py-3 hover:border-accent-primary hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${severityBadge(story.severity)}`}>
                              {story.severity}
                            </span>
                            <span className="text-[11px] text-fg-tertiary">{ago(story.detected_at)}</span>
                          </div>
                          <h4 className="text-sm font-medium text-fg-primary leading-snug truncate">{story.title}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-fg-tertiary">{story.anomaly_count} anomalies</span>
                            <span className="text-fg-disabled">·</span>
                            <span className="text-[11px] text-fg-tertiary truncate">{story.affected_services.slice(0, 3).join(', ')}{story.affected_services.length > 3 ? ` +${story.affected_services.length - 3}` : ''}</span>
                          </div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-1"><polyline points="9 18 15 12 9 6" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
