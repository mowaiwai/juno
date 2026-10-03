import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useAuth, useActiveRoleMeta } from '@/store/auth';
import { employeesApi, type EmployeeDetailItem } from '@/api/employees';
import { orgApi, makeDeptName, type ChannelFamily, type GradeBand } from '@/api/org';
import { profilesApi, type ProfileOut } from '@/api/profiles';
import { applicationsApi, APPLICATION_STATUS_META, type ApplicationListItemDTO, type ApplicationStatusValue } from '@/api/applications';

const IN_FLIGHT_STATUSES: ApplicationStatusValue[] = [
  'draft',
  'submitted',
  'in_manager_review',
  'in_committee_review',
  'approved',
];

function yearsSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.round((diff / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
}

export function EmployeeDetail() {
  const [params] = useSearchParams();
  const persona = useAuth((s) => s.persona);
  const meta = useActiveRoleMeta();

  const id = params.get('id') ?? persona?.employeeId;
  const isSelf = id === persona?.employeeId;

  const [emp, setEmp] = useState<EmployeeDetailItem | null | undefined>(undefined);
  const [depts, setDepts] = useState<ReturnType<typeof makeDeptName> | null>(null);
  const [band, setBand] = useState<GradeBand | null>(null);
  const [familyName, setFamilyName] = useState<string>('');
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [apps, setApps] = useState<ApplicationListItemDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('缺少员工 id');
      return;
    }

    Promise.all([
      employeesApi.getById(id).catch(() => {
        message.error('员工档案加载失败');
        return null as EmployeeDetailItem | null;
      }),
      orgApi.departments().catch(() => {
        message.error('部门数据加载失败');
        return [];
      }),
      orgApi.channels().catch(() => {
        message.error('通道数据加载失败');
        return [] as ChannelFamily[];
      }),
      // 画像：仅 self 或有完整画像权限时请求
      (isSelf || meta?.seeFullProfile
        ? profilesApi.latest(id).catch(() => null as ProfileOut | null)
        : Promise.resolve(null as ProfileOut | null)),
      // 认证记录：仅本人可看自己的申请
      (isSelf
        ? applicationsApi.mine().catch(() => [] as ApplicationListItemDTO[])
        : Promise.resolve(null as ApplicationListItemDTO[] | null)),
    ]).then(([e, deptsList, channels, prof, aps]) => {
      if (!e) {
        setError('员工不存在或无权查看');
        setEmp(null);
        return;
      }
      setEmp(e);
      setDepts(makeDeptName(deptsList));
      const fam = channels.find((c) => c.family === e.family);
      setFamilyName(fam?.name ?? e.family);
      setBand(fam?.grades.find((g) => g.grade === e.grade) ?? null);
      setProfile(prof);
      setApps(aps);
      setError(null);
    });
  }, [id, isSelf, meta]);

  if (error) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Alert type="warning" showIcon message={error} />
        <Link to="/app/roster">
          <Button style={{ marginTop: 16 }}>前往花名册</Button>
        </Link>
      </div>
    );
  }

  if (emp === undefined || depts === null) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  if (emp === null) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Alert
          type="warning"
          showIcon
          message="无法查看该员工档案"
          description="该员工不存在或你无权查看。请从花名册中选择可见员工。"
        />
        <Link to="/app/roster">
          <Button style={{ marginTop: 16 }}>前往花名册</Button>
        </Link>
      </div>
    );
  }

  const deptNameStr = depts(emp.dept_id);
  const yearsInGrade = yearsSince(emp.grade_since);
  const inFlightCert = apps?.find((a) => IN_FLIGHT_STATUSES.includes(a.status));
  const profileDims = profile ? new Map(profile.dimensions.map((d) => [d.dimension_key, d])) : null;

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <Link to="/app/roster">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 8, paddingLeft: 0 }}>
          返回花名册
        </Button>
      </Link>

      {/* 头部卡片 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'var(--clay-soft)',
              color: 'var(--clay-hover)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 24,
              fontWeight: 700,
              fontFamily: 'var(--font-serif)',
            }}
          >
            {emp.name.slice(0, 1)}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Space size={10} align="center" wrap>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>
                {emp.name}
              </span>
              <Tag style={{ borderRadius: 6 }}>{emp.employee_no}</Tag>
              {isSelf && (
                <Tag style={{ borderRadius: 6, background: 'var(--charcoal)', color: 'var(--paper)', borderColor: 'transparent' }}>
                  本人
                </Tag>
              )}
              {!emp.is_active && (
                <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', color: 'var(--ink-3)' }}>已离职</Tag>
              )}
            </Space>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 6 }}>
              {deptNameStr} · {emp.position} · {emp.family} 族（{familyName}）{emp.sequence} · {emp.grade}
            </div>
          </div>
          {band && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>所在职级带宽</div>
              <div className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {band.band_range} · ¥ {band.salary_band[0].toLocaleString()} ~{' '}
                {band.salary_band[1].toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                带宽为制度公开数据
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 关键指标 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>绩效等级</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{emp.perf_grade ?? '—'}</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>本职级年限</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
              {yearsInGrade !== null ? `${yearsInGrade} 年` : '—'}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>直属上级</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {emp.manager_name ?? '—'}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>学历</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {emp.education ?? '—'}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          {/* 基本信息与敏感字段 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title="基本信息"
            size="small"
          >
            <Descriptions
              column={2}
              size="small"
              labelStyle={{ color: 'var(--ink-3)', width: 110 }}
            >
              <Descriptions.Item label="姓名">{emp.name}</Descriptions.Item>
              <Descriptions.Item label="工号">
                <span className="num">{emp.employee_no}</span>
              </Descriptions.Item>
              <Descriptions.Item label="部门">{deptNameStr}</Descriptions.Item>
              <Descriptions.Item label="岗位">{emp.position}</Descriptions.Item>
              <Descriptions.Item label="职级">{emp.grade}</Descriptions.Item>
              <Descriptions.Item label="职族">{familyName}</Descriptions.Item>
              <Descriptions.Item label="序列">{emp.sequence}</Descriptions.Item>
              <Descriptions.Item label="本职级起">
                {emp.grade_since ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="绩效等级">{emp.perf_grade ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="直属上级">{emp.manager_name ?? '—'}</Descriptions.Item>
              {emp.certificates.length > 0 && (
                <Descriptions.Item label="已获认证" span={2}>
                  <Space size={4} wrap>
                    {emp.certificates.map((c, i) => (
                      <Tag key={i} style={{ borderRadius: 6, fontSize: 12, borderColor: 'var(--line)', background: 'var(--surface-sunken)', color: 'var(--ink-2)' }}>
                        {c}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 认证与发展动态 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="认证与发展动态"
            size="small"
          >
            {isSelf && inFlightCert ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent', width: 'fit-content' }}>
                  {inFlightCert.target_sequence} · 目标 {inFlightCert.target_grade}
                </Tag>
                <Progress percent={APPLICATION_STATUS_META[inFlightCert.status].step * 20} size="small" strokeColor="var(--ochre)" />
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  状态：{APPLICATION_STATUS_META[inFlightCert.status].label}
                  {inFlightCert.submitted_at ? ` · 提交于 ${inFlightCert.submitted_at.slice(0, 10)}` : ' · 草稿未提交'}
                </span>
                <Link to={`/app/cert-apply?app=${inFlightCert.id}`}>
                  <Button size="small" style={{ marginTop: 4 }}>
                    {inFlightCert.status === 'draft' ? '继续填写' : '查看进度'}
                  </Button>
                </Link>
              </Space>
            ) : isSelf && apps && apps.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                暂无认证记录，可前往「发起认证」开始你的晋升认证。
                <Link to="/app/cert-apply"><Button size="small" type="link">发起认证</Button></Link>
              </span>
            ) : !isSelf ? (
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                认证动态仅员工本人可见。HR 可在认证申请模块查看该员工的审批进度。
              </span>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                暂无进行中的认证或发展计划。
              </span>
            )}
          </Card>
        </Col>

        <Col span={10}>
          {/* 画像摘要 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="人才画像摘要"
            size="small"
            extra={
              meta?.seeFullProfile ? undefined : (
                <Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'transparent', background: 'var(--surface-sunken)', color: 'var(--ink-3)' }}>
                  摘要视图
                </Tag>
              )
            }
          >
            {profile && profileDims && profile.overall !== null ? (
              <div
                style={{
                  padding: '14px 16px',
                  background: 'var(--surface-sunken)',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  fontSize: 13,
                  lineHeight: 1.9,
                  color: 'var(--ink-2)',
                }}
              >
                <span className="ai-badge" style={{ marginRight: 8 }}>AI 画像</span>
                {emp.name} 综合评分 {profile.overall}，画像版本 v{profile.version_seq}（{profile.generated_at?.slice(0, 10)}）。
                {profileDims.get('perf')?.score !== undefined && ` 绩效维度 ${profileDims.get('perf')?.score ?? '—'} 分。`}
                {profileDims.get('duty')?.score !== undefined && ` 职责履行 ${profileDims.get('duty')?.score ?? '—'} 分。`}
              </div>
            ) : (
              <Empty
                description={
                  meta?.seeFullProfile || isSelf
                    ? '暂无画像数据，画像由 HR 按周期生成'
                    : '完整画像需要「完整画像」可见权限'
                }
                style={{ padding: 20 }}
              />
            )}
            {isSelf && (
              <Link to="/app/my-profile">
                <Button size="small" type="link" style={{ marginTop: 8 }}>查看我的完整画像 →</Button>
              </Link>
            )}
          </Card>

          {band && (
            <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="职级带宽" size="small">
              <Descriptions column={1} size="small" labelStyle={{ color: 'var(--ink-3)', width: 100 }}>
                <Descriptions.Item label="职级">{emp.grade} · {band.title}</Descriptions.Item>
                <Descriptions.Item label="带宽">{band.band_range}</Descriptions.Item>
                <Descriptions.Item label="薪资区间">
                  ¥ {band.salary_band[0].toLocaleString()} ~ {band.salary_band[1].toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="晋升条件">{band.promote_rule}</Descriptions.Item>
                {band.review_years && (
                  <Descriptions.Item label="复评周期">每 {band.review_years} 年复评</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
