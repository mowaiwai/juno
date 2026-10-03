import { Card, Col, Progress, Row, Table, Tag } from 'antd';

type IndicatorType = 'KPI' | 'OKR' | '价值观';

const TYPE_COLOR: Record<IndicatorType, string> = {
  KPI: 'var(--teal)',
  OKR: 'var(--clay)',
  价值观: 'var(--ochre)',
};

interface Indicator {
  id: string;
  name: string;
  type: IndicatorType;
  tracks: string;
  weight: string;
  source: string;
}

const INDICATORS: Indicator[] = [
  { id: 'i1', name: '营收 / 利润目标达成率', type: 'KPI', tracks: '管理序列 · 销售序列', weight: '40-60%', source: '经营系统' },
  { id: 'i2', name: '关键项目里程碑交付', type: 'OKR', tracks: '技术序列 · 产品序列', weight: '50-70%', source: '项目系统' },
  { id: 'i3', name: '产品质量与缺陷率', type: 'KPI', tracks: '技术序列', weight: '20-30%', source: '质量平台' },
  { id: 'i4', name: '客户满意度 / NPS', type: 'KPI', tracks: '销售序列 · 客服序列', weight: '20-30%', source: 'CRM' },
  { id: 'i5', name: '人才培养与团队贡献', type: '价值观', tracks: '管理序列', weight: '10-20%', source: '上级评估' },
  { id: 'i6', name: '跨部门协作与价值观践行', type: '价值观', tracks: '全序列', weight: '10-20%', source: '360° 评估' },
];

interface Grade {
  grade: string;
  label: string;
  definition: string;
  ratio: number;
  grid: string;
  color: string;
}

const GRADES: Grade[] = [
  { grade: 'S', label: '卓越', definition: '显著超越目标，产出行业级标杆成果', ratio: 5, grid: '九宫格 1 格（明星）核心候选', color: 'var(--clay)' },
  { grade: 'A', label: '优秀', definition: '全面达成并部分超越目标', ratio: 15, grid: '九宫格 1-2 格候选', color: 'var(--sage)' },
  { grade: 'B', label: '称职', definition: '达成岗位要求的全部关键目标', ratio: 60, grid: '九宫格中位区间', color: 'var(--teal)' },
  { grade: 'C', label: '待改进', definition: '部分目标未达成，需辅导与改进计划', ratio: 15, grid: '进入绩效改进流程', color: 'var(--ochre)' },
  { grade: 'D', label: '不合格', definition: '关键目标严重偏离，连续两期触发调整', ratio: 5, grid: '九宫格 9 格 · 调岗或退出', color: 'var(--ink-3)' },
];

const RULES = [
  { title: '建议分布', desc: 'S+A 建议不超过 20%，C+D 建议不少于 10%；人数不足 10 人的团队合并校准。' },
  { title: '跨部门校准会', desc: '同级拉通评议，HR 主持；校准结论需 2/3 以上评委同意方可调整等级。' },
  { title: '绩效-潜力双维校验', desc: '绩效等级须与潜力评估交叉校验，结果直接映射九宫格位置，禁止单维定档。' },
  { title: '申诉窗口', desc: '结果公示后 5 个工作日内可申诉，由 HRBP 复核并在 10 个工作日内给出结论。' },
];

export function PerfStandards() {
  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">绩效管理标准库</h1>
          <div className="page-subtitle">
            考核指标 · 等级定义 · 校准规则 ｜ 绩效标准与任职资格标准解耦维护，供绩效改进与九宫格应用消费
          </div>
        </div>
        <Tag style={{ borderRadius: 6 }}>原型演示数据 · 后端模型规划中</Tag>
      </div>

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginBottom: 16 }}
        size="small"
        title="考核指标库"
      >
        <Table
          rowKey="id"
          dataSource={INDICATORS}
          pagination={false}
          size="middle"
          columns={[
            {
              title: '指标名称',
              render: (_: unknown, r: Indicator) => (
                <span style={{ fontWeight: 600 }}>{r.name}</span>
              ),
            },
            {
              title: '类型',
              width: 90,
              render: (_: unknown, r: Indicator) => (
                <Tag
                  style={{
                    borderRadius: 6,
                    background: TYPE_COLOR[r.type] + '22',
                    color: TYPE_COLOR[r.type],
                    borderColor: 'transparent',
                  }}
                >
                  {r.type}
                </Tag>
              ),
            },
            { title: '适用序列', width: 200, dataIndex: 'tracks' },
            { title: '建议权重', width: 100, dataIndex: 'weight', render: (v: string) => <span className="num">{v}</span> },
            { title: '数据来源', width: 110, dataIndex: 'source' },
          ]}
        />
      </Card>

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginBottom: 16 }}
        size="small"
        title="等级定义（建议分布）"
      >
        <Row gutter={[12, 12]}>
          {GRADES.map((g) => (
            <Col span={12} key={g.grade}>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: g.color + '22',
                    color: g.color,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 18,
                    fontWeight: 750,
                    flexShrink: 0,
                  }}
                >
                  {g.grade}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 13 }}>
                    {g.label}
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-4)' }}>{g.grid}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{g.definition}</div>
                </div>
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>
                    建议占比 <span className="num">{g.ratio}%</span>
                  </div>
                  <Progress
                    percent={g.ratio}
                    size="small"
                    showInfo={false}
                    strokeColor={g.color}
                    trailColor="var(--line)"
                  />
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)' }}
        size="small"
        title="校准规则"
      >
        <Row gutter={[12, 12]}>
          {RULES.map((r) => (
            <Col span={12} key={r.title}>
              <div style={{ padding: '4px 4px 4px 0' }}>
                <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7 }}>{r.desc}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
