/**
 * High-Performance Parameter Slider Component
 * 
 * Task 5.2: Build high-performance, accessible slider components with numeric readouts
 * - Reusable slider with 0–100 range, step=1, live percentage readout
 * - Optimized re-renders via React.memo and value-only props
 * - Pointer events for smooth drag, aria labels for accessibility
 * - onChange/onCommit callbacks compatible with coalescing logic
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { RotateCcw } from 'lucide-react';
import { type ParamMetadata, clampParam, formatParamValue } from '../../lib/parameters';

interface ParamSliderProps {
  metadata: ParamMetadata;
  value: number;
  onChange: (key: string, value: number) => void;
  onCommit?: (key: string, value: number) => void;
  disabled?: boolean;
  showReset?: boolean;
  className?: string;
}

/**
 * Memoized parameter slider component for optimal performance
 */
export const ParamSlider = React.memo<ParamSliderProps>(({
  metadata,
  value,
  onChange,
  onCommit,
  disabled = false,
  showReset = true,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const [isInputFocused, setIsInputFocused] = useState(false);
  const lastCommittedValueRef = useRef(value);
  const dragStartValueRef = useRef(value);
  
  // Update input value when prop value changes (but not during input focus)
  useEffect(() => {
    if (!isInputFocused) {
      setInputValue(value.toString());
    }
  }, [value, isInputFocused]);
  
  // Handle slider value changes (during drag)
  const handleSliderChange = useCallback((newValues: number[]) => {
    const newValue = clampParam(newValues[0]);
    onChange(metadata.key, newValue);
  }, [metadata.key, onChange]);
  
  // Handle slider drag start
  const handleSliderPointerDown = useCallback(() => {
    setIsDragging(true);
    dragStartValueRef.current = value;
  }, [value]);
  
  // Handle slider drag end (commit)
  const handleSliderPointerUp = useCallback(() => {
    setIsDragging(false);
    
    // Only commit if value actually changed
    if (value !== lastCommittedValueRef.current) {
      lastCommittedValueRef.current = value;
      onCommit?.(metadata.key, value);
    }
  }, [value, metadata.key, onCommit]);
  
  // Handle direct input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    setInputValue(inputVal);
    
    // Parse and validate input
    const numValue = parseFloat(inputVal);
    if (!isNaN(numValue)) {
      const clampedValue = clampParam(numValue);
      onChange(metadata.key, clampedValue);
    }
  }, [metadata.key, onChange]);
  
  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
  }, []);
  
  // Handle input blur (commit)
  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    
    // Parse final value and commit
    const numValue = parseFloat(inputValue);
    const finalValue = isNaN(numValue) ? value : clampParam(numValue);
    
    setInputValue(finalValue.toString());
    
    if (finalValue !== value) {
      onChange(metadata.key, finalValue);
    }
    
    if (finalValue !== lastCommittedValueRef.current) {
      lastCommittedValueRef.current = finalValue;
      onCommit?.(metadata.key, finalValue);
    }
  }, [inputValue, value, metadata.key, onChange, onCommit]);
  
  // Handle input key press (Enter to commit, Escape to cancel)
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setInputValue(value.toString());
      e.currentTarget.blur();
    }
  }, [value]);
  
  // Handle reset to default
  const handleReset = useCallback(() => {
    const defaultValue = metadata.defaultValue;
    onChange(metadata.key, defaultValue);
    onCommit?.(metadata.key, defaultValue);
    setInputValue(defaultValue.toString());
  }, [metadata.key, metadata.defaultValue, onChange, onCommit]);
  
  // Keyboard navigation for slider
  const handleSliderKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newValue = value;
    const step = e.shiftKey ? 10 : 1; // Shift for larger steps
    
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        newValue = clampParam(value + step);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        newValue = clampParam(value - step);
        break;
      case 'Home':
        e.preventDefault();
        newValue = metadata.min;
        break;
      case 'End':
        e.preventDefault();
        newValue = metadata.max;
        break;
      case 'PageUp':
        e.preventDefault();
        newValue = clampParam(value + 10);
        break;
      case 'PageDown':
        e.preventDefault();
        newValue = clampParam(value - 10);
        break;
      default:
        return;
    }
    
    if (newValue !== value) {
      onChange(metadata.key, newValue);
      onCommit?.(metadata.key, newValue);
    }
  }, [value, metadata.key, metadata.min, metadata.max, onChange, onCommit]);
  
  const isAtDefault = value === metadata.defaultValue;
  const formattedValue = formatParamValue(value, metadata);
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with label and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={metadata.label}>
            {metadata.icon}
          </span>
          <Label 
            htmlFor={`param-${metadata.key}`}
            className="text-sm font-medium text-[var(--prism-text-primary)]"
          >
            {metadata.label}
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Numeric input */}
          <div className="relative">
            <Input
              id={`param-${metadata.key}-input`}
              type="number"
              min={metadata.min}
              max={metadata.max}
              step={metadata.step}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              disabled={disabled}
              className="w-16 h-7 text-xs text-center font-mono bg-[var(--prism-bg-canvas)] border-[var(--prism-bg-elevated)]"
              aria-label={`${metadata.label} value`}
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-[var(--prism-text-secondary)] pointer-events-none">
              %
            </span>
          </div>
          
          {/* Reset button */}
          {showReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={disabled || isAtDefault}
              className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
              title={`Reset ${metadata.label} to default (${metadata.defaultValue}%)`}
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Slider */}
      <div className="px-1">
        <Slider
          id={`param-${metadata.key}`}
          min={metadata.min}
          max={metadata.max}
          step={metadata.step}
          value={[value]}
          onValueChange={handleSliderChange}
          onPointerDown={handleSliderPointerDown}
          onPointerUp={handleSliderPointerUp}
          onKeyDown={handleSliderKeyDown}
          disabled={disabled}
          className="w-full"
          aria-label={`${metadata.label}: ${formattedValue}`}
          aria-describedby={`param-${metadata.key}-desc`}
        />
      </div>
      
      {/* Description and status */}
      <div className="flex items-center justify-between text-xs">
        <span 
          id={`param-${metadata.key}-desc`}
          className="text-[var(--prism-text-secondary)]"
        >
          {metadata.description}
        </span>
        
        <div className="flex items-center gap-2">
          {/* Drag indicator */}
          {isDragging && (
            <span className="text-[var(--prism-info)] font-medium">
              Adjusting...
            </span>
          )}
          
          {/* Value display */}
          <span className="font-mono text-[var(--prism-text-primary)]">
            {formattedValue}
          </span>
          
          {/* Default indicator */}
          {isAtDefault && (
            <span className="text-[var(--prism-text-secondary)]" title="Default value">
              ●
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

ParamSlider.displayName = 'ParamSlider';

/**
 * Lightweight slider for cases where full metadata isn't needed
 */
interface SimpleSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

export const SimpleSlider = React.memo<SimpleSliderProps>(({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className = ''
}) => {
  const handleChange = useCallback((values: number[]) => {
    onChange(clampParam(values[0]));
  }, [onChange]);
  
  const handleCommit = useCallback(() => {
    onCommit?.(value);
  }, [value, onCommit]);
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-[var(--prism-text-primary)]">
          {label}
        </Label>
        <span className="text-xs font-mono text-[var(--prism-text-primary)]">
          {clampParam(value)}%
        </span>
      </div>
      
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={handleChange}
        onPointerUp={handleCommit}
        disabled={disabled}
        className="w-full"
        aria-label={`${label}: ${clampParam(value)}%`}
      />
    </div>
  );
});

SimpleSlider.displayName = 'SimpleSlider';