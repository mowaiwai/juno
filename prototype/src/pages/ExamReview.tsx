import { useState } from 'react';
import { Alert, Button, Card, Input, Space, Tag, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { examPapers } from '@/mock/gap';

export function ExamReview() {
  const [params] = useSearchParams();
  const paper = examPapers.find((p) => p.id === (params.get('id') ?? 'exam_sw_p4_draft'));
  const [rejectReason, setRejectReason] = useState('');

  if (!paper) {
    return <div className="page"><Alert type="info" message="未找到待审核试卷" /></div>;
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">AI 组卷审核</h1>
          <div className="page-subtitle">审核 AI 基于任职资格标准生成的试卷，通过后生效</div>
        </div>
        <Space>
          <Tag color="purple" style={{ borderRadius: 6 }}>AI 生成</Tag>
          <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>待审核</Tag>
        </Space>
      </div>

      <Alert
        style={{ marginBottom: 16, background: 'var(--teal-soft)', border: 'none' }}
        type="info"
        showIcon
        message="AI 依据「软件工程师 P4」标准的知识掌握层级要求自动出题，覆盖精通/熟练层级，建议人工核对题目与标准答案。"
      />

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title={`${paper.title} · ${paper.questions.length} 题 · 合格 ${paper.passScore} 分`} size="small">
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          {paper.questions.map((q, i) => (
            <div key={q.id} style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8 }}>
              <Space style={{ marginBottom: 8 }}>
                <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>{q.score} 分</Tag>
                <Tag style={{ borderRadius: 6 }}>{q.type === 'qa' ? '问答' : q.type === 'fill' ? '填空' : '选择'}</Tag>
                <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                  掌握层级 {['', '了解', '掌握', '熟练', '精通'][q.mastery]}
                </Tag>
              </Space>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.question}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                <b>参考答案：</b>{q.answer}
              </div>
            </div>
          ))}
        </Space>
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="审核意见" size="small">
        <Input.TextArea
          rows={2}
          placeholder="驳回原因（驳回时必填）"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <Space>
          <Button type="primary" style={{ background: 'var(--sage)' }} onClick={() => message.success('试卷已通过审核，正式生效')}>
            通过并发布
          </Button>
          <Button danger onClick={() => {
            if (!rejectReason) { message.warning('请填写驳回原因'); return; }
            message.warning('已驳回，AI 将重新组卷');
          }}>
            驳回重生成
          </Button>
        </Space>
      </Card>
    </div>
  );
}
