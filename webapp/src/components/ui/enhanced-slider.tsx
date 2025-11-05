"use client";

import * as React from "react";
import { cn } from "./utils";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { AlertCircle, CheckCircle, Loader2, Zap } from "lucide-react";

export interface SliderVisualConfig {
  showPreview?: boolean;
  showGradient?: boolean;
  showRipple?: boolean;
  animationSpeed?: number;
  glowIntensity?: number;
  trackStyle?: 'default' | 'glow' | 'neon' | 'minimal';
  thumbStyle?: 'default' | 'glow' | 'pulse' | 'reactive';
}

export interface SliderState {
  value: number;
  isChanging: boolean;
  lastChangeTime: number;
  errorState?: string;
  confirmationState?: 'pending' | 'confirmed' | 'failed';
  performanceMetrics?: {
    updateLatency: number;
    networkLatency: number;
    renderTime: number;
  };
}

export interface EnhancedSliderProps {
  className?: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => Promise<void>;
  
  // Enhanced features
  visualConfig?: SliderVisualConfig;
  label?: string;
  unit?: string;
  description?: string;
  previewRenderer?: (value: number) => React.ReactNode;
  errorHandler?: (error: Error) => void;
  performanceMonitor?: (metrics: SliderState['performanceMetrics']) => void;
  
  // Runtime modification capabilities
  dynamicRange?: { min: number; max: number };
  adaptiveStep?: boolean;
  contextualHelp?: boolean;
  realTimeValidation?: (value: number) => string | null;
}

export function EnhancedSlider({
  className,
  value: controlledValue,
  defaultValue = 0,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  orientation = "horizontal",
  onValueChange,
  onValueCommit,
  visualConfig = {},
  label,
  unit,
  description,
  previewRenderer,
  errorHandler,
  performanceMonitor,
  dynamicRange,
  adaptiveStep,
  contextualHelp,
  realTimeValidation,
}: EnhancedSliderProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [sliderState, setSliderState] = React.useState<SliderState>({
    value: controlledValue ?? defaultValue,
    isChanging: false,
    lastChangeTime: 0,
  });

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;
  
  // Dynamic range adjustment
  const effectiveMin = dynamicRange?.min ?? min;
  const effectiveMax = dynamicRange?.max ?? max;
  const effectiveStep = adaptiveStep ? Math.max(step, (effectiveMax - effectiveMin) / 100) : step;

  // Motion values for smooth animations
  const motionValue = useMotionValue(currentValue);
  const springValue = useSpring(motionValue, {
    stiffness: visualConfig.animationSpeed ? 300 * visualConfig.animationSpeed : 300,
    damping: 30,
  });

  // Performance tracking
  const performanceRef = React.useRef({
    updateStartTime: 0,
    renderStartTime: 0,
  });

  React.useEffect(() => {
    motionValue.set(currentValue);
  }, [currentValue, motionValue]);

  const handleValueChange = React.useCallback(async (newValue: number) => {
    const startTime = performance.now();
    performanceRef.current.updateStartTime = startTime;

    // Real-time validation
    const validationError = realTimeValidation?.(newValue);
    if (validationError) {
      setSliderState(prev => ({ ...prev, errorState: validationError }));
      return;
    }

    setSliderState(prev => ({
      ...prev,
      value: newValue,
      isChanging: true,
      lastChangeTime: startTime,
      errorState: undefined,
    }));

    if (!isControlled) {
      setInternalValue(newValue);
    }

    onValueChange?.(newValue);

    // Handle async commit if provided
    if (onValueCommit) {
      try {
        setSliderState(prev => ({ ...prev, confirmationState: 'pending' }));
        await onValueCommit(newValue);
        
        const endTime = performance.now();
        const metrics = {
          updateLatency: endTime - startTime,
          networkLatency: endTime - startTime, // Simplified for demo
          renderTime: performance.now() - performanceRef.current.renderStartTime,
        };

        setSliderState(prev => ({
          ...prev,
          confirmationState: 'confirmed',
          isChanging: false,
          performanceMetrics: metrics,
        }));

        performanceMonitor?.(metrics);
      } catch (error) {
        setSliderState(prev => ({
          ...prev,
          confirmationState: 'failed',
          isChanging: false,
          errorState: error instanceof Error ? error.message : 'Update failed',
        }));
        errorHandler?.(error instanceof Error ? error : new Error('Update failed'));
      }
    } else {
      setSliderState(prev => ({ ...prev, isChanging: false }));
    }
  }, [isControlled, onValueChange, onValueCommit, realTimeValidation, errorHandler, performanceMonitor]);

  const getTrackClassName = () => {
    const base = "relative w-full h-2 rounded-full overflow-hidden";
    switch (visualConfig.trackStyle) {
      case 'glow':
        return cn(base, "bg-gradient-to-r from-blue-900/20 to-purple-900/20 shadow-lg shadow-blue-500/20");
      case 'neon':
        return cn(base, "bg-black border border-cyan-400/50 shadow-lg shadow-cyan-400/30");
      case 'minimal':
        return cn(base, "bg-muted/50");
      default:
        return cn(base, "bg-muted");
    }
  };

  const getThumbClassName = () => {
    const base = "absolute w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200";
    switch (visualConfig.thumbStyle) {
      case 'glow':
        return cn(base, "bg-primary border-primary shadow-lg shadow-primary/50");
      case 'pulse':
        return cn(base, "bg-primary border-primary animate-pulse");
      case 'reactive':
        return cn(base, sliderState.isChanging ? "bg-yellow-400 border-yellow-400 scale-110" : "bg-primary border-primary");
      default:
        return cn(base, "bg-primary border-primary");
    }
  };

  const renderStatusIndicator = () => {
    if (!sliderState.confirmationState) return null;

    const icons = {
      pending: <Loader2 className="w-3 h-3 animate-spin" />,
      confirmed: <CheckCircle className="w-3 h-3 text-green-500" />,
      failed: <AlertCircle className="w-3 h-3 text-red-500" />,
    };

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center gap-1"
        >
          {icons[sliderState.confirmationState]}
          {sliderState.performanceMetrics && (
            <span className="text-xs text-muted-foreground">
              {Math.round(sliderState.performanceMetrics.updateLatency)}ms
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderPreview = () => {
    if (!visualConfig.showPreview || !previewRenderer) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 p-2 rounded bg-muted/50 border"
      >
        {previewRenderer(currentValue)}
      </motion.div>
    );
  };

  const renderGradientTrack = () => {
    if (!visualConfig.showGradient) return null;

    const percentage = ((currentValue - effectiveMin) / (effectiveMax - effectiveMin)) * 100;

    return (
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
        style={{
          width: `${percentage}%`,
          opacity: visualConfig.glowIntensity ?? 0.6,
        }}
        animate={{
          opacity: sliderState.isChanging ? (visualConfig.glowIntensity ?? 0.6) * 1.5 : visualConfig.glowIntensity ?? 0.6,
        }}
      />
    );
  };

  const renderRippleEffect = () => {
    if (!visualConfig.showRipple || !sliderState.isChanging) return null;

    return (
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/20"
        initial={{ scale: 0.8, opacity: 0.8 }}
        animate={{ scale: 1.2, opacity: 0 }}
        transition={{ duration: 0.6 }}
      />
    );
  };

  performanceRef.current.renderStartTime = performance.now();

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with label and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {label && (
            <label className="text-sm font-medium text-foreground">
              {label}
            </label>
          )}
          {contextualHelp && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="w-4 h-4 rounded-full bg-muted flex items-center justify-center cursor-help"
              title={description}
            >
              <span className="text-xs">?</span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono">
            {currentValue}
            {unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
          </span>
          {renderStatusIndicator()}
        </div>
      </div>

      {/* Error display */}
      <AnimatePresence>
        {sliderState.errorState && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800"
          >
            {sliderState.errorState}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slider track */}
      <div className="relative">
        <div className={getTrackClassName()}>
          {renderGradientTrack()}
          {renderRippleEffect()}
          
          {/* Thumb */}
          <motion.div
            className={getThumbClassName()}
            style={{
              left: `calc(${((currentValue - effectiveMin) / (effectiveMax - effectiveMin)) * 100}% - 10px)`,
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          />
        </div>

        {/* Hidden input for accessibility */}
        <input
          type="range"
          min={effectiveMin}
          max={effectiveMax}
          step={effectiveStep}
          value={currentValue}
          onChange={(e) => handleValueChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={label}
        />
      </div>

      {/* Range indicators */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{effectiveMin}{unit}</span>
        <span>{effectiveMax}{unit}</span>
      </div>

      {/* Preview */}
      {renderPreview()}

      {/* Performance metrics (debug mode) */}
      {sliderState.performanceMetrics && process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground bg-muted/30 p-1 rounded">
          Update: {Math.round(sliderState.performanceMetrics.updateLatency)}ms | 
          Render: {Math.round(sliderState.performanceMetrics.renderTime)}ms
        </div>
      )}
    </div>
  );
}