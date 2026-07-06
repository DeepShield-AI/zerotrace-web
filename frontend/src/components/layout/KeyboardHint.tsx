/* ── Keyboard shortcut hint toast ── */

export default function KeyboardHint({ visible, shortcut, label }: { visible: boolean; shortcut: string; label: string }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-bg-inverse text-fg-inverse px-4 py-2 rounded-lg shadow-xl text-[12px] z-50 flex items-center gap-3 animate-fade-in">
      <kbd className="bg-bg-elevated/20 text-fg-inverse/80 px-1.5 py-0.5 rounded text-[11px] font-mono">{shortcut}</kbd>
      <span>{label}</span>
    </div>
  );
}
