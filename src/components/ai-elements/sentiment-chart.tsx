"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import type { PostSentimentPoint } from "@/lib/sentiment";
import { LineChart, Line, XAxis, CartesianGrid, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type SentimentChartProps = {
  data: PostSentimentPoint[];
  title?: string;
  description?: string;
};

function formatTs(ts: number) {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export function SentimentChart({
  data,
  title = "Sentiment over time",
  description = "",
}: SentimentChartProps) {
  const safe = Array.isArray(data) ? data : [];
  const chartData = safe.map((d) => ({
    ...d,
    tsLabel: formatTs(d.timestamp),
  }));

  if (chartData.length === 0) {
    return (
      <Card className="border">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No sentiment data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = {
    score: { label: "Score", color: "var(--chart-1)" },
  } as const;

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config as any}>
          <LineChart
            data={chartData}
            accessibilityLayer
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} horizontal={false} />
            <XAxis
              dataKey="tsLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => String(value)}
            />
            <YAxis
              dataKey="score"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => String(value)}
            />
            <ChartTooltip
              cursor={true}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey="score"
              type="natural"
              stroke="var(--color-score)"
              strokeWidth={2}
              dot={false}
              name="Score"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default SentimentChart;
