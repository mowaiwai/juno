import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Empty, Space, Tabs, Tag } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { noticesOf, type NoticeItem } from '@/mock/notifications';

const LEVEL_MAP: Record<string, { color: string; bg: string; label: string }> = {
  urgent: { color: 'var(--clay-hover)', bg: 'var(--clay-soft)', label: '紧急' },
  normal: { color: 'var(--ochre)', bg: 'var(--ochre-soft)', label: '常规' },
  info: { color: 'var(--ink-3)', bg: 'var(--surface-sunken)', label: '通知' },
};

function NoticeRow({ item, onDone }: { item: NoticeItem; onDone?: () => void }) {
  const lv = LEVEL_MAP[item.level];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: item.kind === 'todo' && item.level === 'urgent' ? 'var(--clay-soft)' : 'var(--surface-sunken)',
        opacity: item.doneAt ? 0.62 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size={8}>
          {item.kind === 'todo' ? (
            <Badge status={item.doneAt ? 'default' : item.level === 'urgent' ? 'error' : 'processing'} />
          ) : (
            <BellOutlined style={{ color: 'var(--ink-4)', fontSize: 12 }} />
          )}
          <span style={{ fontSize: 13.5, fontWeight: 600, textDecoration: item.doneAt ? 'line-through' : 'none' }}>{item.title}</span>
          {item.kind === 'todo' && <Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'transparent', background: lv.bg, color: lv.color }}>{lv.label}</Tag>}
        </Space>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.8 }}>{item.desc}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{item.doneAt ?? item.time}</div>
        <Space size={6} style={{ marginTop: 6 }}>
          {item.link && !item.doneAt && (
            <Link to={item.link}>
              <Button size="small" type={item.kind === 'todo' ? 'primary' : 'default'} style={item.kind === 'todo' ? { background: 'var(--charcoal)' } : undefined}>
                {item.linkLabel ?? '查看'}
              </Button>
            </Link>
          )}
          {onDone && !item.doneAt && (
            <Button size="small" icon={<CheckOutlined />} onClick={onDone} title="标记完成" />
          )}
        </Space>
      </div>
    </div>
  );
}

export function Notifications() {
  const persona = useAuth((s) => s.persona);
  const [doneIds, setDoneIds] = useState<string[]>([]);

  const all = persona ? noticesOf(persona.id) : [];
  const isDone = (n: NoticeItem) => n.doneAt || doneIds.includes(n.id);

  const todos = all.filter((n) => n.kind === 'todo' && !isDone(n));
  const msgs = all.filter((n) => n.kind === 'msg');
  const dones = all.filter((n) => n.kind === 'todo' && isDone(n));

  const markDone = (id: string) => setDoneIds((p) => [...p, id]);

  const renderItem = (n: NoticeItem, done?: boolean) => (
    <NoticeRow key={n.id} item={n} onDone={done ? undefined : n.kind === 'todo' ? () => markDone(n.id) : undefined} />
  );

  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">待办消息中心</h1>
          <div className="page-subtitle">
            {persona?.name} · 按角色与数据范围投递 · 认证、盘点、调薪等流程节点自动生成待办
          </div>
        </div>
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Tabs
          defaultActiveKey="todo"
          items={[
            {
              key: 'todo',
              label: `待办（${todos.length}）`,
              children: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {todos.map((n) => renderItem(n))}
                  {todos.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="太棒了，暂无待办" />}
                </Space>
              ),
            },
            {
              key: 'msg',
              label: `通知（${msgs.length}）`,
              children: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {msgs.map((n) => renderItem(n, true))}
                </Space>
              ),
            },
            {
              key: 'done',
              label: `已办（${dones.length}）`,
              children: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {dones.map((n) => renderItem(n, true))}
                  {dones.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已办结事项" />}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
