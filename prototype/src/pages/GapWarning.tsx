import { Card, Col, Progress, Row, Space, Table, Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { gapWarnings } from '@/mock/inventory';

const LEVEL_COLOR: Record<string, string> = {
  HIGH: 'var(--danger)',
  MID: 'var(--ochre)',
  LOW: 'var(--sage)',
};

const LEVEL_LABEL: Record<string, string> = {
  HIGH: '高风险',
  MID: '中风险',
  LOW: '低风险',
};

export function GapWarning() {
  const high = gapWarnings.filter((g) => g.level === 'HIGH').length;
  const mid = gapWarnings.filter((g) => g.level === 'MID').length;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">断层预警</h1>
          <div className="page-subtitle">核心岗位继任就绪度监控 · 72 小时补位配套机制</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Space>
              <WarningOutlined style={{ color: 'var(--danger)', fontSize: 24 }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高风险断层</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{high}</div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>中风险断层</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{mid}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>72h 补位 SLA</div>
            <Progress percent={100} strokeColor="var(--sage)" showInfo={false} style={{ width: 120, marginTop: 6 }} />
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>核心岗位 72 小时内出候选名单</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="断层岗位清单" size="small">
        <Table
          rowKey="positionId"
          dataSource={gapWarnings}
          pagination={false}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ padding: '8px 16px', background: 'var(--surface-sunken)', borderRadius: 8 }}>
                <div style={{ marginBottom: 8 }}><b>风险原因：</b>{r.reason}</div>
                <div><b>补位建议：</b>{r.suggestion}</div>
              </div>
            ),
          }}
          columns={[
            { title: '岗位', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.positionName}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.deptName}</span>
              </Space>
            )},
            { title: '在岗人', render: (_: unknown, r) => r.incumbentName },
            {
              title: '风险等级',
              dataIndex: 'level',
              render: (l: string) => (
                <Tag style={{ borderRadius: 6, background: LEVEL_COLOR[l] + '22', color: LEVEL_COLOR[l], borderColor: 'transparent' }}>
                  {LEVEL_LABEL[l]}
                </Tag>
              ),
            },
            { title: '风险原因', dataIndex: 'reason', ellipsis: true },
            {
              title: '补位建议',
              render: () => <Tag color="blue" style={{ borderRadius: 6 }}>展开查看</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
