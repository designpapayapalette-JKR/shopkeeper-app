import React from "react";
import { View, Text, useWindowDimensions } from "react-native";
import Svg, { Rect, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { formatCurrencyLocale } from "../lib/i18n";

export interface ChartDataPoint {
  label: string;
  value: number;
}

export function SalesTrendBarChart({
  data,
  height = 160,
}: {
  data: ChartDataPoint[];
  height?: number;
}) {
  const { i18n } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(screenWidth - 72, 280);

  const maxValue = Math.max(...data.map((d) => d.value), 1000);
  const barWidth = Math.max((chartWidth - 40) / data.length - 12, 16);

  return (
    <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm my-2">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Weekly Sales Trend
        </Text>
        <Text className="text-xs font-extrabold text-primary">
          {formatCurrencyLocale(data.reduce((acc, d) => acc + d.value, 0), i18n.language)}
        </Text>
      </View>

      <Svg width={chartWidth} height={height}>
        <Defs>
          <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0368FE" stopOpacity="1" />
            <Stop offset="1" stopColor="#03A8FE" stopOpacity="0.8" />
          </SvgGradient>
        </Defs>

        {/* Grid lines */}
        <Line x1="0" y1="20" x2={chartWidth} y2="20" stroke="#E5E7EB" strokeDasharray="4 4" strokeWidth="1" />
        <Line x1="0" y1={height / 2} x2={chartWidth} y2={height / 2} stroke="#E5E7EB" strokeDasharray="4 4" strokeWidth="1" />
        <Line x1="0" y1={height - 30} x2={chartWidth} y2={height - 30} stroke="#E5E7EB" strokeWidth="1" />

        {/* Bars */}
        {data.map((point, index) => {
          const barHeight = Math.max((point.value / maxValue) * (height - 50), 6);
          const x = 20 + index * (barWidth + 12);
          const y = height - 30 - barHeight;

          return (
            <React.Fragment key={index}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={6}
                fill="url(#barGrad)"
              />
              <SvgText
                x={x + barWidth / 2}
                y={height - 10}
                fontSize="11"
                fontWeight="600"
                fill="#6B7280"
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function BranchDistributionBar({
  branches,
}: {
  branches: { name: string; sales: number; percent: number }[];
}) {
  const { i18n } = useTranslation();

  return (
    <View className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm my-2">
      <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
        Branch Revenue Distribution
      </Text>

      {branches.map((b, i) => (
        <View key={i} className="mb-3">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-xs font-bold text-on-surface">{b.name}</Text>
            <Text className="text-xs font-extrabold text-on-surface">
              {formatCurrencyLocale(b.sales, i18n.language)} ({b.percent}%)
            </Text>
          </View>

          {/* Progress bar background */}
          <View className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.min(Math.max(b.percent, 5), 100)}%`,
                backgroundColor: i % 2 === 0 ? "#0368FE" : "#2E9E5B",
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
