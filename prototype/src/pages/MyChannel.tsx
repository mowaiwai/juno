import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Space, Spin, Tag, message } from 'antd';
import { CheckCircleFilled, RightOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { orgApi, type ChannelFamily, type GradeBand } from '@/api/org';
import { applicationsApi, APPLICATION_STATUS_META, type ApplicationListItemDTO, type ApplicationStatusValue } from '@/api/applications';
import { ApiError } from '@/api/client';

const IN_FLIGHT_STATUSES: ApplicationStatusValue[] = [
  'draft',
  'submitted',
  'in_manager_review',
  'in_committee_review',
  'approved',
];

export function MyChannel() {
  const persona = useAuth((s) => s.persona);
  const [channels, setChannels] = useState<ChannelFamily[] | null>(null);
  const [apps, setApps] = useState<ApplicationListItemDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      orgApi.channels().catch(() => {
        message.error('通道数据加载失败');
        return [] as ChannelFamily[];
      }),
      applicationsApi
        .mine()
        .then((list) => list)
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 401) return [] as ApplicationListItemDTO[];
          message.error('认证记录加载失败');
          return [] as ApplicationListItemDTO[];
        }),
    ]).then(([ch, ap]) => {
      setChannels(ch);
      setApps(ap);
      setError(null);
    });
  }, []);

  if (channels === null || apps === null) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  const family = channels.find((c) => c.family === (persona?.family ?? 'P'));
  const myGrade = persona?.grade ?? 'P0';
  const inFlightCert = apps.find((a) => IN_FLIGHT_STATUSES.includes(a.status));

  if (!family) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Alert type="warning" showIcon message="未找到当前职族通道配置" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的通道</h1>
          <div className="page-subtitle">
            {family.name} · 当前 {myGrade}（{family.grades.find((g) => g.grade === myGrade)?.title ?? '—'}）· 通道与带宽为制度公开数据
          </div>
        </div>
      </div>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />
      )}

      {/* 职级阶梯 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
          {family.grades.map((g: GradeBand, i: number) => {
            const isCurrent = g.grade === myGrade;
            const isTarget = inFlightCert ? g.grade === inFlightCert.target_grade : false;
            const passed = Number(g.grade.replace(/\D/g, '')) < Number(myGrade.replace(/\D/g, ''));
            return (
              <div key={g.grade} style={{ flex: 1, position: 'relative' }}>
                <div
                  style={{
                    padding: '16px 14px',
                    borderRadius: 12,
                    height: '100%',
                    border: isCurrent ? '2px solid var(--clay)' : isTarget ? '2px dashed var(--ochre)' : '1px solid var(--line)',
                    background: isCurrent ? 'var(--clay-soft)' : isTarget ? 'var(--ochre-soft)' : 'var(--surface-sunken)',
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
                    {g.band_range} · ¥{g.salary_band[0].toLocaleString()}~{g.salary_band[1].toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.7, minHeight: 52 }}>
                    {g.promote_rule}
                  </div>
                  {g.review_years && (
                    <div style={{ fontSize: 11, color: 'var(--ochre)', marginTop: 4 }}>每 {g.review_years} 年复评</div>
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
                {inFlightCert.target_sequence} 序列 · 目标职级 {inFlightCert.target_grade} 认证进行中 · 状态：
                {APPLICATION_STATUS_META[inFlightCert.status].label}
              </span>
            }
            description={
              inFlightCert.submitted_at
                ? `提交于 ${inFlightCert.submitted_at.slice(0, 10)}`
                : '草稿尚未提交，提交后进入初审'
            }
            style={{ background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}
            action={
              <Link to={`/app/cert-apply?app=${inFlightCert.id}`}>
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
          专业族与管理族一一对应同酬，P4 及以上每 {family.grades.find((g) => g.review_years)?.review_years ?? 3} 年复评一次，复评不合格降 1 级并联动调薪。
        </div>
        <Link to="/app/my-gap" style={{ display: 'inline-block', marginTop: 12, color: 'var(--clay-hover)', fontSize: 13 }}>
          查看我与下一职级标准的差距 <RightOutlined style={{ fontSize: 11 }} />
        </Link>
      </Card>
    </div>
  );
}
