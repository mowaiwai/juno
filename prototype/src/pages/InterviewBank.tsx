import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Row, Segmented, Table, Tag, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { interviewApi, InterviewQuestionOut } from '@/api/recruit';

const DIM_LABEL: Record<number, string> = { 1: '履职', 2: '知识', 3: '能力', 4: '业绩' };
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

export function InterviewBank() {
  const [rows, setRows] = useState<InterviewQuestionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState<'all' | '1' | '2' | '3' | '4'>('all');

  useEffect(() => {
    interviewApi.list().then((data) => {
      setRows(data);
      setLoading(false);
    }).catch(() => {
      message.error('面试题库加载失败');
      setLoading(false);
    });
  }, []);

  const list = useMemo(() => rows.filter((r) => dim === 'all' || r.dimension === Number(dim)), [rows, dim]);

  const handleGenerate = () => {
    message.loading({ content: 'AI 生成中...', key: 'gen', duration: 2 });
    interviewApi.generate({ position: '高级软件工程师', grade: 'P4' }).then((newQs) => {
      setRows((prev) => [...newQs, ...prev]);
      message.success({ content: `AI 生成 ${newQs.length} 道题，已进入待审核`, key: 'gen' });
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
    dims: [1, 2, 3, 4].map((d) => rows.filter((r) => r.dimension === d).length),
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">面试题库</h1>
          <div className="page-subtitle">履职表即题库 · 任职资格四部分均可转题 · AI 按职级出题需人工审核</div>
        </div>
        <Button type="primary" icon={<RobotOutlined />} style={{ background: 'var(--charcoal)' }} onClick={handleGenerate}>
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
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>四维覆盖（履职 / 知识 / 能力 / 业绩）</div>
            <div style={{ display: 'flex', gap: 8 }}>
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
        <div style={{ marginBottom: 12 }}>
          <Segmented
            value={dim}
            onChange={(v) => setDim(v as 'all' | '1' | '2' | '3' | '4')}
            options={[
              { label: '全部维度', value: 'all' },
              { label: '履职', value: '1' },
              { label: '知识', value: '2' },
              { label: '能力', value: '3' },
              { label: '业绩', value: '4' },
            ]}
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
            columns={[
              {
                title: '维度',
                width: 70,
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
                width: 150,
                render: (_: unknown, r: InterviewQuestionOut) => (
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.position} · {r.grade}</span>
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
                    <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>已归档</span>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>追问话术约定</b>：业绩类问题统一追问「最近 6–12 个月优化了哪个点、产出什么效果」，要求数据说明并厘清个人贡献边界；
          AI 生成题一律走「待审核 → 生效/驳回」，审核记录留痕。
        </div>
      </Card>
    </div>
  );
}
