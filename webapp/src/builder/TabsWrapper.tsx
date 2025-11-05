import { useEffect, useState } from "react";
import { cn } from "@/components/ui/utils";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export interface TabsWrapperItem {
  label: string;
  value: string;
  content?: React.ReactNode;
}

export interface TabsWrapperProps {
  value?: string;
  tabs: TabsWrapperItem[];
  className?: string;
}

export function TabsWrapper({ value, tabs, className }: TabsWrapperProps) {
  if (!tabs?.length) {
    return null;
  }

  const firstValue = tabs[0]?.value ?? "";
  const [internalValue, setInternalValue] = useState(value ?? firstValue);

  useEffect(() => {
    if (typeof value === "string") {
      setInternalValue(value);
    }
  }, [value]);

  const activeValue = internalValue || firstValue;

  return (
    <Tabs
      value={value}
      defaultValue={firstValue}
      onValueChange={setInternalValue}
      className={cn(className)}
    >
      <TabsList className="grid w-full grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} hidden={activeValue !== tab.value}>
          {tab.content ?? (
            <div className="rounded-md border border-dashed border-[var(--prism-bg-elevated)]/50 p-4 text-sm text-[var(--prism-text-secondary)]">
              No content provided for “{tab.label}”.
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

