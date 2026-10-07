import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Divider, Drawer, Empty, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Spin, Table, Tag, Tooltip, message } from 'antd';
import { PlusOutlined, RobotOutlined, UserAddOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import {
  aiJdData,
  candidateApi,
  CandidateIn,
  CandidateOut,
  DEPT_NAME_MAP,
  interviewApi,
  requisitionApi,
  RequisitionIn,
  RequisitionOut,
} from '@/api/recruit';

const matchColor = (s: number) => (s >= 85 ? 'var(--sage)' : s >= 70 ? 'var(--ochre)' : 'var(--danger)');
const prescreenColor = (s: number) => (s >= 80 ? 'var(--sage)' : s >= 60 ? 'var(--ochre)' : 'var(--danger)');
const REC_COLOR: Record<string, string> = {
  '建议录用': 'var(--sage)',
  '可培养建议复试': 'var(--ochre)',
  '建议暂缓': 'var(--danger)',
};
const DIM_LABELS = ['职责履行', '知识技能', '能力素质', '绩效', '团队贡献'];
const DIM_KEY_LABEL_CN: Record<string, string> = {
  duty: '职责履行', knowledge: '知识技能', ability: '能力素质',
  perf: '绩效', contribution: '团队贡献',
};
const FUNNEL_LABEL = ['简历', '初筛', '初试', '复试', 'Offer'];
const ACTIVE_STAGES = ['screen', 'first', 'final', 'offer'] as const;
const STAGE_LABEL: Record<string, string> = {
  screen: '简历初筛', first: '初试', final: '复试', offer: 'Offer',
  onboard: '已入职', rejected: '已淘汰',
};
// 下一阶段流转映射
const NEXT_STAGE: Record<string, { label: string; stage: string } | null> = {
  screen: { label: '进入初试', stage: 'first' },
  first: { label: '进入复试', stage: 'final' },
  final: { label: '发 Offer', stage: 'offer' },
  offer: { label: '办理入职', stage: 'onboard' },
  onboard: null,
  rejected: null,
};

function CandCard({ c, onAdvance, onReject, onOnboard, onReport, refreshing }: {
  c: CandidateOut;
  onAdvance: (c: CandidateOut) => void;
  onReject: (c: CandidateOut) => void;
  onOnboard: (c: CandidateOut) => void;
  onReport: (c: CandidateOut) => void;
  refreshing: boolean;
}) {
  const next = NEXT_STAGE[c.stage];
  const isOffer = c.stage === 'offer';
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
        <Tooltip title="与目标岗位画像匹配度">
          <span className="num" style={{ fontWeight: 700, color: matchColor(c.match_score), fontSize: 13 }}>{c.match_score}</span>
        </Tooltip>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
        {c.last_title} · {c.years > 0 ? c.years + ' 年经验' : '应届生'} · {c.source}
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {c.tags.slice(0, 2).map((t) => (
          <Tag key={t} style={{ fontSize: 11, margin: 0, borderRadius: 4, background: 'var(--surface-sunken)', color: 'var(--ink-2)', borderColor: 'var(--line)' }}>{t}</Tag>
        ))}
        {c.rating && (
          <Tag style={{ fontSize: 11, margin: 0, borderRadius: 4, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>面试 {c.rating}</Tag>
        )}
        {c.prescreen_score != null && (
          <Tooltip title="简历预匹配分">
            <Tag style={{ fontSize: 11, margin: 0, borderRadius: 4, background: 'var(--surface-sunken)', color: prescreenColor(c.prescreen_score), borderColor: 'transparent', fontWeight: 600 }}>
              预匹配 {c.prescreen_score}
            </Tag>
          </Tooltip>
        )}
      </div>
      {next && (
        <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
          <Button
            size="small" type="link"
            style={{ padding: '0 4px', flex: '0 0 auto' }}
            onClick={() => onReport(c)}
          >
            报告
          </Button>
          <Button
            size="small" type={isOffer ? 'primary' : 'default'}
            style={isOffer ? { background: 'var(--charcoal)', border: 'none', flex: 1 } : { flex: 1 }}
            disabled={refreshing}
            onClick={() => isOffer ? onOnboard(c) : onAdvance(c)}
          >
            {next.label}
          </Button>
          <Button size="small" danger style={{ flex: 1 }} disabled={refreshing} onClick={() => onReject(c)}>淘汰</Button>
        </div>
      )}
    </div>
  );
}

export function RecruitBoard() {
  const [reqs, setReqs] = useState<RequisitionOut[]>([]);
  const [cands, setCands] = useState<CandidateOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [reqModal, setReqModal] = useState(false);
  const [candModal, setCandModal] = useState<{ open: boolean; reqId: string }>({ open: false, reqId: '' });
  const [reqForm] = Form.useForm<RequisitionIn>();
  const [candForm] = Form.useForm<CandidateIn>();

  // 匹配度报告抽屉
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCand, setReportCand] = useState<CandidateOut | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const load = () => {
    setRefreshing(true);
    Promise.all([
      requisitionApi.list().catch(() => { message.error('在招需求加载失败'); return []; }),
      candidateApi.list().catch(() => { message.error('候选人加载失败'); return []; }),
    ]).then(([r, c]) => {
      setReqs(r);
      setCands(c);
      setLoading(false);
      setRefreshing(false);
    });
  };

  useEffect(() => { load(); }, []);

  const funnel = useMemo(() => FUNNEL_LABEL.map((_, i) => reqs.reduce((s, r) => s + (r.funnel[i] ?? 0), 0)), [reqs]);
  const maxF = funnel[0] || 1;

  const openJd = () => {
    Modal.info({
      title: <span className="font-serif">AI 生成 JD · {aiJdData.position}</span>,
      width: 620,
      content: (
        <div style={{ marginTop: 12 }}>
          {aiJdData.sections.map((s) => (
            <div key={s.h} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.h}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                {s.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--surface-sunken)', borderRadius: 6, padding: 8 }}>
            <RobotOutlined /> {aiJdData.basis}
          </div>
        </div>
      ),
      okText: '采用此 JD',
      onOk: () => message.success('JD 已同步至在招需求（模拟）'),
    });
  };

  const submitReq = async () => {
    try {
      const values = await reqForm.validateFields();
      await requisitionApi.create(values);
      message.success('在招需求已创建');
      setReqModal(false);
      reqForm.resetFields();
      load();
    } catch { /* 校验失败 */ }
  };

  const submitCand = async () => {
    try {
      const values = await candForm.validateFields();
      await candidateApi.create({ ...values, req_id: candModal.reqId });
      message.success('候选人已投递');
      setCandModal({ open: false, reqId: '' });
      candForm.resetFields();
      load();
    } catch { /* 校验失败 */ }
  };

  const handleAdvance = (c: CandidateOut) => {
    const next = NEXT_STAGE[c.stage];
    if (!next) return;
    candidateApi.updateStage(c.id, next.stage)
      .then(() => { message.success(`${c.name} 已${next.label}`); load(); })
      .catch(() => message.error('操作失败'));
  };

  const handleReject = (c: CandidateOut) => {
    Modal.confirm({
      title: `淘汰 ${c.name}？`,
      content: '淘汰后候选人将从管道移除，不可恢复。',
      okText: '确认淘汰',
      okButtonProps: { danger: true },
      onOk: () => candidateApi.updateStage(c.id, 'rejected')
        .then(() => { message.success(`${c.name} 已淘汰`); load(); })
        .catch(() => message.error('操作失败')),
    });
  };

  const handleOnboard = (c: CandidateOut) => {
    Modal.confirm({
      title: `办理入职：${c.name}`,
      content: '将为该候选人创建登录账号与员工档案，初始密码 Juno12345。',
      okText: '确认入职',
      onOk: () => candidateApi.onboard(c.id)
        .then((r) => { message.success(`入职成功，工号 ${r.employee_no}`); load(); })
        .catch(() => message.error('入职失败')),
    });
  };

  const handleReport = (c: CandidateOut) => {
    setReportCand(c);
    setReportOpen(true);
    setReportLoading(true);
    setReportData(null);
    interviewApi.compare(c.id)
      .then((data) => { setReportData(data); setReportLoading(false); })
      .catch(() => { message.error('匹配度报告加载失败'); setReportLoading(false); });
  };

  const handlePrescreen = (c: CandidateOut) => {
    candidateApi.prescreen(c.id).then((r) => {
      message.success(`预匹配分：${r.prescreen_score}（${r.level === 'good' ? '优秀' : r.level === 'watch' ? '可培养' : '不匹配'}）`);
      setCands((prev) => prev.map((x) => (x.id === c.id ? { ...x, prescreen_score: r.prescreen_score } : x)));
      setReportCand((prev) => (prev && prev.id === c.id ? { ...prev, prescreen_score: r.prescreen_score } : prev));
    }).catch(() => message.error('预匹配失败'));
  };

  const radarOption = (dims: { key: string; actual: number; expected: number }[]) => ({
    radar: {
      indicator: DIM_LABELS.map((label) => ({ name: label, max: 100 })),
      radius: 80,
      name: { color: 'var(--ink-2)', fontSize: 11 },
      splitLine: { lineStyle: { color: 'var(--line)' } },
      splitArea: { areaStyle: { color: ['var(--surface-sunken)', 'var(--surface)'] } },
    },
    legend: { data: ['候选人', '岗位要求'], bottom: 0, textStyle: { fontSize: 11, color: 'var(--ink-2)' } },
    series: [{
      type: 'radar',
      data: [
        {
          value: dims.map((d) => d.actual),
          name: '候选人',
          areaStyle: { color: 'rgba(232,144,121,0.35)' },
          lineStyle: { color: 'var(--clay)', width: 2 },
          itemStyle: { color: 'var(--clay)' },
        },
        {
          value: dims.map((d) => d.expected),
          name: '岗位要求',
          areaStyle: { color: 'rgba(106,102,90,0.15)' },
          lineStyle: { color: 'var(--charcoal)', width: 2, type: 'dashed' },
          itemStyle: { color: 'var(--charcoal)' },
        },
      ],
    }],
  });

  if (loading) return null;

  return (
    <div className="page" style={{ maxWidth: 1320 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">招聘工作台</h1>
          <div className="page-subtitle">需求漏斗 · 候选人画像匹配 · 履职表即题库 · AI 生成 JD 与面试题</div>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setReqModal(true)}>新建需求</Button>
          <Button type="primary" icon={<RobotOutlined />} style={{ background: 'var(--charcoal)' }} onClick={openJd}>AI 生成 JD</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '在招需求', value: reqs.length, sub: `急招 ${reqs.filter((r) => r.priority === 'high').length} 个岗位`, color: 'var(--ink)' },
          { label: '管道候选人', value: cands.filter((c) => !['rejected', 'onboard'].includes(c.stage)).length, sub: '不含已淘汰', color: 'var(--clay)' },
          { label: '待安排面试', value: cands.filter((c) => c.stage === 'screen').length, sub: '简历初筛中', color: 'var(--ochre)' },
          { label: 'Offer / 已入职', value: `${cands.filter((c) => c.stage === 'offer').length} / ${cands.filter((c) => c.stage === 'onboard').length}`, sub: '本季转化', color: 'var(--sage)' },
        ].map((s) => (
          <Col span={6} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {reqs.length === 0 ? (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="暂无在招需求，点击「新建需求」开始" />
        </Card>
      ) : (
        <Row gutter={16}>
          <Col span={9}>
            <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="招聘漏斗（全部需求合计）">
              {funnel.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 40, fontSize: 12, color: 'var(--ink-2)' }}>{FUNNEL_LABEL[i]}</span>
                  <div style={{ width: `${Math.max(6, (v / maxF) * 100)}%`, height: 20, borderRadius: 5, background: `color-mix(in srgb, var(--clay) ${85 - i * 15}%, var(--clay-soft))`, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                    <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{v}</span>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                简历 → Offer 转化率 {maxF > 0 ? Math.round((funnel[4] / maxF) * 100) : 0}%
              </div>
            </Card>

            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="在招需求">
              <Table
                rowKey="id"
                dataSource={reqs}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '岗位',
                    render: (_: unknown, r: RequisitionOut) => (
                      <Space direction="vertical" size={0}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{r.position}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{DEPT_NAME_MAP[r.dept_id] ?? r.dept_id} · {r.grade} · 招 {r.headcount}</span>
                      </Space>
                    ),
                  },
                  {
                    title: '进度',
                    render: (_: unknown, r: RequisitionOut) => {
                      const p = Math.min(100, Math.round(((r.funnel[4] ?? 0) / r.headcount) * 100));
                      return <Progress type="circle" size={34} percent={p} strokeColor="var(--clay)" trailColor="var(--line)" />;
                    },
                  },
                  {
                    title: '优先级',
                    width: 64,
                    render: (_: unknown, r: RequisitionOut) =>
                      r.priority === 'high' ? (
                        <Tag color="red" style={{ borderRadius: 4, margin: 0 }}>急招</Tag>
                      ) : (
                        <Tag style={{ borderRadius: 4, margin: 0 }}>常规</Tag>
                      ),
                  },
                  {
                    title: '操作',
                    width: 96,
                    render: (_: unknown, r: RequisitionOut) => (
                      <Button size="small" icon={<UserAddOutlined />} onClick={() => { candForm.resetFields(); setCandModal({ open: true, reqId: r.id }); }}>
                        投递
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          <Col span={15}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="候选人看板（按阶段）">
              <Row gutter={10}>
                {ACTIVE_STAGES.map((st) => {
                  const list = cands.filter((c) => c.stage === st);
                  return (
                    <Col span={6} key={st}>
                      <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: 8, minHeight: 200 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{STAGE_LABEL[st]}</span>
                          <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{list.length}</span>
                        </div>
                        {list.map((c) => (
                          <CandCard key={c.id} c={c} onAdvance={handleAdvance} onReject={handleReject} onOnboard={handleOnboard} onReport={handleReport} refreshing={refreshing} />
                        ))}
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* 新建需求弹窗 */}
      <Modal title="新建在招需求" open={reqModal} onOk={submitReq} onCancel={() => { setReqModal(false); reqForm.resetFields(); }} okText="创建" destroyOnClose>
        <Form form={reqForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="position" label="岗位名称" rules={[{ required: true, message: '请输入岗位名称' }]}>
            <Input placeholder="如：后端工程师" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dept_id" label="所属部门" rules={[{ required: true, message: '请选择部门' }]}>
                <Select placeholder="选择部门" options={Object.entries(DEPT_NAME_MAP).map(([id, name]) => ({ value: id, label: name }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="grade" label="职级" rules={[{ required: true, message: '请输入职级' }]}>
                <Input placeholder="如：P4" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="headcount" label="招聘人数" initialValue={1}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" initialValue="mid">
                <Select options={[{ value: 'high', label: '急招' }, { value: 'mid', label: '常规' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="owner" label="负责人" rules={[{ required: true, message: '请输入负责人' }]}>
                <Input placeholder="如：温晚晴" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 投递候选人弹窗 */}
      <Modal title="投递候选人" open={candModal.open} onOk={submitCand} onCancel={() => setCandModal({ open: false, reqId: '' })} okText="投递" destroyOnClose>
        <Form form={candForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="候选人姓名" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="source" label="来源" rules={[{ required: true, message: '请选择来源' }]}>
                <Select options={[
                  { value: '内推', label: '内推' }, { value: '猎头', label: '猎头' },
                  { value: '招聘网站', label: '招聘网站' }, { value: '校招', label: '校招' },
                  { value: '主动投递', label: '主动投递' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="years" label="工作年限" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="年" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="last_title" label="前职位">
            <Input placeholder="如：高级工程师" />
          </Form.Item>
          <Form.Item name="expected_salary" label="期望月薪（元）" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车，如：Python、分布式" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 匹配度报告抽屉 */}
      <Drawer
        title={reportCand ? `${reportCand.name} · 匹配度报告` : '匹配度报告'}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        width={560}
        destroyOnClose
      >
        {reportLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : reportData && reportCand ? (
          <div>
            {/* 录用建议 */}
            {reportData.recommendation && (
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>录用建议</div>
                <Tag style={{ fontSize: 15, fontWeight: 700, padding: '4px 12px', borderRadius: 6, background: 'var(--surface)', color: REC_COLOR[reportData.recommendation] ?? 'var(--ink)', borderColor: 'transparent' }}>
                  {reportData.recommendation}
                </Tag>
              </div>
            )}

            {/* 匹配分 + 预匹配 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>面试匹配分</div>
                  <div className="num" style={{ fontSize: 30, fontWeight: 700, color: reportData.match_score != null ? matchColor(reportData.match_score) : 'var(--ink-4)' }}>
                    {reportData.match_score ?? '—'}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>简历预匹配分</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="num" style={{ fontSize: 30, fontWeight: 700, color: reportCand.prescreen_score != null ? prescreenColor(reportCand.prescreen_score) : 'var(--ink-4)' }}>
                      {reportCand.prescreen_score ?? '—'}
                    </span>
                    {reportCand.prescreen_score == null && (
                      <Button size="small" type="link" onClick={() => handlePrescreen(reportCand)}>计算</Button>
                    )}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 五维雷达图 */}
            {reportData.dims && reportData.dims.length > 0 ? (
              <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="五维匹配（候选人 vs 岗位要求）">
                <ReactECharts option={radarOption(reportData.dims)} style={{ height: 320 }} notMerge />
              </Card>
            ) : (
              <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="五维匹配">
                <Empty description="暂无面试记录，无法生成五维雷达图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                <div style={{ textAlign: 'center' }}>
                  <Button type="link" onClick={() => handlePrescreen(reportCand)}>
                    运行简历预匹配
                  </Button>
                </div>
              </Card>
            )}

            {/* 缺口维度 */}
            {reportData.gaps && reportData.gaps.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Divider orientation="left" style={{ margin: '8px 0' }}>缺口维度（建议重点考察）</Divider>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {reportData.gaps.map((g: { key: string; gap: number }) => (
                    <Tag key={g.key} style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent', borderRadius: 4, fontWeight: 600 }}>
                      {DIM_KEY_LABEL_CN[g.key] ?? g.key}（缺口 {g.gap}）
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {/* 面试记录摘要 */}
            {reportData.records && reportData.records.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Divider orientation="left" style={{ margin: '8px 0' }}>面试记录</Divider>
                {reportData.records.map((rec: any, i: number) => (
                  <div key={rec.id ?? i} style={{ background: 'var(--surface)', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {rec.stage ?? ''} · {rec.interviewer ?? '—'} · 评分 {rec.score ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Drawer>
    </div>
  );
}
