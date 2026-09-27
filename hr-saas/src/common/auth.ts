// Minimal MVP auth: employee login by employee_no -> JWT carrying
// { sub: employee_id, tenant_id, role, dept_id }.
// (Production would use real credentials; virtual tenant per ADR-0009.)
export interface JwtActor {
  sub: string;
  tenant_id: string;
  role: 'EMPLOYEE' | 'HR' | 'MANAGER' | 'EXEC';
  dept_id: string;
}
