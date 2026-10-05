import { useEffect, useState } from 'react';
import { Card, Col, Row, Space, Spin, Statistic, Tag } from 'antd';
import { compApi, type MySalary } from '@/api/comp';

const fmt = (v: number) => `¥${v.toLocaleString()}`;
/** 绩效工具编码 → 中文标签 */
const TOOL_LABEL: Record<string, string> = {
  kpi: 'KPI', pbc: 'PBC', okr: 'OKR', review_360: '360 环评',
};

export function MySalary() {
  const [data, setData] = useState<MySalary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    compApi.mySalary().then((d) => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><Spin /></div>;
  if (!data) return <div className="page">未找到薪酬数据</div>;

  const totalBonus = data.approved_bonuses.reduce((s, b) => s + b.final_amount, 0);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的薪酬</h1>
          <div className="page-subtitle">{data.name} · {data.employee_no} · {data.grade}</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic
              title="月基本工资"
              value={data.base_salary ?? 0}
              formatter={(v) => (data.base_salary == null ? '—' : fmt(Number(v)))}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="已批奖金合计" value={totalBonus} formatter={(v) => fmt(Number(v))} />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="奖金发放笔数" value={data.approved_bonuses.length} />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="已批准奖金发放">
        {data.approved_bonuses.length === 0 ? (
          <div style={{ color: 'var(--ink-4)', padding: 24, textAlign: 'center' }}>暂无已批准奖金</div>
        ) : (
          <Row gutter={[16, 16]}>
            {data.approved_bonuses.map((b, i) => (
              <Col span={12} key={i}>
                <Card size="small" style={{ background: 'var(--surface-sunken)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color="green">已发放</Tag>
                    <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{fmt(b.final_amount)}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>{b.plan_name || '绩效奖金'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    <Space size={4} wrap>
                      {b.period && <Tag>{b.period}</Tag>}
                      {b.tool_type && <Tag color="geekblue">{TOOL_LABEL[b.tool_type] ?? b.tool_type}</Tag>}
                      {b.perf_grade && <Tag color="gold">绩效 {b.perf_grade}</Tag>}
                    </Space>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    目标奖金 {fmt(b.target_bonus)} · 公式应发 {fmt(b.formula_amount)}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  );
}
