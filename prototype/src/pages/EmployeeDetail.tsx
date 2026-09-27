import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Tag,
} from 'antd';
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import { employees as allEmployees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { bandOf, FAMILY_LABEL } from '@/mock/channels';
import { useAuth, useDataScope, useActiveRoleMeta } from '@/store/auth';
import { MaskedField } from '@/components/MaskedField';

const POTENTIAL_LABEL: Record<string, string> = {
  HIGH: '高潜',
  MID: '中潜',
  LOW: '待发展',
};

export function EmployeeDetail() {
  const [params] = useSearchParams();
  const persona = useAuth((s) => s.persona);
  const meta = useActiveRoleMeta();
  const scope = useDataScope();

  const id = params.get('id') ?? persona?.employeeId;
  const emp = useMemo(() => {
    if (!id) return undefined;
    const visible = scope(allEmployees);
    return visible.find((e) => e.id === id);
  }, [id, scope]);

  if (!emp) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Alert
          type="warning"
          showIcon
          message="无法查看该员工档案"
          description="该员工不在当前角色的数据范围内。请切换角色或从花名册中选择可见员工。"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        />
        <Link to="/app/roster">
          <Button style={{ marginTop: 16 }}>前往花名册</Button>
        </Link>
      </div>
    );
  }

  const band = bandOf(emp.family, emp.grade);
  const isSelf = persona?.employeeId === emp.id;

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
              <Tag style={{ borderRadius: 6 }}>{emp.id}</Tag>
              {isSelf && (
                <Tag style={{ borderRadius: 6, background: 'var(--charcoal)', color: 'var(--paper)', borderColor: 'transparent' }}>
                  本人
                </Tag>
              )}
              {emp.isCorePosition && (
                <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay-hover)', borderColor: 'transparent' }}>
                  核心岗位
                </Tag>
              )}
            </Space>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 6 }}>
              {deptName(emp.deptId)} · {emp.position} · {emp.family} 族（{FAMILY_LABEL[emp.family]}）{emp.sequence} · {emp.grade}
            </div>
            {emp.tags.length > 0 && (
              <Space size={4} wrap style={{ marginTop: 8 }}>
                {emp.tags.map((t) => (
                  <Tag key={t} style={{ borderRadius: 6, fontSize: 12, borderColor: 'var(--line)', background: 'var(--surface-sunken)', color: 'var(--ink-2)' }}>
                    {t}
                  </Tag>
                ))}
              </Space>
            )}
          </div>
          {band && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>所在职级带宽</div>
              <div className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {band.bandRange} · ¥ {band.salaryBand[0].toLocaleString()} ~{' '}
                {band.salaryBand[1].toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                带宽为制度公开数据 · 个人薪酬见下方
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 关键指标 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>2025 绩效</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{emp.perf}</span>
              <span className="num" style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                {emp.perfScore} 分
              </span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>潜力评估</div>
            <div style={{ marginTop: 4 }}>
              <Tag style={{ borderRadius: 6, background: emp.potential === 'HIGH' ? 'var(--sage-soft)' : 'var(--surface-sunken)', color: emp.potential === 'HIGH' ? 'var(--sage)' : 'var(--ink-2)', borderColor: 'transparent' }}>
                {POTENTIAL_LABEL[emp.potential]}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>九宫格定位</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: 'var(--teal)' }}>
              {emp.grid}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>司龄</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
              {emp.years} 年
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
                <span className="num">{emp.id}</span>
              </Descriptions.Item>
              <Descriptions.Item label="部门">{deptName(emp.deptId)}</Descriptions.Item>
              <Descriptions.Item label="岗位">{emp.position}</Descriptions.Item>
              <Descriptions.Item label="职级">{emp.grade}</Descriptions.Item>
              <Descriptions.Item label="司龄">{emp.years} 年</Descriptions.Item>
              <Descriptions.Item label="月薪">
                <MaskedField value={emp.salary} format={(v) => `¥ ${Number(v).toLocaleString()}`} />
              </Descriptions.Item>
              <Descriptions.Item label="薪酬带宽定位">
                {meta?.seeSalary && band ? (
                  (() => {
                    const [lo, hi] = band.salaryBand;
                    const pct = Math.min(100, Math.max(4, Math.round(((emp.salary - lo) / (hi - lo)) * 100)));
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 200 }}>
                        <Progress percent={pct} size="small" showInfo={false} strokeColor="var(--clay)" style={{ marginBottom: 0, width: 140 }} />
                        <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>P{Math.min(9, Math.max(1, Math.round(pct / 12.5)))}</span>
                      </span>
                    );
                  })()
                ) : (
                  <span style={{ color: 'var(--ink-4)' }}>
                    <LockOutlined style={{ marginRight: 4 }} />
                    需薪酬可见权限
                  </span>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 认证动态（剧本化） */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="认证与发展动态"
            size="small"
          >
            {emp.tags.includes('P4 认证中') ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent', width: 'fit-content' }}>
                  SW-P4 认证进行中 · 当前环节：履职举证
                </Tag>
                <Progress percent={45} size="small" strokeColor="var(--ochre)" />
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  已完成：基本条件校验、知识测验（86 分）；待完成：履职举证、评审答辩。
                </span>
              </Space>
            ) : emp.tags.includes('IDP 执行中') || emp.tags.includes('重点培养') ? (
              <Space direction="vertical" size={8}>
                <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>
                  IDP 个人发展计划执行中
                </Tag>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  当前季度 2 项发展行动进行中，详见「IDP 个人发展计划」（批次 5 交付）。
                </span>
              </Space>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                暂无进行中的认证或发展计划。认证主链路将于批次 3 交付。
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
                  <LockOutlined /> 摘要视图
                </Tag>
              )
            }
          >
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
              {meta?.seeFullProfile ? (
                <>
                  <span className="ai-badge" style={{ marginRight: 8 }}>AI 画像</span>
                  {emp.name}近两年绩效{emp.perf === 'S' || emp.perf === 'A' ? '持续优异' : '平稳'}，
                  潜力评级{POTENTIAL_LABEL[emp.potential]}；九宫格位于 {emp.grid} 区。
                  {emp.risk === 'HIGH'
                    ? '离职风险较高，建议管理者尽快安排保留面谈。'
                    : emp.risk === 'MID'
                      ? '存在一定流动性信号，建议纳入常规关注。'
                      : '稳定性良好。'}
                </>
              ) : (
                <span style={{ color: 'var(--ink-3)' }}>
                  完整画像（绩效趋势、能力结构、风险信号）需要「完整画像」可见权限。
                  {isSelf ? ' 你可以在「我的画像」（批次 3）中查看自己的完整七维画像。' : ''}
                </span>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              {['绩效趋势', '能力结构', '知识地图', '风险信号'].map((d) => (
                <Tag key={d} style={{ borderRadius: 6, fontSize: 12, borderColor: 'var(--line)', background: 'var(--surface-sunken)', color: 'var(--ink-3)' }}>
                  {d} · 批次 3
                </Tag>
              ))}
            </div>
          </Card>

          <Alert
            style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}
            type="info"
            showIcon
            message={
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                本页所有数据为虚拟剧本数据，用于验证角色掩码与数据范围。
              </span>
            }
          />
        </Col>
      </Row>
    </div>
  );
}
