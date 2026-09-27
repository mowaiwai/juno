import { Link } from 'react-router-dom';
import { Button, Card, Col, Progress, Row, Space, Tag } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { swP3Standard } from '@/mock/standards';

type Status = 'met' | 'partial' | 'gap';

const STATUS_ICON: Record<Status, React.ReactNode> = {
  met: <CheckCircleFilled style={{ color: 'var(--sage)' }} />,
  partial: <ExclamationCircleFilled style={{ color: 'var(--ochre)' }} />,
  gap: <CloseCircleFilled style={{ color: 'var(--danger)' }} />,
};

const STATUS_TEXT: Record<Status, string> = { met: '达标', partial: '进行中', gap: '有差距' };

/** 许星遥当前达标值（剧本数据，来源于认证举证 / 测评 / 绩效中心） */
const MY = {
  dutyLevels: [3, 3, 2, 1],
  knowledgeMastery: [3, 1, 3, 1],
  abilityLevels: [2, 2, 1],
  contributionPct: 60,
};

function Row_({
  status,
  name,
  required,
  mine,
  note,
}: {
  status: Status;
  name: string;
  required: string;
  mine: string;
  note?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
      <div style={{ paddingTop: 2 }}>{STATUS_ICON[status]}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {name}
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400, marginLeft: 10 }}>
            要求：{required} · 我：{mine}
          </span>
        </div>
        {note && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.8 }}>{note}</div>}
      </div>
      <Tag
        style={{
          borderRadius: 6,
          borderColor: 'transparent',
          fontSize: 11,
          background: status === 'met' ? 'var(--sage-soft)' : status === 'partial' ? 'var(--ochre-soft)' : 'var(--danger-soft)',
          color: status === 'met' ? 'var(--sage)' : status === 'partial' ? 'var(--ochre)' : 'var(--danger)',
        }}
      >
        {STATUS_TEXT[status]}
      </Tag>
    </div>
  );
}

export function MyGap() {
  const std = swP3Standard;

  const dutyStatus: Status[] = std.duties.map((duty, i) =>
    MY.dutyLevels[i] >= duty.level ? 'met' : MY.dutyLevels[i] === duty.level - 1 ? 'partial' : 'gap',
  );
  const knowStatus: Status[] = std.knowledges.map((k, i) =>
    MY.knowledgeMastery[i] >= k.mastery ? 'met' : MY.knowledgeMastery[i] === k.mastery - 1 ? 'partial' : 'gap',
  );
  const abilityStatus: Status[] = std.abilities.map((a, i) =>
    MY.abilityLevels[i] >= a.level ? 'met' : 'partial',
  );

  const totalItems = std.duties.length + std.knowledges.length + std.abilities.length + 1;
  const metCount =
    dutyStatus.filter((s) => s === 'met').length +
    knowStatus.filter((s) => s === 'met').length +
    abilityStatus.filter((s) => s === 'met').length;
  const overall = Math.round(((metCount + 0.6) / totalItems) * 100);

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的差距</h1>
          <div className="page-subtitle">
            对照 {std.sequence}-{std.grade} 标准 {std.version} · 达标值来源于认证举证 / 测评 / 绩效中心
          </div>
        </div>
        <Link to="/app/standard-detail?std=std_sw">
          <Button>查看标准全文</Button>
        </Link>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          {/* 履职标准 */}
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="履职标准（四级举证）">
            {std.duties.map((duty, i) => (
              <Row_ key={duty.name} status={dutyStatus[i]} name={duty.name} required={`L${duty.level}`} mine={`L${MY.dutyLevels[i]}`} note={`${duty.task} · 达标线：${duty.standard}`} />
            ))}
          </Card>

          {/* 知识技能 */}
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="知识技能（掌握层级）">
            {std.knowledges.map((k, i) => (
              <Row_
                key={k.name}
                status={knowStatus[i]}
                name={k.name}
                required={`M${k.mastery}`}
                mine={`M${MY.knowledgeMastery[i]}`}
                note={
                  knowStatus[i] === 'met'
                    ? `考试方式：${k.examMode}`
                    : `有差距 · 已关联 IDP「${k.name}进阶」行动，考试方式：${k.examMode}`
                }
              />
            ))}
          </Card>

          {/* 能力素质 + 团队贡献 */}
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="能力素质与团队贡献">
            {std.abilities.map((a, i) => (
              <Row_
                key={a.name}
                status={abilityStatus[i]}
                name={a.name}
                required={`L${a.level}`}
                mine={`L${MY.abilityLevels[i]}`}
                note={`关键行为：${a.behavior}`}
              />
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <ExclamationCircleFilled style={{ color: 'var(--ochre)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>团队贡献</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                  {std.contribution} · 带教进行中（60%）
                </div>
              </div>
              <Tag style={{ borderRadius: 6, borderColor: 'transparent', fontSize: 11, background: 'var(--ochre-soft)', color: 'var(--ochre)' }}>进行中</Tag>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          {/* 总体达标度 */}
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16, textAlign: 'center' }} title="P3 标准达标度">
            <Progress type="circle" percent={overall} size={130} strokeColor="var(--clay)" />
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
              达标 {metCount} / {totalItems} 项 · 进行中 2 项
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.9 }}>
              基本条件与业绩条件均已达标（近一年 B）；两项差距均已路由到对应动作。
            </div>
          </Card>

          {/* 差距路由 */}
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="差距 → 动作路由" size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  <Tag style={{ borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent', fontSize: 11 }}>补知识</Tag>
                  分布式系统基础 M1→M2
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>已进入 IDP · 学习行动 10 月到期</div>
                <Link to="/app/idp"><Button size="small" style={{ marginTop: 8 }}>查看 IDP</Button></Link>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent', fontSize: 11 }}>做贡献</Tag>
                  技术改进举证未归档
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>P4 认证第 4 项举证待提交 · 截止 10-15</div>
                <Link to="/app/cert-apply"><Button size="small" style={{ marginTop: 8 }}>去举证</Button></Link>
              </div>
            </Space>
          </Card>

          {/* 迈向 P4 */}
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="迈向 P4" size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
              P4 晋升条件：通过 P4 标准认证 + 答辩；近两年绩效 A 以上 1 次。
              <br />
              你的 2024 年为 A、2025 年为 B —— 业绩条件已满足，当前处于履职举证环节。
            </div>
            <Link to="/app/cert-apply">
              <Button type="primary" block style={{ marginTop: 10, background: 'var(--charcoal)' }}>进入认证举证</Button>
            </Link>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
