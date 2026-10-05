import type { ReactNode } from 'react';
import { useAuth } from '@/store/auth';
import type { RoleCode } from '@/types';

interface CanProps {
  /** 允许访问的角色 ref（任一命中即可，支持 custom: 角色） */
  roles: RoleCode[];
  children: ReactNode;
  fallback?: ReactNode;
}

/** 权限原语：按激活角色控制元素（按钮/区块）可见性 */
export function Can({ roles, children, fallback = null }: CanProps) {
  const activeRole = useAuth((s) => s.activeRole);
  if (!activeRole || !roles.includes(activeRole as RoleCode)) return <>{fallback}</>;
  return <>{children}</>;
}
