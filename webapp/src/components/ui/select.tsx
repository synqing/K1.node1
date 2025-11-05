"use client";

import * as React from "react";
import { Suspense, lazy } from "react";

// Lazy-map each named export from the full implementation
const SelectImpl = lazy(() => import("./select.full").then(m => ({ default: m.Select })));
const SelectContentImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectContent })));
const SelectGroupImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectGroup })));
const SelectItemImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectItem })));
const SelectLabelImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectLabel })));
const SelectScrollDownButtonImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectScrollDownButton })));
const SelectScrollUpButtonImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectScrollUpButton })));
const SelectSeparatorImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectSeparator })));
const SelectTriggerImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectTrigger })));
const SelectValueImpl = lazy(() => import("./select.full").then(m => ({ default: m.SelectValue })));

const fallbackEl = <div className="h-8 w-full rounded bg-[color-mix(in_oklab,var(--foreground)_15%,transparent)]/10" />;

function withSuspense<T extends object>(Comp: React.ComponentType<any>) {
  return function Wrapper(props: T) {
    return (
      <Suspense fallback={fallbackEl}>
        <Comp {...props} />
      </Suspense>
    );
  };
}

const Select = withSuspense(SelectImpl);
const SelectContent = withSuspense(SelectContentImpl);
const SelectGroup = withSuspense(SelectGroupImpl);
const SelectItem = withSuspense(SelectItemImpl);
const SelectLabel = withSuspense(SelectLabelImpl);
const SelectScrollDownButton = withSuspense(SelectScrollDownButtonImpl);
const SelectScrollUpButton = withSuspense(SelectScrollUpButtonImpl);
const SelectSeparator = withSuspense(SelectSeparatorImpl);
const SelectTrigger = withSuspense(SelectTriggerImpl);
const SelectValue = withSuspense(SelectValueImpl);

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
