import { ZoomIn, ZoomOut, Maximize, Grid3x3, Undo2, Redo2, HelpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ToolbarProps {
  zoom: number;
  showGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToView: () => void;
  onToggleGrid: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShowShortcuts: () => void;
}

export function Toolbar({
  zoom,
  showGrid,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToView,
  onToggleGrid,
  onUndo,
  onRedo,
  onShowShortcuts,
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded-lg p-2 shadow-lg">
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-8 w-8 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] disabled:opacity-30"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
              Undo (Cmd+Z)
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-8 w-8 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] disabled:opacity-30"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
              Redo (Cmd+Y)
            </TooltipContent>
          </Tooltip>
        </div>
        
        <Separator orientation="vertical" className="h-6 bg-[var(--prism-bg-elevated)]" />
        
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onZoomOut}
                className="h-8 w-8 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
              Zoom Out (-)
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onZoomReset}
                className="h-8 min-w-[3rem] px-2 text-xs font-jetbrains text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
              >
                {Math.round(zoom * 100)}%
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
              Reset Zoom (1)
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onZoomIn}
                className="h-8 w-8 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
              Zoom In (+)
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onFitToView}
                className="h-8 w-8 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
              Fit to View (F)
            </TooltipContent>
          </Tooltip>
        </div>
        
        <Separator orientation="vertical" className="h-6 bg-[var(--prism-bg-elevated)]" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleGrid}
              className={`h-8 w-8 p-0 ${
                showGrid
                  ? 'text-[var(--prism-info)]'
                  : 'text-[var(--prism-text-secondary)]'
              } hover:text-[var(--prism-text-primary)]`}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
            Toggle Grid
          </TooltipContent>
        </Tooltip>
        
        <Separator orientation="vertical" className="h-6 bg-[var(--prism-bg-elevated)]" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowShortcuts}
              className="h-8 w-8 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
            Keyboard Shortcuts (?)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
