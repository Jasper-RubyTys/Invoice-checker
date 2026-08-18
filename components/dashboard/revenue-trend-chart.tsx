"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/lib/use-theme";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { MonthlyRevenuePoint } from "@/lib/dashboard-data";

interface RevenueTrendChartProps {
  data: MonthlyRevenuePoint[];
  currencyCode: string;
}

/**
 * Explicit per-theme hex values (matching app/globals.css's --color-ruby /
 * --color-divider / --color-foreground-muted / --color-canvas-raised), not
 * CSS custom properties — keeps SVG stroke/fill resolution simple and
 * predictable rather than depending on var() support inside SVG attributes.
 */
const THEME_COLORS = {
  light: { line: "#d2375a", grid: "#ebebeb", axisText: "#525252", tooltipBg: "#f5f5f5" },
  dark: { line: "#cf3b5f", grid: "#1a1a1c", axisText: "#c8c8cc", tooltipBg: "#18181b" },
};

export function RevenueTrendChart({ data, currencyCode }: RevenueTrendChartProps) {
  const { theme } = useTheme();
  const colors = THEME_COLORS[theme];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonthLabel}
          tick={{ fill: colors.axisText, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => new Intl.NumberFormat("nl-NL").format(value)}
          tick={{ fill: colors.axisText, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          cursor={{ stroke: colors.line, strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as MonthlyRevenuePoint;
            return (
              <div className="chart-tooltip">
                <p className="chart-tooltip-value">{formatCurrency(point.revenueExVat, currencyCode)}</p>
                <p className="chart-tooltip-label">{formatMonthLabel(point.month)}</p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="revenueExVat"
          stroke={colors.line}
          strokeWidth={2}
          fill={colors.line}
          fillOpacity={0.1}
          activeDot={{ r: 4, stroke: colors.tooltipBg, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
