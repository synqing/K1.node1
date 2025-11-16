"use client";

import * as SelectFull from "./select.full";

// Temporarily disable the lazy-loading wrapper to avoid Vite chunk warnings.
// Once all consumers consistently use dynamic imports we can restore the
// Suspense-based implementation.

const Select = SelectFull.Select;
const SelectContent = SelectFull.SelectContent;
const SelectGroup = SelectFull.SelectGroup;
const SelectItem = SelectFull.SelectItem;
const SelectLabel = SelectFull.SelectLabel;
const SelectScrollDownButton = SelectFull.SelectScrollDownButton;
const SelectScrollUpButton = SelectFull.SelectScrollUpButton;
const SelectSeparator = SelectFull.SelectSeparator;
const SelectTrigger = SelectFull.SelectTrigger;
const SelectValue = SelectFull.SelectValue;

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
