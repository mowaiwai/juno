import { Button, Dropdown, Tag, message } from 'antd';
import { SwapOutlined, CheckOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '@/store/auth';
import { isBuiltinRole, resolveRoleMeta, SCOPE_LABEL } from '@/auth/rbac';

export function RoleSwitcher() {
  const persona = useAuth((s) => s.persona);
  const activeRole = useAuth((s) => s.activeRole);
  const switchRole = useAuth((s) => s.switchRole);

  if (!persona || !activeRole) return null;

  const items: MenuProps['items'] = persona.roleRefs.map((r) => {
    const meta = resolveRoleMeta(r.ref, persona.roleRefs);
    const active = activeRole === r.ref;
    return {
      key: r.ref,
      icon: active ? <CheckOutlined /> : <span style={{ width: 14 }} />,
      label: (
        <div>
          <div>
            {meta.label}视角
            {!isBuiltinRole(r.ref) && (
              <Tag
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  lineHeight: '16px',
                  borderRadius: 4,
                  background: 'var(--surface-sunken)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink-3)',
                }}
              >
                自定义
              </Tag>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {isBuiltinRole(r.ref)
              ? meta.description
              : `自定义角色 · 数据范围：${SCOPE_LABEL[meta.scope]}`}
          </div>
        </div>
      ),
    };
  });

  // 兜底：角色引用缺失时退回 roles（极端数据异常）
  const refs = persona.roleRefs.length > 0
    ? persona.roleRefs.map((r) => r.ref)
    : persona.roles.map((r) => r as string);
  const multi = refs.length > 1;

  const activeLabel = resolveRoleMeta(activeRole, persona.roleRefs).label;

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [activeRole],
        onClick: ({ key }) => {
          if (key === activeRole) return;
          switchRole(key).catch(() => message.error('角色切换失败，已恢复原视角'));
        },
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
          {activeLabel}
        </Tag>
        {multi && <SwapOutlined style={{ color: 'var(--ink-3)' }} />}
      </Button>
    </Dropdown>
  );
}
