import { Card, Collapse, Space, Tabs, Tag, Typography, Alert } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { channels, FAMILY_LABEL } from '@/mock/channels';
import type { ChannelFamily, GradeBand } from '@/mock/channels';
import { useAuth } from '@/store/auth';
import { employeeById } from '@/mock/people';
import type { Family } from '@/types';

function GradeCard({
  grade,
  isMine,
}: {
  grade: GradeBand;
  isMine: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${isMine ? 'var(--clay)' : 'var(--line)'}`,
        background: isMine ? 'var(--clay-soft)' : 'var(--surface)',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: isMine ? 'var(--shadow-card)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          className="num"
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: 'var(--font-serif)',
            color: isMine ? 'var(--clay-hover)' : 'var(--ink)',
          }}
        >
          {grade.grade}
        </span>
        <span style={{ color: 'var(--ink-2)' }}>{grade.title}</span>
        {isMine && (
          <Tag style={{ borderRadius: 6, marginLeft: 'auto', background: 'var(--charcoal)', color: 'var(--paper)', borderColor: 'transparent' }}>
            我的职级
          </Tag>
        )}
      </div>
      <div
        className="num"
        style={{ fontSize: 12, color: 'var(--ink-3)', margin: '8px 0 2px' }}
      >
        {grade.bandRange}
      </div>
      <div className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
        ¥ {grade.salaryBand[0].toLocaleString()} ~{' '}
        {grade.salaryBand[1].toLocaleString()} / 月
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
        {grade.promoteRule}
      </div>
      {grade.reviewYears && (
        <div style={{ marginTop: 10 }}>
          <Tag icon={<SyncOutlined />} style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
            每 {grade.reviewYears} 年复评认证
          </Tag>
        </div>
      )}
    </div>
  );
}

function FamilyPanel({ ch, myFamily, myGrade }: { ch: ChannelFamily; myFamily: Family; myGrade: string }) {
  return (
    <div>
      <div style={{ marginBottom: 16, color: 'var(--ink-2)', fontSize: 13 }}>
        {ch.desc}
        <Space size={4} wrap style={{ marginLeft: 12 }}>
          {ch.sequences.map((s) => (
            <Tag key={s} style={{ borderRadius: 6, background: 'var(--surface-sunken)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
              {s}
            </Tag>
          ))}
        </Space>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${ch.grades.length}, minmax(0, 1fr))`,
          gap: 12,
        }}
      >
        {[...ch.grades].reverse().map((g) => (
          <GradeCard
            key={g.grade}
            grade={g}
            isMine={ch.family === myFamily && g.grade === myGrade}
          />
        ))}
      </div>
    </div>
  );
}

export function Channels() {
  const persona = useAuth((s) => s.persona);
  const self = employeeById(persona?.employeeId);
  const myFamily = self?.family;
  const myGrade = self?.grade;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">职级通道</h1>
          <div className="page-subtitle">
            五大职族 × 职级 × 薪级带宽 · 专业/管理双通道同酬对应 · 高阶职级实行周期复评
          </div>
        </div>
        {self && myFamily && (
          <Tag style={{ borderRadius: 8, padding: '4px 12px', borderColor: 'var(--clay-soft)', background: 'var(--clay-soft)', color: 'var(--clay-hover)' }}>
            {persona?.name} · {myFamily} 族 {myGrade}
          </Tag>
        )}
      </div>

      <Alert
        type="info"
        showIcon
        style={{
          marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
        }}
        message={
          <span>
            <span className="ai-badge" style={{ marginRight: 8 }}>AI 建议</span>
            你的职级所在的带宽与近年调薪记录，可在「我的通道」（批次 3）中查看个人定位与晋升路径模拟。
          </span>
        }
      />

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Tabs
          defaultActiveKey={myFamily ?? 'P'}
          items={channels.map((ch) => ({
            key: ch.family,
            label: `${ch.family} · ${FAMILY_LABEL[ch.family]}`,
            children: (
              <FamilyPanel
                ch={ch}
                myFamily={(myFamily ?? 'P') as Family}
                myGrade={myGrade ?? ''}
              />
            ),
          }))}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <Collapse
          items={[
            {
              key: 'rules',
              label: <span style={{ fontWeight: 600 }}>通道与薪级对接规则（制度摘要）</span>,
              children: (
                <Typography.Paragraph style={{ color: 'var(--ink-2)', fontSize: 13, marginBottom: 0 }}>
                  1. 各职级对应薪级带宽，带宽内按「薪级 × 薪档」定薪，宽带薪酬允许同级差异达 ±30%。
                  <br />
                  2. 晋升必须通过对应职级的任职资格标准认证（履职举证 + 知识测验 + 评审/答辩）。
                  <br />
                  3. P4/P5 实行三年复评：到期未通过复评者转入观察期，连续两次未通过则职级下探。
                  <br />
                  4. 专业族与管理族同职级同带宽，M2 对标 P4、M3 对标 P5，允许专业骨干转管理或双向回流。
                </Typography.Paragraph>
              ),
            },
          ]}
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }}
        />
      </div>
    </div>
  );
}
