import { useMemo } from 'react';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { GRID_CELLS, batchById, gridDistribution, resultsOfBatch } from '@/mock/inventory';

const { Paragraph } = Typography;

export function GridStrategy() {
  const [params] = useSearchParams();
  const batch = batchById(params.get('id') ?? 'inv_2026_h1');
  const results = useMemo(() => (batch ? resultsOfBatch(batch.id) : []), [batch]);
  const dist = useMemo(() => gridDistribution(results), [results]);

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">差异化策略</h1>
          <div className="page-subtitle">基于九宫格定位的人才策略建议，覆盖培养、激励、改进、退出四类动作</div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {GRID_CELLS.map((c) => {
          const list = (dist.get(c.code) ?? []).map((r) => employees.find((e) => e.id === r.employeeId)!);
          const isEmpty = list.length === 0;
          return (
            <Col span={8} key={c.code}>
              <Card
                variant="borderless"
                style={{ background: 'var(--surface)', borderTop: `3px solid ${c.color}`, opacity: isEmpty ? 0.55 : 1 }}
                size="small"
                title={
                  <Space>
                    <span className="num" style={{ color: c.color, fontWeight: 700 }}>{c.code}</span>
                    <span style={{ fontWeight: 700 }}>{c.label}</span>
                    <Tag style={{ background: c.color + '22', color: c.color, borderColor: 'transparent', borderRadius: 6, marginInlineStart: 8 }}>{list.length} 人</Tag>
                  </Space>
                }
              >
                <Paragraph style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>{c.strategy}</Paragraph>
                {isEmpty ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>本格暂无员工</div>
                ) : (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {list.map((e) => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 8px', borderRadius: 6, background: 'var(--surface-sunken)' }}>
                        <span style={{ fontWeight: 600 }}>{e.name}</span>
                        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{e.position} · {deptName(e.deptId)}</span>
                      </div>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="策略执行说明" size="small">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.9 }}>
          <li><b>重点培养区（9A1/9B1）</b>：纳入高潜池，配导师、给核心项目、加速晋升通道，每季度复盘。</li>
          <li><b>保留激励区（9A2/9A3）</b>：调薪倾斜、关键岗位匹配、避免职业倦怠，关注流失风险。</li>
          <li><b>培养辅导区（9B1/9C1）</b>：IDP 聚焦短板，配辅导人，3-6 个月观察期。</li>
          <li><b>绩效改进区（9B3/9C2/9C3）</b>：启动 PIP，设明确目标与周期，不行则转岗/降级/退出。</li>
        </ul>
      </Card>
    </div>
  );
}
