import { Builder } from "@builder.io/react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CardWrapper } from "@/builder/CardWrapper";
import { TabsWrapper } from "@/builder/TabsWrapper";
import { MetricTileWrapper } from "@/builder/MetricTileWrapper";
import { TerminalPanelWrapper } from "@/builder/TerminalPanelWrapper";
import { ProfilingChartsWrapper } from "@/builder/ProfilingChartsWrapper";
import type { EffectType } from "@/lib/types";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "sm" | "default" | "lg" | "icon";

interface BuilderButtonProps extends ComponentProps<typeof Button> {
  text?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BuilderButton = ({ text, children, asChild, ...props }: BuilderButtonProps) => {
  return <Button {...props}>{asChild ? children : text}</Button>;
};

interface BuilderTabsItem {
  label: string;
  value: string;
  content?: ReactNode;
}

interface BuilderTabsProps {
  value?: string;
  tabs: BuilderTabsItem[];
  className?: string;
}

const BuilderTabs = ({ value, tabs, className }: BuilderTabsProps) => (
  <TabsWrapper value={value} tabs={tabs} className={className} />
);

const EFFECT_OPTIONS: Array<EffectType | "all"> = [
  "all",
  "Analog",
  "Spectrum",
  "Octave",
  "Metronome",
  "Spectronome",
  "Hype",
  "Bloom",
  "PULSE",
  "SPARKLE",
];

let registered = false;

export function registerBuilderComponents() {
  if (registered) return;
  registered = true;

  Builder.registerComponent(BuilderButton, {
    name: "Button",
    inputs: [
      {
        name: "variant",
        type: "enum",
        enum: ["default", "destructive", "outline", "secondary", "ghost", "link"],
        defaultValue: "default",
      },
      {
        name: "size",
        type: "enum",
        enum: ["sm", "default", "lg", "icon"],
        defaultValue: "default",
      },
      {
        name: "asChild",
        type: "boolean",
        defaultValue: false,
        helperText: "When true, wrap a custom child element instead of rendering default button text.",
      },
      {
        name: "text",
        type: "string",
        defaultValue: "Click me",
        helperText: "Button label when not rendering children.",
      },
      {
        name: "className",
        type: "string",
      },
      {
        name: "children",
        type: "BuilderElement",
        hideFromUI: true,
      },
    ],
  });

  Builder.registerComponent(CardWrapper, {
    name: "Card",
    inputs: [
      { name: "header", type: "string" },
      { name: "subheader", type: "string" },
      { name: "className", type: "string" },
      { name: "children", type: "BuilderElement" },
    ],
  });

  Builder.registerComponent(BuilderTabs, {
    name: "Tabs",
    inputs: [
      {
        name: "value",
        type: "string",
        helperText: "Optional active tab value. Leave blank to use the first tab.",
      },
      {
        name: "tabs",
        type: "list",
        subFields: [
          { name: "label", type: "string", required: true },
          { name: "value", type: "string", required: true },
          { name: "content", type: "BuilderElement" },
        ],
      },
      { name: "className", type: "string" },
    ],
  });

  Builder.registerComponent(MetricTileWrapper, {
    name: "MetricTile",
    inputs: [
      { name: "label", type: "string", required: true },
      { name: "value", type: "string", required: true },
      { name: "unit", type: "string" },
      {
        name: "trend",
        type: "enum",
        enum: ["up", "down", "flat"],
        defaultValue: "flat",
      },
      {
        name: "tone",
        type: "enum",
        enum: ["default", "success", "warning", "error", "info"],
        defaultValue: "default",
      },
      {
        name: "decimals",
        type: "number",
        helperText: "Decimal precision when value is numeric.",
      },
      { name: "className", type: "string" },
    ],
  });

  Builder.registerComponent(TerminalPanelWrapper, {
    name: "TerminalPanel",
    inputs: [
      { name: "initialCommand", type: "string", defaultValue: "help" },
      { name: "autoScroll", type: "boolean", defaultValue: true },
      { name: "historyLimit", type: "number", defaultValue: 1000 },
      { name: "className", type: "string" },
    ],
  });

  Builder.registerComponent(ProfilingChartsWrapper, {
    name: "ProfilingCharts",
    inputs: [
      {
        name: "selectedEffect",
        type: "enum",
        enum: EFFECT_OPTIONS,
        defaultValue: "all",
      },
      {
        name: "timeRange",
        type: "number",
        enum: [100, 500, 1000],
        defaultValue: 500,
        helperText: "Number of frames to display",
      },
      { name: "className", type: "string" },
    ],
  });
}

registerBuilderComponents();
