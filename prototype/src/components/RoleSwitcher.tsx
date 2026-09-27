import { Button, Dropdown, Tag } from 'antd';
import { SwapOutlined, CheckOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '@/store/auth';
import { ROLE_META } from '@/auth/rbac';

export function RoleSwitcher() {
  const persona = useAuth((s) => s.persona);
  const activeRole = useAuth((s) => s.activeRole);
  const switchRole = useAuth((s) => s.switchRole);

  if (!persona || !activeRole) return null;

  const items: MenuProps['items'] = persona.roles.map((r) => ({
    key: r,
    icon: activeRole === r ? <CheckOutlined /> : <span style={{ width: 14 }} />,
    label: (
      <div>
        <div>{ROLE_META[r].label}视角</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {ROLE_META[r].description}
        </div>
      </div>
    ),
  }));

  const multi = persona.roles.length > 1;

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [activeRole],
        onClick: ({ key }) => switchRole(key as typeof activeRole),
      }}
      trigger={[multi ? 'click' : 'contextMenu']}
      placement="bottomRight"
    >
      <Button
        type="text"
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40 }}
      >
        <Tag
          color={multi ? 'var(--clay)' : 'default'}
          style={{
            margin: 0,
            borderRadius: 6,
            background: multi ? 'var(--clay-soft)' : 'var(--surface-sunken)',
            borderColor: multi ? 'var(--clay-soft)' : 'var(--line)',
            color: multi ? 'var(--clay-hover)' : 'var(--ink-2)',
          }}
        >
          {ROLE_META[activeRole].label}
        </Tag>
        {multi && <SwapOutlined style={{ color: 'var(--ink-3)' }} />}
      </Button>
    </Dropdown>
  );
}
