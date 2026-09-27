/* ============================================================
   马卡龙图表调色板 — ECharts 内使用 hex 字面量（不读 CSS 变量）
   ============================================================ */

export const CHART = {
  /** 莓粉 · 主序列 */
  primary: '#d96a8e',
  primaryDark: '#c7567c',
  /** 梅紫 · 深色锚点序列 */
  plum: '#4a4459',
  /** 文字 / 坐标轴 */
  ink: '#35313d',
  ink2: '#6e6778',
  ink3: '#a099aa',
  ink4: '#c9c2d0',
  line: '#f0e9ee',
  /** 多彩语义序列 */
  mint: '#7fc49b',
  butter: '#e3be6b',
  sky: '#7fb5d6',
  lilac: '#b79bd8',
  danger: '#de7066',
} as const;

/** 多序列分类色（莓粉 → 紫 → 蓝 → 绿 → 黄 → 红） */
export const MACARON: string[] = [
  '#d96a8e',
  '#b79bd8',
  '#7fb5d6',
  '#7fc49b',
  '#e3be6b',
  '#de7066',
];

/** 职级色带（13 级，粉→紫→蓝→绿→黄→灰） */
export const GRADE_RAMP: string[] = [
  '#d96a8e',
  '#e287a5',
  '#b79bd8',
  '#a583cc',
  '#7fb5d6',
  '#6aa6cc',
  '#7fc49b',
  '#6ab588',
  '#e3be6b',
  '#d4ad52',
  '#c9c2d0',
  '#a099aa',
  '#6e6778',
];

/** 浅色页通用坐标轴文字 / 网格线 */
export const LIGHT_AXIS = {
  text: CHART.ink2,
  subText: CHART.ink3,
  line: CHART.line,
} as const;
