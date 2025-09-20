"use client";

import * as React from "react";
import { Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig;
  height?: number;
  children?: React.ReactNode;
};

export function ChartContainer({
  config,
  className,
  style,
  height = 256,
  children,
  ...props
}: ChartContainerProps) {
  const cssVars: React.CSSProperties = { ...style };
  for (const [key, cfg] of Object.entries(config)) {
    (cssVars as any)[`--color-${key}`] = cfg.color;
  }
  return (
    <div className={cn("w-full", className)} style={cssVars} {...props}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type ChartTooltipProps = React.ComponentProps<typeof RechartsTooltip>;

export function ChartTooltip(props: ChartTooltipProps) {
  return <RechartsTooltip {...props} />;
}

type ChartTooltipContentProps = {
  hideLabel?: boolean;
  active?: boolean;
  payload?: any[];
  label?: string;
};

export function ChartTooltipContent({
  hideLabel,
  active,
  payload,
  label,
}: ChartTooltipContentProps) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0] || {};
  const value = item.value;
  const name = hideLabel ? "" : item.name ?? label ?? "";
  const color = item.stroke || item.color || "var(--foreground)";
  return (
    <div className="rounded-md border bg-popover p-2 text-popover-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-sm"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium">{String(value)}</span>
      </div>
      {name ? (
        <div className="text-xs text-muted-foreground mt-1">{String(name)}</div>
      ) : null}
    </div>
  );
}
