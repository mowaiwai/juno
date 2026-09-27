import { useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Radio, Space, Tag, message, Progress } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { examPapers } from '@/mock/gap';

export function ExamTake() {
  const [params] = useSearchParams();
  const paper = examPapers.find((p) => p.id === (params.get('id') ?? 'exam_sw_p3')) ?? examPapers[0];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [current, setCurrent] = useState(0);

  const totalScore = paper.questions.reduce((s, q) => s + q.score, 0);
  const myScore = useMemo(() => {
    return paper.questions.reduce((s, q) => {
      const a = answers[q.id]?.trim();
      if (!a) return s;
      if (q.type === 'choice') return a === q.answer ? s + q.score : s;
      if (q.type === 'fill') return a.includes(q.answer) ? s + q.score : s;
      // 问答：mock 简单匹配关键词
      if (q.type === 'qa') return a.length >= 10 ? s + Math.round(q.score * 0.7) : s;
      return s;
    }, 0);
  }, [answers, paper]);

  const q = paper.questions[current];
  const isLast = current === paper.questions.length - 1;

  const submit = () => {
    setSubmitted(true);
    const passed = myScore >= paper.passScore;
    message[passed ? 'success' : 'warning'](`得分 ${myScore}/${totalScore}，${passed ? '通过' : '未通过'}`);
  };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">{paper.title}</h1>
          <div className="page-subtitle">{paper.questions.length} 题 · 合格 {paper.passScore} 分 · 限时 {paper.duration} 分钟</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
          {current + 1} / {paper.questions.length}
        </Tag>
      </div>

      {submitted ? (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Alert
            type={myScore >= paper.passScore ? 'success' : 'warning'}
            showIcon
            message={`考试完成 · 得分 ${myScore} / ${totalScore}`}
            description={myScore >= paper.passScore ? '恭喜通过！考试记录已回写画像。' : `未达合格线 ${paper.passScore} 分，可申请补考。`}
            style={{ marginBottom: 16 }}
          />
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {paper.questions.map((qq, i) => {
              const correct = answers[qq.id]?.trim();
              const isRight = qq.type === 'choice' ? correct === qq.answer : qq.type === 'fill' ? correct?.includes(qq.answer) : correct?.length >= 10;
              return (
                <div key={qq.id} style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600 }}>{i + 1}. {qq.question} <Tag color={isRight ? 'green' : 'red'} style={{ borderRadius: 6 }}>{isRight ? '正确' : '错误'}</Tag></div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>你的答案：{correct || '（未作答）'}</div>
                  <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 2 }}>参考答案：{qq.answer}</div>
                </div>
              );
            })}
          </Space>
        </Card>
      ) : (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Progress percent={Math.round(((current + 1) / paper.questions.length) * 100)} showInfo={false} strokeColor="var(--clay)" style={{ marginBottom: 20 }} />

          <div style={{ marginBottom: 16 }}>
            <Space>
              <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>{q.score} 分</Tag>
              <Tag style={{ borderRadius: 6 }}>{q.type === 'choice' ? '选择题' : q.type === 'fill' ? '填空题' : '问答题'}</Tag>
            </Space>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 10 }}>{current + 1}. {q.question}</div>
          </div>

          {q.type === 'choice' && (
            <Radio.Group
              value={answers[q.id]}
              onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {q.options?.map((opt) => (
                  <Radio key={opt} value={opt} style={{ display: 'block', padding: '8px 12px', borderRadius: 8, background: answers[q.id] === opt ? 'var(--clay-soft)' : 'var(--surface-sunken)' }}>
                    {opt}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          )}

          {q.type === 'fill' && (
            <Input
              placeholder="请输入答案"
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
              size="large"
            />
          )}

          {q.type === 'qa' && (
            <Input.TextArea
              rows={5}
              placeholder="请输入你的回答"
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>上一题</Button>
            <Space>
              {isLast ? (
                <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={submit}>提交试卷</Button>
              ) : (
                <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => setCurrent((c) => c + 1)}>下一题</Button>
              )}
            </Space>
          </div>
        </Card>
      )}
    </div>
  );
}
