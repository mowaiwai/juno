import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Popconfirm, Space, Spin, Tag, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { examApi, type ExamPaperDTO } from '@/api/exam';

export function ExamReview() {
  const [params] = useSearchParams()
  const paperId = params.get('id') ?? ''

  const [paper, setPaper] = useState<ExamPaperDTO | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'' | 'approved' | 'rejected'>('')

  useEffect(() => {
    let cancelled = false
    if (!paperId) {
      setPaper(null)
      setNotFound(true)
      return () => {
        cancelled = true
      }
    }
    setNotFound(false)
    examApi
      .getPaper(paperId)
      .then((p) => {
        if (cancelled) return
        // 防御：空 id 时 /exam/papers/ 会被折叠到列表接口返回 []，
        // 只有真正带 id 的对象才是试卷。
        if (p && typeof p === 'object' && p.id) {
          setPaper(p)
          setNotFound(false)
        } else {
          setPaper(null)
          setNotFound(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPaper(null)
          setNotFound(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [paperId])

  if (paper === null) {
    if (notFound) {
      return (
        <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', marginBottom: 16 }}>
            未找到待审核试卷，可能已被处理或链接无效。
          </p>
          <Button type="primary" href="/app/exam-center">
            返回考试中心
          </Button>
        </div>
      )
    }
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const approve = async () => {
    setBusy(true)
    try {
      await examApi.approve(paperId)
      setDone('approved')
      message.success('试卷已通过审核并发布')
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!rejectReason.trim()) {
      message.warning('请填写驳回原因')
      return
    }
    setBusy(true)
    try {
      await examApi.reject(paperId, rejectReason.trim())
      setDone('rejected')
      message.warning('试卷已驳回')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">
            <ArrowLeftOutlined style={{ fontSize: 18, marginRight: 10 }} onClick={() => (window.location.href = '/app/exam-center')} />
            AI 组卷审核
          </h1>
          <div className="page-subtitle">审核 AI 基于任职资格标准生成的试卷，通过后发布生效</div>
        </div>
        <Space>
          <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>AI 生成</Tag>
          <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
            {done === 'approved' ? '已发布' : done === 'rejected' ? '已驳回' : '待审核'}
          </Tag>
        </Space>
      </div>

      {done && (
        <Alert
          style={{ marginBottom: 16 }}
          type={done === 'approved' ? 'success' : 'warning'}
          showIcon
          message={done === 'approved' ? '试卷已发布，员工可在考试中心参加考试。' : '试卷已驳回，可调整需求后由 AI 重新组卷。'}
        />
      )}

      <Alert
        style={{ marginBottom: 16, background: 'var(--teal-soft)', border: 'none' }}
        type="info"
        showIcon
        message={`AI 依据「${[paper.target_position, paper.target_grade].filter(Boolean).join(' ') || '岗位标准'}」自动出题，建议人工核对题目内容与标准答案。`}
      />

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)' }}
        title={`${paper.title} · ${paper.question_count} 题 · 合格 ${paper.pass_score} 分`}
        size="small"
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          {paper.questions?.map((q) => (
            <div key={q.id} style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8 }}>
              <Space style={{ marginBottom: 8 }}>
                <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>{q.score} 分</Tag>
                <Tag>单选</Tag>
              </Space>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {q.sort_order}. {q.stem}
              </div>
              <Space direction="vertical" size={4} style={{ marginBottom: 8 }}>
                {q.options.map((opt, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: i === q.answer_index ? 'var(--sage-soft)' : 'transparent',
                      color: i === q.answer_index ? 'var(--sage)' : 'var(--ink-3)',
                      fontWeight: i === q.answer_index ? 600 : 400,
                    }}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                    {i === q.answer_index && ' ✓ 正确答案'}
                  </div>
                ))}
              </Space>
              {q.analysis && (
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  <b>解析：</b>
                  {q.analysis}
                </div>
              )}
            </div>
          ))}
        </Space>
      </Card>

      {!done && (
        <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="审核意见" size="small">
          <Input.TextArea
            rows={2}
            placeholder="驳回原因（驳回时必填）"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Space>
            <Popconfirm title="确认通过并发布该试卷？" onConfirm={approve}>
              <Button type="primary" style={{ background: 'var(--sage)' }} loading={busy}>
                通过并发布
              </Button>
            </Popconfirm>
            <Button danger loading={busy} onClick={reject}>
              驳回
            </Button>
          </Space>
        </Card>
      )}

      {done && (
        <div style={{ marginTop: 16 }}>
          <Button type="primary" href="/app/exam-center">
            返回考试中心
          </Button>
        </div>
      )}
    </div>
  )
}
