import { useMemo } from 'react';
import { Button, Card, Col, Row, Space, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { examPapers, examRecords } from '@/mock/gap';

const PAPER_STATUS_LABEL = { pending_review: '待审核', approved: '已生效', rejected: '已驳回' };
const PAPER_STATUS_COLOR = { pending_review: 'var(--ochre)', approved: 'var(--sage)', rejected: 'var(--danger)' };

export function ExamCenter() {
  const navigate = useNavigate();
  const persona = useAuth((s) => s.persona);
  const empId = persona?.employeeId;
  const myRecords = useMemo(() => examRecords.filter((r) => r.employeeId === empId), [empId]);

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
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{examPapers.filter((p) => p.status === 'approved').length}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>我的考试次数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{myRecords.length}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待审核试卷</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{examPapers.filter((p) => p.status === 'pending_review').length}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="试卷列表" size="small">
        <Table
          rowKey="id"
          dataSource={examPapers}
          pagination={false}
          columns={[
            { title: '试卷', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position} · {r.grade} · {r.questions.length} 题 · {r.duration} 分钟</span>
              </Space>
            )},
            { title: '合格分', dataIndex: 'passScore' },
            {
              title: 'AI 组卷',
              dataIndex: 'aiGenerated',
              render: (v: boolean) => v ? <Tag color="purple" style={{ borderRadius: 6 }}>AI 生成</Tag> : '人工',
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: 'pending_review' | 'approved' | 'rejected') => (
                <Tag style={{ borderRadius: 6, background: PAPER_STATUS_COLOR[s] + '22', color: PAPER_STATUS_COLOR[s], borderColor: 'transparent' }}>
                  {PAPER_STATUS_LABEL[s]}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_: unknown, r) => {
                if (r.status === 'approved') {
                  return <Button type="primary" size="small" style={{ background: 'var(--charcoal)' }} onClick={() => navigate(`/app/exam-take?id=${r.id}`)}>开始考试</Button>;
                }
                if (r.status === 'pending_review' && persona?.roles.includes('hr')) {
                  return <Button size="small" onClick={() => navigate(`/app/exam-review?id=${r.id}`)}>去审核</Button>;
                }
                return <Button size="small" disabled>不可用</Button>;
              },
            },
          ]}
        />
      </Card>

      {myRecords.length > 0 && (
        <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="我的考试记录" size="small">
          <Table
            rowKey="id"
            dataSource={myRecords}
            pagination={false}
            columns={[
              { title: '试卷', render: (_: unknown, r) => examPapers.find((p) => p.id === r.paperId)?.title },
              { title: '得分', dataIndex: 'score' },
              { title: '是否通过', dataIndex: 'passed', render: (v: boolean) => v ? <Tag color="green" style={{ borderRadius: 6 }}>通过</Tag> : <Tag color="red" style={{ borderRadius: 6 }}>未通过</Tag> },
              { title: '提交时间', dataIndex: 'submittedAt' },
              { title: '剩余补考', dataIndex: 'retryLeft', render: (v: number) => v > 0 ? `${v} 次` : '无' },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
