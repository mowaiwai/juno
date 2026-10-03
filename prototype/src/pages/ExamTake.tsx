import { useEffect, useState } from 'react';
import { Alert, Button, Card, Radio, Result as AntResult, Space, Spin, Tag, Progress } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { examApi, type AttemptDTO, type StartDTO } from '@/api/exam';

export function ExamTake() {
  const [params] = useSearchParams()
  const paperId = params.get('id') ?? ''

  const [started, setStarted] = useState<StartDTO | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [current, setCurrent] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AttemptDTO | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    examApi
      .start(paperId)
      .then((d) => {
        if (!cancelled) setStarted(d)
      })
      .catch(() => {
        if (!cancelled) setError('试卷加载失败，请返回考试中心重试')
      })
    return () => {
      cancelled = true
    }
  }, [paperId])

  if (error) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <Alert type="error" showIcon message={error} action={<Button href="/app/exam-center">返回考试中心</Button>} />
      </div>
    )
  }

  if (!started) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  // 交卷结果页
  if (result) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <AntResult
            status={result.passed ? 'success' : 'warning'}
            title={`考试完成 · 得分 ${result.score} / ${result.total_score}`}
            subTitle={
              result.passed
                ? '恭喜通过！考试记录已保存。'
                : `未达合格线 ${started.pass_score} 分，可返回考试中心申请补考。`
            }
            extra={[
              <Button type="primary" key="back" href="/app/exam-center">
                返回考试中心
              </Button>,
            ]}
          />
          <Space direction="vertical" size={10} style={{ width: '100%', padding: '0 24px 24px' }}>
            {result.questions?.map((qq) => (
              <div key={qq.id} style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600 }}>
                  {qq.sort_order}. {qq.stem}{' '}
                  <Tag style={{ borderRadius: 6, background: qq.correct ? 'var(--sage-soft)' : 'var(--danger-soft)', color: qq.correct ? 'var(--sage)' : 'var(--danger)', borderColor: 'transparent' }}>
                    {qq.correct ? '正确' : '错误'}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  你的答案：{qq.selected_index === null ? '（未作答）' : qq.options[qq.selected_index]}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 2 }}>
                  参考答案：{qq.options[qq.answer_index]}
                </div>
              </div>
            ))}
          </Space>
        </Card>
      </div>
    )
  }

  const questions = started.questions
  const q = questions[current]
  const isLast = current === questions.length - 1
  const answeredCount = questions.filter((x) => answers[x.id] !== undefined).length

  const submit = async () => {
    setSubmitting(true)
    try {
      const graded = await examApi.submit(started.attempt_id, answers)
      setResult(graded)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">
            <ArrowLeftOutlined style={{ fontSize: 18, marginRight: 10 }} onClick={() => (window.location.href = '/app/exam-center')} />
            {started.title}
          </h1>
          <div className="page-subtitle">
            {questions.length} 题 · 合格 {started.pass_score} 分 · 限时 {started.duration_minutes} 分钟
          </div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
          {current + 1} / {questions.length}
        </Tag>
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Progress percent={Math.round(((current + 1) / questions.length) * 100)} showInfo={false} strokeColor="var(--clay)" style={{ marginBottom: 20 }} />

        <div style={{ marginBottom: 16 }}>
          <Space>
            <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>{q.score} 分</Tag>
            <Tag>单选题</Tag>
          </Space>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 10 }}>
            {q.sort_order}. {q.stem}
          </div>
        </div>

        <Radio.Group
          value={answers[q.id]}
          onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {q.options.map((opt, i) => (
              <Radio
                key={i}
                value={i}
                style={{ display: 'block', padding: '8px 12px', borderRadius: 8, background: answers[q.id] === i ? 'var(--clay-soft)' : 'var(--surface-sunken)' }}
              >
                {opt}
              </Radio>
            ))}
          </Space>
        </Radio.Group>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            上一题
          </Button>
          <Space>
            {isLast ? (
              <Button type="primary" style={{ background: 'var(--charcoal)' }} loading={submitting} onClick={submit}>
                交卷{answeredCount < questions.length ? `（${answeredCount}/${questions.length} 已答）` : ''}
              </Button>
            ) : (
              <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => setCurrent((c) => c + 1)}>
                下一题
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  )
}
