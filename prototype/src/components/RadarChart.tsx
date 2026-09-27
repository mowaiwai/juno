import ReactECharts from 'echarts-for-react';
import { PROFILE_DIMENSIONS } from '@/mock/profiles';
import { CHART } from '@/charts/palette';

export interface RadarSeries {
  name: string;
  values: number[];
  color: string;
}

interface RadarChartProps {
  series: RadarSeries[];
  height?: number;
  max?: number;
}

/** 七维雷达图（共享组件）：维度固定对齐 PRD profile_snapshot 七维度 */
export function RadarChart({ series, height = 300, max = 100 }: RadarChartProps) {
  const option = {
    tooltip: { trigger: 'item' as const },
    legend: {
      bottom: 0,
      icon: 'circle' as const,
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: CHART.ink2, fontSize: 12 },
    },
    radar: {
      indicator: PROFILE_DIMENSIONS.map((dim) => ({ name: dim.name, max })),
      radius: '62%',
      center: ['50%', '48%'],
      splitNumber: 4,
      axisName: { color: CHART.ink2, fontSize: 12 },
      splitLine: { lineStyle: { color: CHART.line } },
      splitArea: {
        areaStyle: { color: ['#f8f4f0', '#fbf8f4', '#f8f4f0', '#fbf8f4'] },
      },
      axisLine: { lineStyle: { color: CHART.line } },
    },
    series: [
      {
        type: 'radar' as const,
        symbolSize: 4,
        data: series.map((s) => ({
          name: s.name,
          value: s.values,
          lineStyle: { color: s.color, width: 2 },
          itemStyle: { color: s.color },
          areaStyle: { color: s.color, opacity: 0.12 },
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />;
}
