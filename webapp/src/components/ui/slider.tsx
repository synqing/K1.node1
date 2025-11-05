"use client";

import * as React from "react";
import { cn } from "./utils";

type SliderProps = {
  className?: string;
  defaultValue?: number[] | number;
  value?: number[] | number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  onValueChange?: (value: number[]) => void;
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  orientation = "horizontal",
  onValueChange,
}: SliderProps) {
  const initial = React.useMemo(() => {
    if (Array.isArray(value) && value.length) return value[0] ?? min;
    if (typeof value === "number") return value;
    if (Array.isArray(defaultValue) && defaultValue.length)
      return defaultValue[0] ?? min;
    if (typeof defaultValue === "number") return defaultValue;
    return min;
  }, [value, defaultValue, min]);

  const [internal, setInternal] = React.useState<number>(initial);
  const controlled = value !== undefined;
  const current = controlled
    ? Array.isArray(value)
      ? value[0] ?? min
      : (value as number)
    : internal;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    if (!controlled) setInternal(next);
    onValueChange?.([next]);
  };

  return (
    <div
      data-slot="slider"
      className={cn(
        "relative flex w-full select-none items-center",
        orientation === "vertical" && "flex-col h-full min-h-44",
        disabled && "opacity-50",
        className,
      )}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "w-full h-2 rounded-lg bg-muted appearance-none",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
          "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary",
        )}
      />
    </div>
  );
}

export { Slider };
