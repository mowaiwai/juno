// Tenant context helpers. MVP: tenant resolved from X-Tenant-Id header,
// defaulting to the seeded virtual tenant.
export const DEFAULT_TENANT_CODE = 'DEMO';

export function resolveTenantId(headers: Record<string, any>, fallbackTenantId: string): string {
  const h = headers['x-tenant-id'];
  return (Array.isArray(h) ? h[0] : h) || fallbackTenantId;
}

// Actor = who is operating (for audit). MVP: X-Employee-Id header.
export function resolveActorId(headers: Record<string, any>): string {
  const h = headers['x-employee-id'];
  return (Array.isArray(h) ? h[0] : h) || 'system';
}
