/**
 * PatternSelector Component
 * 
 * Task 4.2: Build PatternSelector grid UI with accessible navigation and tooltips
 * - Render grouped sections with headers and pattern cards
 * - Include icons, names, and descriptions with keyboard support
 * - Support arrow keys, Home/End for grid navigation
 * - Ensure tab order and focus management
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Loader2, X } from 'lucide-react';
import { 
  groupPatternsByCategory, 
  getPatternById, 
  type K1Pattern, 
  type PatternCategory 
} from '../../lib/patterns';
import { ConnectionState } from '../../lib/types';
import { useOptimisticPatternSelection } from '../../hooks/useOptimisticPatternSelection';

interface PatternSelectorProps {
  connectionState: ConnectionState;
  selectedPatternId?: string;
  onPatternSelect?: (patternId: string) => void;
  className?: string;
}

interface PatternCardProps {
  pattern: K1Pattern;
  isSelected: boolean;
  isPending: boolean;
  isDisabled: boolean;
  onClick: () => void;
  onFocus: () => void;
  tabIndex: number;
}

/**
 * Individual pattern card component
 */
function PatternCard({ 
  pattern, 
  isSelected, 
  isPending, 
  isDisabled, 
  onClick, 
  onFocus,
  tabIndex 
}: PatternCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Let parent handle arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      // Dispatch custom event for parent to handle
      const event = new CustomEvent('patternCardKeyDown', {
        bubbles: true,
        detail: { key: e.key, patternId: pattern.id }
      });
      cardRef.current?.dispatchEvent(event);
    }
  }, [pattern.id]);
  
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      tabIndex={tabIndex}
      className={`
        group relative p-4 rounded-lg border-2 transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-[var(--prism-info)] focus:ring-offset-2 focus:ring-offset-[var(--prism-bg-canvas)]
        disabled:opacity-50 disabled:cursor-not-allowed
        transform hover:scale-[1.02] active:scale-[0.98]
        shadow-sm hover:shadow-md active:shadow-sm
        ${isSelected 
          ? 'border-[var(--prism-info)] bg-gradient-to-br from-[var(--prism-info)]/10 to-[var(--prism-info)]/5 shadow-[var(--prism-info)]/20' 
          : 'border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-surface)] hover:border-[var(--prism-info)]/50 hover:bg-[var(--prism-bg-elevated)]'
        }
        ${isPending ? 'animate-pulse border-[var(--prism-info)] bg-[var(--prism-info)]/5' : ''}
        motion-safe:transition-all motion-reduce:transition-none
      `}
      aria-label={`Select ${pattern.name} pattern - ${pattern.description}`}
      aria-pressed={isSelected}
      title={`${pattern.name}: ${pattern.description}`}
    >
      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--prism-bg-surface)]/80 rounded-lg">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--prism-info)]" />
        </div>
      )}
      
      {/* Pattern icon */}
      <div className="text-2xl mb-2 group-hover:scale-110 group-focus:scale-110 transition-transform duration-200 motion-reduce:transform-none">
        {pattern.icon}
      </div>
      
      {/* Pattern name */}
      <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-1 line-clamp-1">
        {pattern.name}
      </h3>
      
      {/* Pattern description */}
      <p className="text-xs text-[var(--prism-text-secondary)] line-clamp-2 mb-2">
        {pattern.description}
      </p>
      
      {/* Pattern badges */}
      <div className="flex flex-wrap gap-1 justify-center">
        {pattern.isAudioReactive && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            Audio
          </Badge>
        )}
        {pattern.computeCost === 'high' && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            High CPU
          </Badge>
        )}
      </div>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-3 h-3 bg-[var(--prism-info)] rounded-full border-2 border-white shadow-md animate-pulse" />
      )}
      
      {/* High CPU indicator */}
      {pattern.computeCost === 'high' && (
        <div className="absolute top-2 left-2 w-2 h-2 bg-amber-500 rounded-full border border-white shadow-sm" title="High CPU usage" />
      )}
    </button>
  );
}

/**
 * Category section component
 */
interface CategorySectionProps {
  category: PatternCategory;
  patterns: K1Pattern[];
  selectedPatternId?: string;
  pendingPatternId?: string;
  isDisabled: boolean;
  onPatternClick: (pattern: K1Pattern) => void;
  onPatternFocus: (pattern: K1Pattern) => void;
  focusedPatternId?: string;
}

function CategorySection({
  category,
  patterns,
  selectedPatternId,
  pendingPatternId,
  isDisabled,
  onPatternClick,
  onPatternFocus,
  focusedPatternId
}: CategorySectionProps) {
  return (
    <div className="space-y-3" role="group" aria-labelledby={`category-${category}`}>
      {/* Category header */}
      <div className="flex items-center gap-2">
        <h2 
          id={`category-${category}`}
          className="text-lg font-semibold text-[var(--prism-text-primary)]"
        >
          {category}
        </h2>
        <Badge variant="outline" className="text-xs">
          {`${patterns.length} ${patterns.length === 1 ? 'pattern' : 'patterns'}`}
        </Badge>
      </div>
      
      {/* Pattern grid */}
      <div 
        className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
        role="grid"
        aria-label={`${category} patterns`}
      >
        {patterns.map((pattern) => (
          <div key={pattern.id} role="gridcell">
            <PatternCard
              pattern={pattern}
              isSelected={selectedPatternId === pattern.id}
              isPending={pendingPatternId === pattern.id}
              isDisabled={isDisabled}
              onClick={() => onPatternClick(pattern)}
              onFocus={() => onPatternFocus(pattern)}
              tabIndex={focusedPatternId === pattern.id ? 0 : -1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main PatternSelector component
 */
export function PatternSelector({ 
  connectionState, 
  selectedPatternId, 
  onPatternSelect,
  className = '' 
}: PatternSelectorProps) {
  const [focusedPatternId, setFocusedPatternId] = useState<string | undefined>();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const groupedPatterns = groupPatternsByCategory();
  const allPatterns = groupedPatterns.flatMap(group => group.patterns);
  
  // Use optimistic pattern selection hook
  const {
    pendingPatternId,
    lastError,
    isSelecting,
    selectPattern,
    clearError,
    cancelSelection,
    isPatternPending
  } = useOptimisticPatternSelection({
    connectionState,
    selectedPatternId,
    onPatternSelect,
    timeout: 2000 // 2 second timeout as specified
  });
  
  // Handle pattern selection using the optimistic hook
  const handlePatternSelect = useCallback(async (pattern: K1Pattern) => {
    await selectPattern(pattern);
  }, [selectPattern]);
  
  // Handle keyboard navigation
  const handleKeyboardNavigation = useCallback((e: CustomEvent) => {
    const { key, patternId } = e.detail;
    const currentIndex = allPatterns.findIndex(p => p.id === patternId);
    
    if (currentIndex === -1) return;
    
    let newIndex = currentIndex;
    const gridCols = 4; // Assuming 4 columns on desktop
    
    switch (key) {
      case 'ArrowLeft':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        newIndex = Math.min(allPatterns.length - 1, currentIndex + 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(0, currentIndex - gridCols);
        break;
      case 'ArrowDown':
        newIndex = Math.min(allPatterns.length - 1, currentIndex + gridCols);
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = allPatterns.length - 1;
        break;
    }
    
    if (newIndex !== currentIndex) {
      const newPattern = allPatterns[newIndex];
      setFocusedPatternId(newPattern.id);
      
      // Focus the new pattern card
      const newCard = containerRef.current?.querySelector(
        `button[aria-label*="${newPattern.name}"]`
      ) as HTMLButtonElement;
      newCard?.focus();
    }
  }, [allPatterns]);
  
  // Set up keyboard navigation event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleKeyDown = (e: Event) => {
      handleKeyboardNavigation(e as CustomEvent);
    };
    
    container.addEventListener('patternCardKeyDown', handleKeyDown);
    
    return () => {
      container.removeEventListener('patternCardKeyDown', handleKeyDown);
    };
  }, [handleKeyboardNavigation]);
  
  // Set initial focus if no pattern is focused
  useEffect(() => {
    if (!focusedPatternId && allPatterns.length > 0) {
      setFocusedPatternId(selectedPatternId || allPatterns[0].id);
    }
  }, [focusedPatternId, allPatterns, selectedPatternId]);
  
  const isDisabled = !connectionState.connected || isSelecting;
  
  return (
    <div 
      ref={containerRef}
      className={`space-y-6 ${className}`}
      role="application"
      aria-label="Pattern selector"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--prism-text-primary)]">
            Pattern Selection
          </h1>
          <p className="text-sm text-[var(--prism-text-secondary)]">
            Choose from {allPatterns.length} available patterns
          </p>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionState.connected 
              ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' 
              : 'bg-[var(--prism-text-secondary)]'
          }`} />
          <span className="text-xs text-[var(--prism-text-secondary)]">
            {connectionState.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      {/* In-flight selection indicator */}
      {isSelecting && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-medium">Activating pattern...</span>
            </div>
            <Button
              onClick={cancelSelection}
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-800 h-6 px-2"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}
      
      {/* Error display */}
      {lastError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-red-700">
              <div className="font-medium">Pattern Selection Error</div>
              <div>{lastError}</div>
            </div>
            <Button
              onClick={clearError}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-800 h-6 px-2"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Pattern categories */}
      <div className="space-y-8">
        {groupedPatterns.map(({ category, patterns }) => (
          <CategorySection
            key={category}
            category={category}
            patterns={patterns}
            selectedPatternId={selectedPatternId}
            pendingPatternId={pendingPatternId}
            isDisabled={isDisabled}
            onPatternClick={handlePatternSelect}
            onPatternFocus={(pattern) => setFocusedPatternId(pattern.id)}
            focusedPatternId={focusedPatternId}
          />
        ))}
      </div>
      
      {/* Instructions */}
      <div className="text-xs text-[var(--prism-text-secondary)] space-y-1 p-3 bg-[var(--prism-bg-elevated)] rounded-lg">
        <div className="font-medium">Keyboard Navigation:</div>
        <div>• Arrow keys: Navigate between patterns</div>
        <div>• Home/End: Jump to first/last pattern</div>
        <div>• Enter/Space: Select focused pattern</div>
        <div>• Tab: Move to next interactive element</div>
      </div>
    </div>
  );
}
