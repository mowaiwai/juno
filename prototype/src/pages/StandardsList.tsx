import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Empty, Segmented, Spin, Tag, message } from 'antd';
import { PlusOutlined, RightOutlined } from '@ant-design/icons';
import { standards } from '@/mock/standards';
import { USE_MOCK } from '@/api/config';
import { standardsApi, type StandardSetDTO } from '@/api/standards';

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  生效: { bg: 'var(--sage-soft)', fg: 'var(--sage)' },
  评审中: { bg: 'var(--ochre-soft)', fg: 'var(--ochre)' },
  草稿: { bg: 'var(--surface-sunken)', fg: 'var(--ink-3)' },
};

const REAL_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

function MockStandardsList() {
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

function RealStandardsList() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sets, setSets] = useState<StandardSetDTO[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSets(null);
    setErrorMsg(null);
    standardsApi
      .list(statusFilter === 'all' ? undefined : { status: statusFilter })
      .then((rows) => {
        if (alive) setSets(rows);
      })
      .catch((e: { message?: string }) => {
        if (alive) {
          setSets([]);
          setErrorMsg(e.message ?? '标准集加载失败');
        }
      });
    return () => {
      alive = false;
    };
  }, [statusFilter]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">任职资格标准库</h1>
          <div className="page-subtitle">
            草稿 → 发布 · 已发布版本只读 · 认证申请提交时锁定整版标准快照
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as string)}
          options={[
            { label: '全部', value: 'all' },
            { label: '已发布', value: 'published' },
            { label: '草稿', value: 'draft' },
            { label: '已归档', value: 'archived' },
          ]}
        />
      </div>

      {errorMsg && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="无法加载标准集"
          description={errorMsg}
        />
      )}

      {sets === null ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin />
        </div>
      ) : sets.length === 0 ? (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="该状态下暂无标准集" />
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          {sets.map((s) => (
            <Link key={s.id} to={`/app/standard-detail?set=${s.id}`}>
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
                  {s.sequence.slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 650, fontSize: 15 }}>
                    {s.sequence} 序列 · 目标职级 {s.target_grade}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    版本 v{s.version} · {s.items.length} 个标准项
                  </div>
                </div>
                <Tag
                  style={{
                    borderRadius: 6,
                    background:
                      s.status === 'published'
                        ? 'var(--sage-soft)'
                        : 'var(--surface-sunken)',
                    color:
                      s.status === 'published' ? 'var(--sage)' : 'var(--ink-3)',
                    borderColor: 'transparent',
                  }}
                >
                  {REAL_STATUS_LABEL[s.status] ?? s.status}
                </Tag>
              </div>

              <div
                style={{
                  margin: '16px 0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {s.items.slice(0, 5).map((i) => (
                  <Tag
                    key={i.id}
                    style={{
                      borderRadius: 6,
                      borderColor: 'var(--line)',
                      background: 'var(--surface-sunken)',
                      color: 'var(--ink-2)',
                    }}
                  >
                    {i.code}
                  </Tag>
                ))}
                {s.items.length > 5 && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    +{s.items.length - 5} 项
                  </span>
                )}
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
                <span>
                  {s.published_at
                    ? `发布于 ${s.published_at.slice(0, 10)}`
                    : '尚未发布'}
                </span>
                <span style={{ color: 'var(--clay-hover)' }}>
                  查看详情 <RightOutlined style={{ fontSize: 10 }} />
                </span>
              </div>
            </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function StandardsList() {
  return USE_MOCK ? <MockStandardsList /> : <RealStandardsList />;
}
