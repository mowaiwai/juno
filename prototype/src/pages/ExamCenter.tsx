import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Row, Space, Table, Tag, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { examApi, type AttemptDTO, type ExamPaperDTO } from '@/api/exam';

const STATUS_LABEL = { pending_review: '待审核', published: '已发布', rejected: '已驳回' } as const
const STATUS_COLOR = {
  pending_review: 'var(--ochre)',
  published: 'var(--sage)',
  rejected: 'var(--danger)',
} as const

export function ExamCenter() {
  const navigate = useNavigate()
  const activeRole = useAuth((s) => s.activeRole)
  // AI 组卷审核：组织与人才发展、招聘运营
  const isHr = activeRole === 'hr_coe_otd' || activeRole === 'hr_coe_recruit'

  const [papers, setPapers] = useState<ExamPaperDTO[]>([])
  const [attempts, setAttempts] = useState<AttemptDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([examApi.listPapers(), examApi.listAttempts()])
      .then(([p, a]) => {
        setPapers(p)
        setAttempts(a)
      })
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(
    () => ({
      published: papers.filter((p) => p.status === 'published').length,
      pending: papers.filter((p) => p.status === 'pending_review').length,
      myAttempts: attempts.length,
    }),
    [papers, attempts],
  )

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">考试中心</h1>
          <div className="page-subtitle">在线知识考试 · 成绩记录 · AI 组卷审核</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>可考试卷</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{stats.published}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>我的考试次数</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{stats.myAttempts}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待审核试卷</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{stats.pending}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="试卷列表" size="small">
        <Table
          rowKey="id"
          dataSource={papers}
          pagination={false}
          columns={[
            {
              title: '试卷',
              render: (_: unknown, r: ExamPaperDTO) => (
                <Space direction="vertical" size={2}>
                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                    {[r.target_position, r.target_grade].filter(Boolean).join(' · ') || '通用'} ·{' '}
                    {r.question_count} 题 · {r.duration_minutes} 分钟
                  </span>
                  {r.status === 'rejected' && r.reject_reason && (
                    <span style={{ fontSize: 11, color: 'var(--danger)' }}>驳回原因：{r.reject_reason}</span>
                  )}
                </Space>
              ),
            },
            { title: '合格分', dataIndex: 'pass_score' },
            {
              title: '组卷方式',
              dataIndex: 'source',
              render: (v: string) =>
                v === 'ai' ? (
                  <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>AI 生成</Tag>
                ) : (
                  '人工'
                ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: keyof typeof STATUS_LABEL) => (
                <Tag style={{ borderRadius: 6, background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s], borderColor: 'transparent' }}>
                  {STATUS_LABEL[s]}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_: unknown, r: ExamPaperDTO) => {
                if (r.status === 'published') {
                  return (
                    <Button
                      type="primary"
                      size="small"
                      style={{ background: 'var(--charcoal)' }}
                      onClick={() => navigate(`/app/exam-take?id=${r.id}`)}
                    >
                      开始考试
                    </Button>
                  )
                }
                if (r.status === 'pending_review' && isHr) {
                  return (
                    <Button size="small" onClick={() => navigate(`/app/exam-review?id=${r.id}`)}>
                      去审核
                    </Button>
                  )
                }
                return (
                  <Button size="small" disabled>
                    不可用
                  </Button>
                )
              },
            },
          ]}
        />
      </Card>

      {attempts.length > 0 && (
        <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="我的考试记录" size="small">
          <Table
            rowKey="id"
            dataSource={attempts}
            pagination={false}
            columns={[
              { title: '试卷', dataIndex: 'paper_title' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (s: string) => (s === 'submitted' ? '已交卷' : '进行中'),
              },
              { title: '得分', render: (_: unknown, r: AttemptDTO) => (r.status === 'submitted' ? `${r.score}/${r.total_score}` : '—') },
              {
                title: '是否通过',
                dataIndex: 'passed',
                render: (v: boolean, r: AttemptDTO) =>
                  r.status !== 'submitted' ? (
                    '—'
                  ) : v ? (
                    <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>通过</Tag>
                  ) : (
                    <Tag style={{ borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }}>未通过</Tag>
                  ),
              },
              {
                title: '提交时间',
                render: (_: unknown, r: AttemptDTO) =>
                  r.submitted_at ? new Date(r.submitted_at).toLocaleString('zh-CN') : '—',
              },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
