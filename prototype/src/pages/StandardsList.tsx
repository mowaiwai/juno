import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Empty, Segmented, Tag, message } from 'antd';
import { PlusOutlined, RightOutlined } from '@ant-design/icons';
import { standards } from '@/mock/standards';

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  生效: { bg: 'var(--sage-soft)', fg: 'var(--sage)' },
  评审中: { bg: 'var(--ochre-soft)', fg: 'var(--ochre)' },
  草稿: { bg: 'var(--surface-sunken)', fg: 'var(--ink-3)' },
};

export function StandardsList() {
  const [statusFilter, setStatusFilter] = useState<string>('全部');

  const list = useMemo(
    () =>
      standards.filter((s) => statusFilter === '全部' || s.status === statusFilter),
    [statusFilter],
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">任职资格标准库</h1>
          <div className="page-subtitle">
            5 个序列 · 标准 = 基本条件 + 履职要求 + 知识技能 + 能力素质 + 团队贡献
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => message.info('原型演示：AI 辅助生成新序列标准将在集成版提供')}
        >
          AI 辅助新建标准
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as string)}
          options={['全部', '生效', '评审中', '草稿']}
        />
      </div>

      {list.length === 0 ? (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="该状态下暂无标准" />
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          {list.map((s) => {
            const c = STATUS_COLOR[s.status];
            return (
              <Link key={s.id} to={`/app/standard-detail?std=${s.id}`}>
                <Card
                  variant="borderless"
                  hoverable
                  style={{ background: 'var(--surface)', height: '100%' }}
                  styles={{ body: { padding: 20 } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'var(--charcoal)',
                        color: 'var(--paper)',
                        display: 'grid',
                        placeItems: 'center',
                        fontFamily: 'var(--font-serif)',
                        fontSize: 16,
                        fontWeight: 700,
                      }}
                    >
                      {s.sequence}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 650, fontSize: 15 }}>
                        {s.sequenceName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {s.grades} 个职级 · {s.version}
                      </div>
                    </div>
                    <Tag
                      style={{
                        borderRadius: 6,
                        background: c.bg,
                        color: c.fg,
                        borderColor: 'transparent',
                      }}
                    >
                      {s.status}
                    </Tag>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 8,
                      margin: '16px 0',
                    }}
                  >
                    {[
                      { label: '履职项', value: s.duties },
                      { label: '知识点', value: s.knowledges },
                      { label: '能力项', value: s.abilities },
                      { label: '职级', value: s.grades },
                    ].map((m) => (
                      <div
                        key={m.label}
                        style={{
                          textAlign: 'center',
                          padding: '8px 0',
                          background: 'var(--surface-sunken)',
                          borderRadius: 10,
                        }}
                      >
                        <div className="num" style={{ fontWeight: 650, fontSize: 16 }}>
                          {m.value}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: 'var(--ink-3)',
                      fontSize: 12,
                    }}
                  >
                    <span>更新于 {s.updatedAt}</span>
                    <span style={{ color: 'var(--clay-hover)' }}>
                      查看详情 <RightOutlined style={{ fontSize: 10 }} />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginTop: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ai-badge">AI 协作</span>
          <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>
            标准条款由「方法论框架 + AI 扩展 + 人工评审」三方共建：HR 提供框架骨架，
            AI 依据岗位说明书与行业语料生成条款草案，委员会评审定稿后发布生效。
          </span>
        </div>
      </Card>
    </div>
  );
}
