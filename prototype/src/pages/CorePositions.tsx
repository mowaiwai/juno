import { useMemo } from 'react';
import { Button, Card, Col, Progress, Row, Space, Table, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { corePositions } from '@/mock/succession';

const RISK_COLOR = { HIGH: 'var(--danger)', MID: 'var(--ochre)', LOW: 'var(--sage)' };
const RISK_LABEL = { HIGH: '高风险', MID: '中风险', LOW: '低风险' };

export function CorePositions() {
  const list = useMemo(() => corePositions(), []);
  const highRisk = list.filter((p) => p.risk === 'HIGH').length;
  const coverage = list.length ? Math.round((list.reduce((s, p) => s + p.coverage, 0) / list.length) * 100) : 0;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">核心岗位清单</h1>
          <div className="page-subtitle">先找核心岗位 · 再盘岗位知识能力 · 72 小时补位配套</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>核心岗位数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{list.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高风险岗位</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{highRisk}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>平均继任覆盖率</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{coverage}%</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>候选总人数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{list.reduce((s, p) => s + p.candidateCount, 0)}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="核心岗位清单" size="small">
        <Table
          rowKey="id"
          dataSource={list}
          pagination={false}
          columns={[
            { title: '岗位', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.deptName} · {r.grade}</span>
              </Space>
            )},
            { title: '编制', dataIndex: 'headcount' },
            { title: '在岗人', dataIndex: 'incumbentName', render: (v) => v ?? <Tag color="red" style={{ borderRadius: 6 }}>空缺</Tag> },
            {
              title: '继任覆盖',
              render: (_: unknown, r) => (
                <Space>
                  <Progress percent={Math.round(r.coverage * 100)} size="small" strokeColor="var(--sage)" style={{ width: 100 }} showInfo={false} />
                  <span className="num" style={{ fontSize: 12 }}>{r.candidateCount} 人</span>
                </Space>
              ),
            },
            {
              title: '风险',
              dataIndex: 'risk',
              render: (v: 'HIGH' | 'MID' | 'LOW') => (
                <Tag style={{ borderRadius: 6, background: RISK_COLOR[v] + '22', color: RISK_COLOR[v], borderColor: 'transparent' }}>{RISK_LABEL[v]}</Tag>
              ),
            },
            { title: '风险原因', dataIndex: 'riskReason', ellipsis: true },
            {
              title: '操作',
              render: (_: unknown, r) => (
                <Link to={`/app/succession-matrix?id=${r.id}`}>
                  <Button type="link" size="small">查看继任矩阵</Button>
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
