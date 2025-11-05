import { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Clock, Pause } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { CommandHistoryItem } from '../../lib/types';
import { AVAILABLE_COMMANDS, executeCommand } from '../../lib/mockData';
import { ScrollArea } from '../ui/scroll-area';

export function TerminalView() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([
    {
      command: 'help',
      output: AVAILABLE_COMMANDS.map(c => `${c.cmd.padEnd(8)} - ${c.desc}`).join('\n'),
      timestamp: Date.now() - 10000,
      type: 'info',
    },
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>(['help']);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, autoScroll]);
  
  const handleExecute = () => {
    if (!command.trim()) return;
    
    const result = executeCommand(command);
    const newEntry: CommandHistoryItem = {
      command,
      output: result.output,
      timestamp: Date.now(),
      type: result.type,
    };
    
    setHistory(prev => [...prev, newEntry]);
    setCommandHistory(prev => {
      const updated = [command, ...prev.filter(c => c !== command)];
      return updated.slice(0, 10);
    });
    setCommand('');
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExecute();
    }
  };
  
  const getTypeColor = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success': return 'var(--prism-success)';
      case 'error': return 'var(--prism-error)';
      case 'info': return 'var(--prism-info)';
    }
  };
  
  return (
    <div className="flex-1 flex gap-6 p-6 h-full overflow-hidden">
      {/* Main Terminal */}
      <div className="flex-1 flex flex-col bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] overflow-hidden">
        <div className="p-4 border-b border-[var(--prism-bg-elevated)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--prism-gold)]" />
            <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">Device Terminal</h3>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors bg-[var(--prism-bg-elevated)] hover:bg-[var(--prism-bg-canvas)] text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
            >
              {autoScroll ? (
                <>
                  <Clock className="w-3 h-3" />
                  Auto-scroll
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3" />
                  Paused
                </>
              )}
            </button>
            
            <Button
              onClick={() => setHistory([])}
              size="sm"
              variant="ghost"
              className="text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
            >
              Clear
            </Button>
          </div>
        </div>
        
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 font-jetbrains text-xs"
        >
          {history.map((entry, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[var(--prism-gold)]">$</span>
                <span className="text-[var(--prism-text-primary)]">{entry.command}</span>
                <span className="text-[var(--prism-text-secondary)] text-[10px] ml-auto">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {entry.output && (
                <pre 
                  className="pl-4 whitespace-pre-wrap"
                  style={{ color: getTypeColor(entry.type) }}
                >
                  {entry.output}
                </pre>
              )}
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-canvas)]">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[var(--prism-bg-elevated)] rounded-lg px-3 py-2">
              <span className="text-[var(--prism-gold)] font-jetbrains text-sm">$</span>
              <Input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter command..."
                className="flex-1 bg-transparent border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 font-jetbrains text-sm text-[var(--prism-text-primary)] placeholder:text-[var(--prism-text-secondary)]/50"
                autoFocus
              />
            </div>
            <Button
              onClick={handleExecute}
              size="sm"
              className="bg-[var(--prism-gold)] hover:bg-[var(--prism-gold)]/90 text-[var(--prism-bg-canvas)]"
            >
              <Send className="w-4 h-4 mr-2" />
              Execute
            </Button>
          </div>
        </div>
      </div>
      
      {/* Sidebar - Command History and Help */}
      <div className="w-80 space-y-4">
        {/* Command History */}
        <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
          <h4 className="text-sm font-medium text-[var(--prism-text-primary)] mb-3">Command History</h4>
          <div className="space-y-1">
            {commandHistory.slice(0, 10).map((cmd, index) => (
              <button
                key={index}
                onClick={() => setCommand(cmd)}
                className="w-full text-left px-3 py-2 rounded-md text-xs font-jetbrains text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)] transition-colors"
              >
                {cmd}
              </button>
            ))}
            {commandHistory.length === 0 && (
              <p className="text-xs text-[var(--prism-text-secondary)] text-center py-4">
                No history yet
              </p>
            )}
          </div>
        </div>
        
        {/* Available Commands */}
        <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
          <h4 className="text-sm font-medium text-[var(--prism-text-primary)] mb-3">Available Commands</h4>
          <div className="space-y-2">
            {AVAILABLE_COMMANDS.map((cmd) => (
              <div key={cmd.cmd} className="space-y-1">
                <button
                  onClick={() => setCommand(cmd.cmd)}
                  className="w-full text-left"
                >
                  <code className="text-xs font-jetbrains text-[var(--prism-gold)] hover:text-[var(--prism-gold)]/80 cursor-pointer">
                    {cmd.cmd}
                  </code>
                </button>
                <p className="text-xs text-[var(--prism-text-secondary)] pl-2">
                  {cmd.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
