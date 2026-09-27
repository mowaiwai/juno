import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Progress, Row, Select, Space, Table, Tag, message } from 'antd';
import { departments } from '@/mock/org';
import { riskWarnings } from '@/mock/succession';

const LEVEL_COLOR = { HIGH: 'var(--danger)', MID: 'var(--ochre)', LOW: 'var(--sage)' };
const LEVEL_LABEL = { HIGH: '高风险', MID: '中风险', LOW: '低风险' };

export function RiskWarning() {
  const [level, setLevel] = useState('all');
  const [deptId, setDeptId] = useState('all');
  const list = useMemo(() => riskWarnings(), []);
  const filtered = list.filter((r) => (level === 'all' || r.level === level) && (deptId === 'all' || r.deptName === departments.find((d) => d.id === deptId)?.name));

  const high = list.filter((r) => r.level === 'HIGH').length;
  const avg = list.length ? Math.round(list.reduce((s, r) => s + r.score, 0) / list.length) : 0;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">离职风险预警</h1>
          <div className="page-subtitle">风险信号 → 原因引用 → 干预建议（72 小时补位配套）</div>
        </div>
        <Space>
          <Select value={level} onChange={setLevel} style={{ width: 140 }} options={[{ value: 'all', label: '全部等级' }, { value: 'HIGH', label: '高风险' }, { value: 'MID', label: '中风险' }, { value: 'LOW', label: '低风险' }]} />
          <Select value={deptId} onChange={setDeptId} style={{ width: 180 }} options={[{ value: 'all', label: '全公司' }, ...departments.filter((d) => d.parentId !== '0').map((d) => ({ value: d.id, label: d.name }))]} />
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高风险员工</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{high}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>风险员工总数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{list.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>平均风险分</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{avg}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>需 72h 介入</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{high}</div>
          </Card>
        </Col>
      </Row>

      <Alert
        style={{ marginBottom: 16, background: 'var(--danger-soft)', border: 'none' }}
        type="error"
        showIcon
        message={`检测到 ${high} 名高风险员工，建议 HRBP 在 72 小时内介入面谈，启动保留方案。`}
      />

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="风险员工清单" size="small">
        <Table
          rowKey="employeeId"
          dataSource={filtered}
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ padding: '8px 16px', background: 'var(--surface-sunken)', borderRadius: 8 }}>
                <div style={{ marginBottom: 8 }}><b>风险原因（引用画像数据）：</b></div>
                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)' }}>
                  {r.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                </ul>
                <div style={{ marginTop: 8 }}><b>干预建议：</b><span style={{ color: 'var(--clay)' }}>{r.suggestion}</span></div>
              </div>
            ),
          }}
          columns={[
            { title: '员工', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position}</span>
              </Space>
            )},
            { title: '部门', dataIndex: 'deptName' },
            {
              title: '风险分',
              dataIndex: 'score',
              render: (v: number) => (
                <Space>
                  <Progress type="circle" size={36} percent={v} strokeColor={v >= 60 ? 'var(--danger)' : v >= 35 ? 'var(--ochre)' : 'var(--sage)'} />
                  <span className="num">{v}</span>
                </Space>
              ),
            },
            {
              title: '等级',
              dataIndex: 'level',
              render: (v: 'HIGH' | 'MID' | 'LOW') => <Tag style={{ borderRadius: 6, background: LEVEL_COLOR[v] + '22', color: LEVEL_COLOR[v], borderColor: 'transparent' }}>{LEVEL_LABEL[v]}</Tag>,
            },
            { title: '干预建议', dataIndex: 'suggestion', ellipsis: true },
            {
              title: '操作',
              render: () => (
                <Space>
                  <Button size="small" type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => message.success('已创建保留面谈任务')}>启动保留</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
