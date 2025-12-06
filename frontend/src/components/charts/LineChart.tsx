import React from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { theme } from '../../utils/theme';
import { HistoryEntry } from '../../types';

interface LineChartProps {
  data: HistoryEntry[];
  height?: number;
  showGrid?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export function LineChart({ data, height = 200, showGrid = true }: LineChartProps) {
  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = screenWidth - 48 - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxScore = 100;
  const minScore = 0;

  const xScale = (index: number) =>
    padding.left + (index / Math.max(1, data.length - 1)) * chartWidth;

  const yScale = (value: number) =>
    padding.top + chartHeight - ((value - minScore) / (maxScore - minScore)) * chartHeight;

  // Generate path for main line
  const generatePath = (values: (number | null)[]) => {
    const validPoints: { x: number; y: number }[] = [];
    values.forEach((val, i) => {
      if (val !== null) {
        validPoints.push({ x: xScale(i), y: yScale(val) });
      }
    });

    if (validPoints.length < 2) return '';

    return validPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  };

  const neuroLoadPath = generatePath(data.map(d => d.neuro_load_score));

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100];

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={screenWidth - 48} height={height}>
        {/* Grid */}
        {showGrid && gridLines.map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={padding.left}
              y1={yScale(value)}
              x2={screenWidth - 48 - padding.right}
              y2={yScale(value)}
              stroke={theme.colors.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <SvgText
              x={padding.left - 8}
              y={yScale(value) + 4}
              textAnchor="end"
              fontSize={10}
              fill={theme.colors.textMuted}
            >
              {value}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Main line */}
        <Path
          d={neuroLoadPath}
          stroke={theme.colors.primary}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((entry, index) => (
          <Circle
            key={index}
            cx={xScale(index)}
            cy={yScale(entry.neuro_load_score)}
            r={6}
            fill={theme.colors.primary}
            stroke={theme.colors.background}
            strokeWidth={2}
          />
        ))}

        {/* X-axis labels */}
        {data.map((entry, index) => (
          <SvgText
            key={`label-${index}`}
            x={xScale(index)}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fill={theme.colors.textMuted}
          >
            W{entry.week_number}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
});
