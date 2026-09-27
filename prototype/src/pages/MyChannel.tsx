import { Link } from 'react-router-dom';
import { Alert, Button, Card, Space, Tag } from 'antd';
import { CheckCircleFilled, RightOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { employeeById } from '@/mock/people';
import { channels } from '@/mock/channels';
import { certByEmployee } from '@/mock/certifications';

export function MyChannel() {
  const persona = useAuth((s) => s.persona);
  const emp = employeeById(persona?.employeeId);
  const family = channels.find((c) => c.family === (emp?.family ?? 'P'))!;
  const inFlightCert = emp ? certByEmployee(emp.id).find((c) => !['passed', 'terminated'].includes(c.stage)) : undefined;

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的通道</h1>
          <div className="page-subtitle">
            {family.name} · 当前 {emp?.grade}（{family.grades.find((g) => g.grade === emp?.grade)?.title}）· 通道与带宽为制度公开数据
          </div>
        </div>
      </div>

      {/* 职级阶梯 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
          {family.grades.map((g, i) => {
            const isCurrent = g.grade === emp?.grade;
            const isTarget = inFlightCert ? g.grade === inFlightCert.toGrade : false;
            const passed = Number(g.grade.replace(/\D/g, '')) < Number((emp?.grade ?? 'P0').replace(/\D/g, ''));
            return (
              <div key={g.grade} style={{ flex: 1, position: 'relative' }}>
                <div
                  style={{
                    padding: '16px 14px',
                    borderRadius: 12,
                    height: '100%',
                    border: isCurrent ? '2px solid var(--clay)' : isTarget ? '2px dashed var(--ochre)' : '1px solid var(--line)',
                    background: isCurrent ? 'var(--clay-soft)' : isTarget ? 'var(--ochre-soft)' : 'var(--surface-sunken)',
                    marginTop: (family.grades.length - 1 - i) * 0,
                  }}
                >
                  <Space size={6}>
                    <span className="num" style={{ fontSize: 18, fontWeight: 700, color: isCurrent ? 'var(--clay-hover)' : 'var(--ink)' }}>{g.grade}</span>
                    {isCurrent && <Tag style={{ borderRadius: 6, background: 'var(--clay)', color: '#fff', borderColor: 'transparent', fontSize: 11 }}>当前</Tag>}
                    {isTarget && !isCurrent && <Tag style={{ borderRadius: 6, background: 'var(--ochre)', color: '#fff', borderColor: 'transparent', fontSize: 11 }}>目标</Tag>}
                    {passed && !isCurrent && <CheckCircleFilled style={{ color: 'var(--sage)', fontSize: 12 }} />}
                  </Space>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{g.title}</div>
                  <div className="num" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                    {g.bandRange} · ¥{g.salaryBand[0].toLocaleString()}~{g.salaryBand[1].toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.7, minHeight: 52 }}>
                    {g.promoteRule}
                  </div>
                  {g.reviewYears && (
                    <div style={{ fontSize: 11, color: 'var(--ochre)', marginTop: 4 }}>每 {g.reviewYears} 年复评</div>
                  )}
                </div>
                {i < family.grades.length - 1 && (
                  <div style={{ position: 'absolute', right: -11, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: 'var(--ink-4)', fontSize: 12 }}>›</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 认证状态与建议 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="我的晋升窗口">
        {inFlightCert ? (
          <Alert
            type="info"
            showIcon
            message={
              <span>
                {inFlightCert.sequence}-{inFlightCert.fromGrade} → {inFlightCert.toGrade} 认证进行中 · 路由：
                {inFlightCert.router === 3 ? '管委会终审' : inFlightCert.router === 2 ? '认证小组表决' : '部门经理审批'}
              </span>
            }
            description={`发起于 ${inFlightCert.initiatedAt}，举证截止 ${inFlightCert.deadline}。整体进度 ${inFlightCert.progress}%。`}
            style={{ background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}
            action={
              <Link to="/app/cert-apply">
                <Button size="small" type="primary" style={{ background: 'var(--charcoal)' }}>继续认证</Button>
              </Link>
            }
          />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>当前无进行中的认证。下一认证窗口开放时可在此发起。</span>
        )}
      </Card>

      {/* 通道说明 */}
      <Card variant="borderless" style={{ background: 'var(--surface)' }} title={`${family.name}发展路径`} size="small">
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 2 }}>
          {family.desc}。序列：{family.sequences.join(' / ')}。
          专业族与管理族一一对应同酬，P4 及以上每 {family.grades.find((g) => g.reviewYears)?.reviewYears ?? 3} 年复评一次，复评不合格降 1 级并联动调薪。
        </div>
        <Link to="/app/my-gap" style={{ display: 'inline-block', marginTop: 12, color: 'var(--clay-hover)', fontSize: 13 }}>
          查看我与下一职级标准的差距 <RightOutlined style={{ fontSize: 11 }} />
        </Link>
      </Card>
    </div>
  );
}
