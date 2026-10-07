import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Modal, Row, Segmented, Select, Table, Tag, Tooltip, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { interviewApi, InterviewQuestionOut, QuestionGenerateIn } from '@/api/recruit';

const DIM_LABEL: Record<number, string> = { 1: '履职', 2: '知识', 3: '能力', 4: '业绩', 5: '团队贡献' };
const DIM_KEY_LABEL: Record<string, string> = {
  duty: '职责履行', knowledge: '知识技能', ability: '能力素质',
  perf: '绩效', contribution: '团队贡献',
};
const SOURCE_META = {
  standard: { label: '履职表转制', bg: 'var(--teal-soft)', color: 'var(--teal)' },
  ai: { label: 'AI 出题', bg: 'var(--clay-soft)', color: 'var(--clay)' },
  manual: { label: '人工', bg: 'var(--surface-sunken)', color: 'var(--ink-3)' },
} as const;
const STATUS_META = {
  approved: { label: '已生效', bg: 'var(--sage-soft)', color: 'var(--sage)' },
  pending_review: { label: '待审核', bg: 'var(--ochre-soft)', color: 'var(--ochre)' },
  rejected: { label: '已驳回', bg: 'var(--danger-soft)', color: 'var(--danger)' },
} as const;
const SEQ_OPTIONS = [
  { value: '', label: '全部序列' },
  { value: 'SW', label: '软件 SW' },
  { value: 'ENG', label: '机械 ENG' },
  { value: 'SAL', label: '销售 SAL' },
  { value: 'MGT', label: '管理 MGT' },
];

export function InterviewBank() {
  const [rows, setRows] = useState<InterviewQuestionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [seq, setSeq] = useState<string>('');
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState<QuestionGenerateIn>({
    position: '高级软件工程师', grade: 'P4', sequence: '',
  });

  const load = () => {
    interviewApi.list(undefined, undefined, seq || undefined).then((data) => {
      setRows(data);
      setLoading(false);
    }).catch(() => {
      message.error('面试题库加载失败');
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [seq]);

  const list = useMemo(() => rows.filter((r) => dim === 'all' || r.dimension === Number(dim)), [rows, dim]);

  const handleGenerate = () => {
    message.loading({ content: 'AI 生成中...', key: 'gen', duration: 2 });
    interviewApi.generate(genForm).then((newQs) => {
      setRows((prev) => [...newQs, ...prev]);
      message.success({ content: `AI 生成 ${newQs.length} 道题（五维），已进入待审核`, key: 'gen' });
      setGenOpen(false);
    }).catch(() => {
      message.error({ content: 'AI 生成失败', key: 'gen' });
    });
  };

  const review = (id: string, pass: boolean) => {
    interviewApi.review(id, pass).then((updated) => {
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      message.success(pass ? '题目已审核生效，进入面试题库' : '题目已驳回，退回 AI 重新生成');
    }).catch(() => {
      message.error('审核操作失败');
    });
  };

  const counts = {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending_review').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    dims: [1, 2, 3, 4, 5].map((d) => rows.filter((r) => r.dimension === d).length),
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">面试题库</h1>
          <div className="page-subtitle">履职表即题库 · 五维度出题 · L1–L5 行为锚点 · AI 出题需人工审核</div>
        </div>
        <Button type="primary" icon={<RobotOutlined />} style={{ background: 'var(--charcoal)' }} onClick={() => setGenOpen(true)}>
          AI 按职级出题
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>题目总数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{counts.total}</div>
          </Card>
        </Col>
        <Col span={5}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待审核</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{counts.pending}</div>
          </Card>
        </Col>
        <Col span={5}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已生效</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{counts.approved}</div>
          </Card>
        </Col>
        <Col span={9}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>五维覆盖</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {counts.dims.map((v, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-sunken)', borderRadius: 6, padding: '6px 0' }}>
                  <div className="num" style={{ fontWeight: 700 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{DIM_LABEL[i + 1]}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Segmented
            value={dim}
            onChange={(v) => setDim(v as 'all' | '1' | '2' | '3' | '4' | '5')}
            options={[
              { label: '全部维度', value: 'all' },
              { label: '履职', value: '1' },
              { label: '知识', value: '2' },
              { label: '能力', value: '3' },
              { label: '业绩', value: '4' },
              { label: '团队贡献', value: '5' },
            ]}
          />
          <Select
            value={seq}
            onChange={setSeq}
            options={SEQ_OPTIONS}
            style={{ width: 140 }}
          />
        </div>
        {list.length === 0 && !loading ? (
          <Empty description="暂无面试题，可点击右上角 AI 出题" />
        ) : (
          <Table
            rowKey="id"
            dataSource={list}
            pagination={false}
            size="middle"
            loading={loading}
            expandedRowKeys={expandedRowKeys}
            onExpand={(expanded, record) => {
              setExpandedRowKeys(expanded ? [...expandedRowKeys, record.id] : expandedRowKeys.filter((k) => k !== record.id));
            }}
            expandable={{
              expandedRowRender: (r) => r.rubric?.length ? (
                <div style={{ padding: '0 8px 8px' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>评分锚点（L1–L5 行为等级）</div>
                  {r.rubric.sort((a, b) => a.level - b.level).map((rb) => (
                    <div key={rb.level} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <Tag style={{ borderRadius: 4, margin: 0, background: 'var(--charcoal)', color: '#fff', borderColor: 'transparent' }}>L{rb.level}</Tag>
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{rb.desc}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ padding: '0 8px 8px', fontSize: 12, color: 'var(--ink-4)' }}>暂无评分锚点</div>,
            }}
            columns={[
              {
                title: '维度',
                width: 90,
                render: (_: unknown, r: InterviewQuestionOut) => (
                  <Tag style={{ borderRadius: 6, background: 'var(--charcoal)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}>
                    {DIM_LABEL[r.dimension]}
                  </Tag>
                ),
              },
              {
                title: '题目',
                render: (_: unknown, r: InterviewQuestionOut) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.question}</div>
                    {r.answer_point && (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>评分要点：{r.answer_point}</div>
                    )}
                  </div>
                ),
              },
              {
                title: '适用',
                width: 160,
                render: (_: unknown, r: InterviewQuestionOut) => (
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.position} · {r.grade}{r.sequence ? ` · ${r.sequence}` : ''}</span>
                ),
              },
              {
                title: '来源',
                width: 110,
                render: (_: unknown, r: InterviewQuestionOut) => {
                  const meta = SOURCE_META[r.source as keyof typeof SOURCE_META] ?? SOURCE_META.manual;
                  return (
                    <Tag style={{ borderRadius: 6, background: meta.bg, color: meta.color, borderColor: 'transparent' }}>{meta.label}</Tag>
                  );
                },
              },
              {
                title: '状态',
                width: 90,
                render: (_: unknown, r: InterviewQuestionOut) => {
                  const meta = STATUS_META[r.status as keyof typeof STATUS_META] ?? STATUS_META.rejected;
                  return (
                    <Tag style={{ borderRadius: 6, background: meta.bg, color: meta.color, borderColor: 'transparent', fontWeight: 600 }}>{meta.label}</Tag>
                  );
                },
              },
              {
                title: '操作',
                width: 130,
                render: (_: unknown, r: InterviewQuestionOut) =>
                  r.status === 'pending_review' ? (
                    <div style={{ display: 'flex' }}>
                      <Button type="link" size="small" style={{ color: 'var(--sage)', padding: '0 4px' }} onClick={() => review(r.id, true)}>通过</Button>
                      <Button type="link" size="small" danger style={{ padding: '0 4px' }} onClick={() => review(r.id, false)}>驳回</Button>
                    </div>
                  ) : (
                    <Tooltip title={DIM_KEY_LABEL[r.dimension_key] ?? '—'}>
                      <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>已归档</span>
                    </Tooltip>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>五维对应匹配引擎</b>：履职→职责履行、知识→知识技能、能力→能力素质、业绩→绩效、团队贡献→团队贡献；
          业绩类统一追问「最近 6–12 个月优化了哪个点、产出什么效果」；AI 生成题一律走「待审核 → 生效/驳回」。
        </div>
      </Card>

      <Modal title="AI 按职级生成五维面试题" open={genOpen} onOk={handleGenerate} onCancel={() => setGenOpen(false)} okText="生成" destroyOnClose>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>岗位</div>
            <input
              className="juno-input"
              value={genForm.position}
              onChange={(e) => setGenForm({ ...genForm, position: e.target.value })}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>职级</div>
              <input
                className="juno-input"
                value={genForm.grade}
                onChange={(e) => setGenForm({ ...genForm, grade: e.target.value })}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>岗位序列</div>
              <Select
                value={genForm.sequence}
                onChange={(v) => setGenForm({ ...genForm, sequence: v })}
                options={SEQ_OPTIONS.filter((o) => o.value)}
                style={{ width: '100%' }}
                placeholder="可选"
              />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            将按五维度（履职/知识/能力/业绩/团队贡献）各生成 1 题，含 L1–L5 行为锚点，进入待审核状态。
          </div>
        </div>
      </Modal>
    </div>
  );
}
