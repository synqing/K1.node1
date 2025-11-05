import type { ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/components/ui/utils";

export interface CardWrapperProps {
  header?: string;
  subheader?: string;
  children?: ReactNode;
  className?: string;
}

export function CardWrapper({ header, subheader, children, className }: CardWrapperProps) {
  return (
    <Card className={cn(className)}>
      {(header || subheader) && (
        <CardHeader>
          {header ? <CardTitle>{header}</CardTitle> : null}
          {subheader ? <CardDescription>{subheader}</CardDescription> : null}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

