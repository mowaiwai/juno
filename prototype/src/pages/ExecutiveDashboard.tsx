/** 高层决策大屏（模块十 P3）：战略-组织-人才三图联动 + 缺口热力 + 梯队健康 + 策略建议。 */

import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, Spin, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { orgApi, type ExecutiveDashboardOut } from '@/api/orgDiagnosis';

// 深色大屏主题
const NIGHT = '#0f1419';
const NIGHT_CARD = '#1a2332';
const NIGHT_LINE = '#2a3a4a';
const NIGHT_INK = '#e8eef5';
const NIGHT_INK_2 = '#8a9ab0';
const ACCENT_GOLD = '#d4a853';
const ACCENT_TEAL = '#4ecdc4';
const ACCENT_RED = '#ff6b6b';
const ACCENT_GREEN = '#51cf66';
const ACCENT_BLUE = '#54a0ff';

const TYPE_COLOR: Record<string, string> = {
  recruit: ACCENT_BLUE,
  develop: ACCENT_TEAL,
  optimize: ACCENT_GOLD,
  stable: ACCENT_GREEN,
};

export function ExecutiveDashboard() {
  const [data, setData] = useState<ExecutiveDashboardOut | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    orgApi
      .executiveDashboard()
      .then(setData)
      .catch(() => message.error('加载决策大屏失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return (
      <div
        style={{
          background: NIGHT,
          minHeight: '100vh',
          padding: 24,
          color: NIGHT_INK,
        }}
      >
        <Spin spinning={loading} />
      </div>
    );
  }

  // 战略图：关键举措 × 人才支撑度（条形）
  const strategyOption = {
    backgroundColor: 'transparent',
    grid: { left: 110, right: 40, top: 20, bottom: 20 },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: NIGHT_INK_2 },
      splitLine: { lineStyle: { color: NIGHT_LINE } },
    },
    yAxis: {
      type: 'category',
      data: data.strategy.map((s) => s.initiative),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: NIGHT_INK },
    },
    series: [
      {
        type: 'bar',
        data: data.strategy.map((_s, i) => {
          // mock 支持度：用 succession_coverage 与缺口推导
          const v = Math.max(
            30,
            Math.round((1 - data.gap_summary.total_gap / Math.max(1, data.gap_summary.total_demand)) * 100 - i * 8),
          );
          return {
            value: v,
            itemStyle: {
              color: v >= 75 ? ACCENT_GREEN : v >= 55 ? ACCENT_GOLD : ACCENT_RED,
              borderRadius: [0, 4, 4, 0],
            },
          };
        }),
        barWidth: 16,
        label: { show: true, position: 'right', color: NIGHT_INK, formatter: '{c}' },
      },
    ],
  };

  // 组织图：继任覆盖率仪表盘
  const orgGaugeOption = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        radius: '92%',
        center: ['50%', '60%'],
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        progress: { show: true, width: 14, itemStyle: { color: ACCENT_TEAL } },
        axisLine: { lineStyle: { width: 14, color: [[1, NIGHT_LINE]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: NIGHT_INK,
          fontSize: 30,
          fontWeight: 700,
          offsetCenter: [0, '0%'],
        },
        data: [{ value: Math.round(data.org.succession_coverage * 100), name: '继任覆盖率' }],
        title: { color: NIGHT_INK_2, fontSize: 12, offsetCenter: [0, '40%'] },
      },
    ],
  };

  // 人才图：四分类环形图
  const talentPieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: NIGHT_INK_2 } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        itemStyle: { borderColor: NIGHT, borderWidth: 2, borderRadius: 6 },
        label: { color: NIGHT_INK, formatter: '{b}\n{c}人 ({d}%)' },
        data: [
          { value: data.talent.classification.core, name: '核心', itemStyle: { color: ACCENT_GREEN } },
          { value: data.talent.classification.competent, name: '胜任', itemStyle: { color: ACCENT_BLUE } },
          { value: data.talent.classification.transformable, name: '可转型', itemStyle: { color: ACCENT_GOLD } },
          { value: data.talent.classification.optimize, name: '待优化', itemStyle: { color: ACCENT_RED } },
        ],
      },
    ],
  };

  // 缺口热力：序列×层级
  const gapSequences = Array.from(new Set(data.gap_heatmap.map((c) => c.sequence)));
  const gapLevels = Array.from(new Set(data.gap_heatmap.map((c) => c.level_order))).sort();
  const heatmapData = data.gap_heatmap.map((c) => [
    gapSequences.indexOf(c.sequence),
    gapLevels.indexOf(c.level_order),
    c.gap,
  ]);
  const heatmapOption = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (p: { data: [number, number, number]; dataIndex: number }) => {
        const cell = data.gap_heatmap[p.dataIndex];
        return `${cell.sequence}·${cell.level_name}<br/>需求 ${cell.demand} / 供给 ${cell.supply_total.toFixed(1)}<br/>缺口 ${cell.gap.toFixed(1)}`;
      },
    },
    grid: { left: 60, right: 20, top: 20, bottom: 60 },
    xAxis: { type: 'category', data: gapSequences, axisLabel: { color: NIGHT_INK_2 } },
    yAxis: {
      type: 'category',
      data: gapLevels.map((l) => `L${l}`),
      axisLabel: { color: NIGHT_INK_2 },
    },
    visualMap: {
      min: 0,
      max: Math.max(1, ...data.gap_heatmap.map((c) => c.gap)),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: NIGHT_INK_2 },
      inRange: { color: [NIGHT_CARD, ACCENT_GOLD, ACCENT_RED] },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData,
        label: { show: true, color: NIGHT_INK, formatter: (p: { data: [number, number, number] }) => p.data[2].toFixed(1) },
      },
    ],
  };

  return (
    <div
      style={{
        background: NIGHT,
        minHeight: '100vh',
        padding: '20px 24px',
        color: NIGHT_INK,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
            {data.year} 高层决策大屏
          </div>
          <div style={{ fontSize: 12, color: NIGHT_INK_2, marginTop: 4 }}>
            战略 — 组织 — 人才 三图联动 · 缺口热力 · 梯队健康 · 策略建议
          </div>
        </div>
        <Button ghost icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </div>

      {/* KPI 行 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          { label: '关键岗位', value: data.org.key_positions, color: ACCENT_BLUE },
          { label: '继任覆盖率', value: `${Math.round(data.org.succession_coverage * 100)}%`, color: ACCENT_TEAL },
          { label: '梯队厚度', value: data.pipeline_health.thickness === null ? '—' : `${Math.round(data.pipeline_health.thickness * 100)}%`, color: ACCENT_GOLD },
          { label: '断层率', value: `${Math.round(data.pipeline_health.gap_rate * 100)}%`, color: ACCENT_RED },
          { label: '核心人才占比', value: `${Math.round(data.talent.core_ratio * 100)}%`, color: ACCENT_GREEN },
          { label: '缺口单元格', value: data.gap_summary.shortage_cells, color: ACCENT_RED },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: NIGHT_CARD,
              padding: '14px 16px',
              borderRadius: 8,
              border: `1px solid ${NIGHT_LINE}`,
            }}
          >
            <div style={{ fontSize: 11, color: NIGHT_INK_2 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4 }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* 三图联动 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: NIGHT_CARD,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${NIGHT_LINE}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>战略规划图</div>
          <ReactECharts option={strategyOption} style={{ height: 240 }} />
          <div style={{ fontSize: 11, color: NIGHT_INK_2, marginTop: 8 }}>
            {data.strategy.map((s) => (
              <div key={s.initiative}>
                · {s.initiative} — {s.talent_support}（{s.owner}，{s.note}）
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            background: NIGHT_CARD,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${NIGHT_LINE}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>组织架构图</div>
          <ReactECharts option={orgGaugeOption} style={{ height: 240 }} />
          <div style={{ fontSize: 11, color: NIGHT_INK_2, textAlign: 'center' }}>
            {data.org.departments} 个部门 · {data.org.shape_label}（中坚{' '}
            {Math.round(data.org.mid_ratio * 100)}%）
          </div>
        </div>
        <div
          style={{
            background: NIGHT_CARD,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${NIGHT_LINE}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>人才结构图</div>
          <ReactECharts option={talentPieOption} style={{ height: 240 }} />
          <div style={{ fontSize: 11, color: NIGHT_INK_2, textAlign: 'center' }}>
            高潜 {data.talent.high_potential_count} 人 · 风险 {data.talent.risk_count} 人
          </div>
        </div>
      </div>

      {/* 缺口热力 + 策略建议 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div
          style={{
            background: NIGHT_CARD,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${NIGHT_LINE}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            人才缺口热力（序列 × 层级）
          </div>
          {data.gap_heatmap.length > 0 ? (
            <ReactECharts option={heatmapOption} style={{ height: 260 }} />
          ) : (
            <div style={{ color: NIGHT_INK_2, padding: '40px 0', textAlign: 'center' }}>
              当前无显著缺口，结构健康
            </div>
          )}
          <div style={{ fontSize: 11, color: NIGHT_INK_2, marginTop: 8 }}>
            总需求 {data.gap_summary.total_demand} · 总供给{' '}
            {data.gap_summary.total_supply.toFixed(1)} · 总缺口{' '}
            {data.gap_summary.total_gap.toFixed(1)} · 冗余 {data.gap_summary.surplus_cells}{' '}
            处
          </div>
        </div>
        <div
          style={{
            background: NIGHT_CARD,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${NIGHT_LINE}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            策略建议（招聘 / 发展 / 优化）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.actions.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  background: NIGHT,
                  borderLeft: `3px solid ${TYPE_COLOR[a.type] ?? NIGHT_INK_2}`,
                  borderRadius: 4,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: TYPE_COLOR[a.type] }}>
                  [{a.type_label}] {a.title}
                </div>
                <div style={{ fontSize: 12, color: NIGHT_INK_2, marginTop: 4 }}>
                  {a.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
