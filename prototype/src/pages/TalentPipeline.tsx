/** 人才梯队建设（模块七 P3）：序列梯队图 + 健康度三指标 + 后备识别 + 断层预警 + AI 培养计划。 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import { BulbOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import {
  talentPipelineApi,
  type BackupCandidateOut,
  type PipelineGapWarningOut,
  type PipelineHealthOut,
  type PipelinePyramidOut,
  type TrainingPlanOut,
} from '@/api/talentPipeline';
import { CHART } from '@/charts/palette';

const SEQ_OPTIONS = [
  { value: 'SW', label: '软件序列 (SW)' },
  { value: 'ENG', label: '机械序列 (ENG)' },
  { value: 'OP', label: '工艺序列 (OP)' },
  { value: 'MGT', label: '管理序列 (MGT)' },
  { value: 'SAL', label: '营销序列 (SAL)' },
  { value: 'PUR', label: '采购序列 (PUR)' },
  { value: 'HR', label: 'HR 序列 (HR)' },
  { value: 'OPS', label: '运维序列 (OPS)' },
];

const POOL_TAG: Record<string, { color: string; label: string }> = {
  L1: { color: 'red', label: 'L1 核心继任' },
  L2: { color: 'orange', label: 'L2 重点培养' },
  L3: { color: 'blue', label: 'L3 潜力储备' },
};

export function TalentPipeline() {
  const [sequence, setSequence] = useState('SW');
  const [pyramid, setPyramid] = useState<PipelinePyramidOut | null>(null);
  const [health, setHealth] = useState<PipelineHealthOut | null>(null);
  const [backups, setBackups] = useState<BackupCandidateOut[]>([]);
  const [warnings, setWarnings] = useState<PipelineGapWarningOut[]>([]);
  const [loading, setLoading] = useState(true);

  const [planTarget, setPlanTarget] = useState<BackupCandidateOut | null>(null);
  const [planFocus, setPlanFocus] = useState('');
  const [planMonths, setPlanMonths] = useState(6);
  const [plan, setPlan] = useState<TrainingPlanOut | null>(null);
  const [planning, setPlanning] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      talentPipelineApi.pyramid(sequence),
      talentPipelineApi.health(),
      talentPipelineApi.backupCandidates(),
      talentPipelineApi.gapWarnings(),
    ])
      .then(([p, h, b, w]) => {
        setPyramid(p);
        setHealth(h);
        setBackups(b.items);
        setWarnings(w);
      })
      .catch(() => message.error('加载梯队数据失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence]);

  // 梯队图（横向柱状：层级 × 编制/在岗/池）
  const pyramidOption = useMemo(() => {
    if (!pyramid) return {};
    const levels = [...pyramid.levels].sort((a, b) => a.level_order - b.level_order);
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: CHART.ink2 } },
      grid: { left: 90, right: 30, top: 30, bottom: 50 },
      xAxis: { type: 'value', axisLabel: { color: CHART.ink2 } },
      yAxis: {
        type: 'category',
        data: levels.map((l) => `L${l.level_order} ${l.level_name}`),
        axisLabel: { color: CHART.ink2 },
      },
      series: [
        {
          name: '标准编制',
          type: 'bar',
          data: levels.map((l) => l.headcount),
          itemStyle: { color: '#d9d9d9' },
        },
        {
          name: '在岗',
          type: 'bar',
          data: levels.map((l) => l.active_count),
          itemStyle: { color: CHART.primary },
        },
        {
          name: '合格供给（在岗+池折算）',
          type: 'bar',
          data: levels.map((l) => l.qualified),
          itemStyle: {
            color: (p: { dataIndex: number }) =>
              levels[p.dataIndex].has_gap ? '#ff4d4f' : '#52c41a',
          },
        },
      ],
    };
  }, [pyramid]);

  const openPlan = (row: BackupCandidateOut) => {
    setPlanTarget(row);
    setPlan(null);
    setPlanFocus('');
    setPlanMonths(6);
  };

  const submitPlan = () => {
    if (!planTarget) return;
    setPlanning(true);
    talentPipelineApi
      .trainingPlan(planTarget.employee_id, {
        focus: planFocus.trim() || undefined,
        months: planMonths,
      })
      .then(setPlan)
      .catch(() => message.error('生成培养计划失败'))
      .finally(() => setPlanning(false));
  };

  const backupCols = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '序列', dataIndex: 'sequence', width: 70 },
    { title: '职级', dataIndex: 'grade', width: 70 },
    { title: '岗位', dataIndex: 'position' },
    {
      title: '绩效',
      dataIndex: 'perf_label',
      width: 70,
      render: (v: string) => <Tag color={v === 'S' ? 'red' : 'orange'}>{v}</Tag>,
    },
    { title: '能力分', dataIndex: 'ability_score', width: 80 },
    { title: '九宫格', dataIndex: 'grid_code', width: 80 },
    {
      title: '池籍',
      dataIndex: 'pool_level',
      width: 130,
      render: (v: string | null) =>
        v ? (
          <Tag color={POOL_TAG[v]?.color}>{POOL_TAG[v]?.label ?? v}</Tag>
        ) : (
          <Tag>未入池</Tag>
        ),
    },
    {
      title: '操作',
      key: 'op',
      width: 110,
      render: (_: unknown, r: BackupCandidateOut) => (
        <Button size="small" type="link" onClick={() => openPlan(r)}>
          生成培养计划
        </Button>
      ),
    },
  ];

  const warningCols = [
    { title: '序列', dataIndex: 'sequence', width: 80 },
    { title: '层级', dataIndex: 'level_name', width: 140 },
    { title: '编制', dataIndex: 'headcount', width: 70 },
    { title: '合格供给', dataIndex: 'qualified', width: 90 },
    {
      title: '缺口',
      dataIndex: 'shortage',
      width: 70,
      render: (v: number) => <span style={{ color: '#ff4d4f' }}>{v}</span>,
    },
    {
      title: '厚度',
      dataIndex: 'thickness',
      width: 80,
      render: (v: number | null) =>
        v === null ? '—' : `${Math.round(v * 100)}%`,
    },
    { title: '建议', dataIndex: 'suggestion' },
  ];

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">人才梯队建设</h1>
          <div className="page-subtitle">
            序列×层级梯队图 · 厚度/断层率/流动率三指标 · 后备识别 · 断层预警 · AI
            培养计划
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        {/* 健康度三指标 */}
        {health && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  梯队厚度（合格供给 / 标准编制）
                </div>
                <div
                  className="num"
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color:
                      health.thickness === null
                        ? 'var(--ink-3)'
                        : health.thickness >= 1
                          ? '#52c41a'
                          : health.thickness >= 0.7
                            ? '#faad14'
                            : '#ff4d4f',
                  }}
                >
                  {health.thickness === null
                    ? '—'
                    : `${Math.round(health.thickness * 100)}%`}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  断层率（关键层级缺口 {health.gap_levels}/{health.critical_levels}）
                </div>
                <div
                  className="num"
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: health.gap_rate > 0.4 ? '#ff4d4f' : '#52c41a',
                  }}
                >
                  {Math.round(health.gap_rate * 100)}%
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  流动率（近一年流出 {health.recent_outflow} / 现役{' '}
                  {health.active_pool}）
                </div>
                <div className="num" style={{ fontSize: 28, fontWeight: 700 }}>
                  {Math.round(health.flow_rate * 100)}%
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  数据基准批次
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>
                  {health.batch_name ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {health.published_at
                    ? new Date(health.published_at).toLocaleDateString()
                    : ''}
                </div>
              </Card>
            </Col>
          </Row>
        )}

        <Tabs
          items={[
            {
              key: 'pyramid',
              label: '序列梯队图',
              children: (
                <Card
                  variant="borderless"
                  style={{ background: 'var(--surface)' }}
                  title="序列×层级梯队分布"
                  extra={
                    <Select
                      value={sequence}
                      onChange={setSequence}
                      options={SEQ_OPTIONS}
                      style={{ width: 180 }}
                    />
                  }
                >
                  {pyramid && pyramid.levels.length > 0 ? (
                    <>
                      <ReactECharts option={pyramidOption} style={{ height: 360 }} />
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 12,
                          color: 'var(--ink-3)',
                        }}
                      >
                        汇总：编制 {pyramid.total_headcount} · 在岗{' '}
                        {pyramid.total_active} · 池籍 {pyramid.total_pool}
                      </div>
                    </>
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      message="该序列暂无梯队数据"
                      description="请先配置标准编制并维护梯队池"
                    />
                  )}
                </Card>
              ),
            },
            {
              key: 'backup',
              label: `后备识别 (${backups.length})`,
              children: (
                <Card
                  variant="borderless"
                  style={{ background: 'var(--surface)' }}
                  title="后备人才（盘点高潜 + 绩优 S/A）"
                >
                  <Table
                    rowKey="employee_id"
                    dataSource={backups}
                    columns={backupCols}
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </Card>
              ),
            },
            {
              key: 'warnings',
              label: `断层预警 (${warnings.length})`,
              children: (
                <Card
                  variant="borderless"
                  style={{ background: 'var(--surface)' }}
                  title="层级断层预警（合格供给 < 标准编制）"
                >
                  {warnings.length === 0 ? (
                    <Alert
                      type="success"
                      showIcon
                      message="梯队健康"
                      description="当前各层级供给满足编制需求。"
                    />
                  ) : (
                    <Table
                      rowKey={(r) => `${r.sequence}-${r.level_order}`}
                      dataSource={warnings}
                      columns={warningCols}
                      pagination={false}
                      size="small"
                    />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </Spin>

      {/* AI 培养计划弹窗 */}
      <Modal
        open={!!planTarget}
        title={planTarget ? `AI 培养计划 · ${planTarget.name}` : ''}
        onCancel={() => setPlanTarget(null)}
        footer={null}
        width={720}
      >
        {planTarget && (
          <>
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                background: 'var(--bg)',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <div>
                <strong>{planTarget.name}</strong> · {planTarget.sequence}/
                {planTarget.grade} · {planTarget.position}
              </div>
              <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>
                绩效 {planTarget.perf_label} · 能力 {planTarget.ability_score} ·
                九宫格 {planTarget.grid_code} ·{' '}
                {planTarget.pool_level
                  ? `已入池 ${planTarget.pool_level}`
                  : '未入池'}
              </div>
            </div>
            <Row gutter={8} style={{ marginBottom: 12 }}>
              <Col flex="auto">
                <Input
                  placeholder="关注点（可选，如：技术深度、管理转型）"
                  value={planFocus}
                  onChange={(e) => setPlanFocus(e.target.value)}
                />
              </Col>
              <Col>
                <InputNumber
                  min={1}
                  max={24}
                  value={planMonths}
                  onChange={(v) => setPlanMonths(v ?? 6)}
                  addonAfter="月"
                />
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<BulbOutlined />}
                  loading={planning}
                  onClick={submitPlan}
                >
                  生成
                </Button>
              </Col>
            </Row>
            {plan && (
              <Alert
                type={plan.source === 'ai_generated' ? 'success' : 'info'}
                showIcon
                message={
                  <span>
                    {plan.source === 'ai_generated' ? 'AI 生成方案' : '规则模板方案'}
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-3)',
                        marginLeft: 8,
                      }}
                    >
                      {new Date(plan.generated_at).toLocaleString()}
                    </span>
                  </span>
                }
                description={
                  <div>
                    <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                      {plan.plan}
                    </div>
                    {plan.milestones.length > 0 && (
                      <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                        {plan.milestones.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                }
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
