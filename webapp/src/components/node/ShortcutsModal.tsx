import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const shortcuts = [
    { category: 'Navigation', items: [
      { key: 'Space + Drag', desc: 'Pan canvas' },
      { key: '+/=', desc: 'Zoom in' },
      { key: '-', desc: 'Zoom out' },
      { key: '1', desc: 'Reset zoom' },
      { key: 'F', desc: 'Fit to view' },
    ]},
    { category: 'Nodes', items: [
      { key: '/', desc: 'Open node palette' },
      { key: 'Delete', desc: 'Delete selected node' },
      { key: 'Cmd/Ctrl + C', desc: 'Copy selected node' },
      { key: 'Cmd/Ctrl + V', desc: 'Paste node' },
      { key: 'Cmd/Ctrl + D', desc: 'Duplicate node' },
    ]},
    { category: 'History', items: [
      { key: 'Cmd/Ctrl + Z', desc: 'Undo' },
      { key: 'Cmd/Ctrl + Y', desc: 'Redo' },
      { key: 'Cmd/Ctrl + Shift + Z', desc: 'Redo (alt)' },
    ]},
    { category: 'General', items: [
      { key: '?', desc: 'Show shortcuts' },
      { key: 'Esc', desc: 'Deselect / Close modal' },
    ]},
  ];
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--prism-bg-surface)] border-[var(--prism-bg-elevated)] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--prism-text-primary)]">Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-[var(--prism-text-secondary)]">
            View all available keyboard shortcuts
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h4 className="text-sm font-medium text-[var(--prism-text-primary)] mb-3">{section.category}</h4>
              <div className="space-y-2">
                {section.items.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--prism-text-secondary)]">{shortcut.desc}</span>
                    <kbd className="px-2 py-1 text-xs font-jetbrains bg-[var(--prism-bg-elevated)] rounded border border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
