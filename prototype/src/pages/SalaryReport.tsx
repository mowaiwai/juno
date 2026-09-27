import { useMemo } from 'react';
import { Button, Card, Col, Row, Tag, message } from 'antd';
import { FilePdfOutlined, FilePptOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { bandOf, settleConclusion, settleOptions, settleQuestions } from '@/mock/salary';
import { employees } from '@/mock/people';

export function SalaryReport() {
  const stats = useMemo(() => {
    let low = 0;
    let high = 0;
    let inBand = 0;
    const ratios: number[] = [];
    for (const e of employees) {
      const b = bandOf(e.sequence, e.grade);
      if (!b) continue;
      const r = e.salary / b.mid;
      ratios.push(r);
      if (r < 0.85) low++;
      else if (r > 1.15) high++;
      else inBand++;
    }
    ratios.sort((a, b) => a - b);
    return {
      total: ratios.length,
      low,
      high,
      inBand,
      median: ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0,
    };
  }, []);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">套改汇报材料</h1>
          <div className="page-subtitle">薪酬套改：先结论 → 抛问题 → 数据 → 2–3 套方案 · 供高管会汇报</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<FilePdfOutlined />} onClick={() => message.success('汇报 PDF 已生成（模拟）')}>
            导出 PDF
          </Button>
          <Button icon={<FilePptOutlined />} onClick={() => message.success('汇报 PPT 已生成（模拟）')}>
            导出 PPT
          </Button>
        </div>
      </div>

      {/* 一、结论先行 */}
      <Card variant="borderless" style={{ background: 'var(--clay-soft)', marginBottom: 16 }} size="small">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Tag style={{ borderRadius: 6, background: 'var(--clay)', color: '#fff', borderColor: 'transparent', fontWeight: 700, marginTop: 2 }}>结论</Tag>
          <div className="font-serif" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.7 }}>
            {settleConclusion}
          </div>
        </div>
      </Card>

      {/* 二、抛出问题 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="二、抛给管理层的三个问题">
        <Row gutter={16}>
          {settleQuestions.map((q, i) => (
            <Col span={8} key={i}>
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: 14, height: '100%' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <QuestionCircleOutlined style={{ color: 'var(--ochre)' }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>问题 {i + 1}</span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{q.q}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>{q.detail}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 三、数据支撑 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="三、数据支撑（基于 2026 等级工资表实测）">
        <Row gutter={16}>
          <Col span={5}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>套改覆盖</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{stats.total} 人</div>
            </Card>
          </Col>
          <Col span={5}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>带宽下沿（&lt;0.85）</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{stats.low} 人</div>
            </Card>
          </Col>
          <Col span={5}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>带宽内</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--sage)' }}>{stats.inBand} 人</div>
            </Card>
          </Col>
          <Col span={5}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>带宽上沿（&gt;1.15）</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{stats.high} 人</div>
            </Card>
          </Col>
          <Col span={4}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>渗透率中位</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--teal)' }}>{stats.median.toFixed(2)}</div>
            </Card>
          </Col>
        </Row>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.8 }}>
          口径说明：渗透率 = 当前月薪 ÷ 所在职级带宽中位值。带宽上沿 {stats.high} 人集中于管理与职能序列（含中位倒挂样本），
          套改时建议冻结晋升档并以年度调薪自然消化；带宽下沿 {stats.low} 人以过渡补贴保护，避免套低离职风险。
        </div>
      </Card>

      {/* 四、2–3 套方案 */}
      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="四、备选方案（三选一）">
        <Row gutter={16}>
          {settleOptions.map((o) => (
            <Col span={8} key={o.id}>
              <div
                style={{
                  border: o.recommended ? '2px solid var(--sage)' : '1px solid var(--line)',
                  borderRadius: 10,
                  padding: 16,
                  height: '100%',
                  background: o.recommended ? 'var(--sage-soft)' : 'var(--surface)',
                  position: 'relative',
                }}
              >
                {o.recommended && (
                  <Tag style={{ position: 'absolute', top: -10, right: 12, borderRadius: 6, background: 'var(--sage)', color: '#fff', borderColor: 'transparent', fontWeight: 700 }}>
                    推荐
                  </Tag>
                )}
                <div className="font-serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{o.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>{o.tagline}</div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>月成本</div>
                    <div className="num" style={{ fontWeight: 700, color: 'var(--clay)' }}>{o.monthlyCost}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>影响面</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{o.affected}</div>
                  </div>
                </div>
                {o.pros.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--sage)', marginBottom: 4 }}>✓ {p}</div>
                ))}
                {o.cons.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--ochre)', marginBottom: 4 }}>△ {c}</div>
                ))}
              </div>
            </Col>
          ))}
        </Row>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>管理层意见：</span>
          <Button size="small" onClick={() => message.success('已记录：倾向方案 B，提交薪酬委员会走特批流程（模拟）')}>
            记录管理层选择（模拟）
          </Button>
        </div>
      </Card>
    </div>
  );
}
