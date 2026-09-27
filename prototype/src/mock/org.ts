import type { Department, Position } from '@/types';

export const TENANT = {
  id: 't_huali',
  name: '华砺精工股份有限公司',
  short: '华砺精工',
  industry: '高端装备制造',
  size: 650,
};

export const departments: Department[] = [
  { id: '100', parentId: '0', name: '华砺精工', type: 'biz' },
  { id: '200', parentId: '100', name: '职能中心', type: 'func' },
  { id: '201', parentId: '200', name: '人力资源部', type: 'func', managerId: 'E10002' },
  { id: '202', parentId: '200', name: '财务部', type: 'func', managerId: 'E10003' },
  { id: '203', parentId: '200', name: '综合管理部', type: 'func', managerId: 'E10004' },
  { id: '300', parentId: '100', name: '研发中心', type: 'tech', managerId: 'E10010' },
  { id: '305', parentId: '300', name: '软件研发部', type: 'tech', managerId: 'E10020' },
  { id: '306', parentId: '300', name: '机械设计部', type: 'tech', managerId: 'E10030' },
  { id: '307', parentId: '300', name: '工艺工程部', type: 'tech', managerId: 'E10040' },
  { id: '400', parentId: '100', name: '制造中心', type: 'biz', managerId: 'E10050' },
  { id: '401', parentId: '400', name: '机加车间', type: 'biz', managerId: 'E10051' },
  { id: '402', parentId: '400', name: '装配车间', type: 'biz', managerId: 'E10052' },
  { id: '403', parentId: '400', name: '质量部', type: 'tech', managerId: 'E10053' },
  { id: '500', parentId: '100', name: '供应链中心', type: 'func', managerId: 'E10060' },
  { id: '501', parentId: '500', name: '采购部', type: 'func', managerId: 'E10061' },
  { id: '502', parentId: '500', name: '仓储物流部', type: 'func', managerId: 'E10062' },
  { id: '600', parentId: '100', name: '营销中心', type: 'biz', managerId: 'E10070' },
  { id: '601', parentId: '600', name: '销售部', type: 'biz', managerId: 'E10071' },
  { id: '602', parentId: '600', name: '市场部', type: 'biz', managerId: 'E10072' },
];

export const positions: Position[] = [
  { id: 'p001', name: '首席执行官', deptId: '100', family: 'M', sequence: 'MGT', grade: 'M5', isCore: true, headcount: 1 },
  { id: 'p002', name: '研发总监', deptId: '300', family: 'M', sequence: 'MGT', grade: 'M4', isCore: true, headcount: 1 },
  { id: 'p003', name: '软件研发经理', deptId: '305', family: 'M', sequence: 'MGT', grade: 'M2', isCore: true, headcount: 1 },
  { id: 'p004', name: '高级软件工程师', deptId: '305', family: 'P', sequence: 'SW', grade: 'P4', isCore: true, headcount: 4 },
  { id: 'p005', name: '软件工程师', deptId: '305', family: 'P', sequence: 'SW', grade: 'P3', isCore: false, headcount: 9 },
  { id: 'p006', name: '初级软件工程师', deptId: '305', family: 'P', sequence: 'SW', grade: 'P2', isCore: false, headcount: 6 },
  { id: 'p007', name: '机械设计经理', deptId: '306', family: 'M', sequence: 'MGT', grade: 'M2', isCore: true, headcount: 1 },
  { id: 'p008', name: '高级机械工程师', deptId: '306', family: 'P', sequence: 'ENG', grade: 'P4', isCore: true, headcount: 3 },
  { id: 'p009', name: '机械工程师', deptId: '306', family: 'P', sequence: 'ENG', grade: 'P3', isCore: false, headcount: 7 },
  { id: 'p010', name: '工艺工程师', deptId: '307', family: 'T', sequence: 'OP', grade: 'T3', isCore: false, headcount: 5 },
  { id: 'p011', name: '高级工艺工程师', deptId: '307', family: 'T', sequence: 'OP', grade: 'T4', isCore: true, headcount: 2 },
  { id: 'p012', name: '制造总监', deptId: '400', family: 'M', sequence: 'MGT', grade: 'M4', isCore: true, headcount: 1 },
  { id: 'p013', name: '车间主任', deptId: '401', family: 'M', sequence: 'MGT', grade: 'M2', isCore: true, headcount: 1 },
  { id: 'p014', name: '质量工程师', deptId: '403', family: 'T', sequence: 'OP', grade: 'T3', isCore: false, headcount: 4 },
  { id: 'p015', name: '供应链总监', deptId: '500', family: 'M', sequence: 'MGT', grade: 'M3', isCore: true, headcount: 1 },
  { id: 'p016', name: '采购主管', deptId: '501', family: 'O', sequence: 'PUR', grade: 'O3', isCore: false, headcount: 2 },
  { id: 'p017', name: '营销总监', deptId: '600', family: 'M', sequence: 'MGT', grade: 'M3', isCore: true, headcount: 1 },
  { id: 'p018', name: '大客户经理', deptId: '601', family: 'S', sequence: 'SAL', grade: 'S3', isCore: true, headcount: 5 },
  { id: 'p019', name: 'HRD', deptId: '201', family: 'M', sequence: 'MGT', grade: 'M3', isCore: true, headcount: 1 },
  { id: 'p020', name: 'HRBP', deptId: '201', family: 'O', sequence: 'HR', grade: 'O3', isCore: false, headcount: 3 },
  { id: 'p021', name: 'IT 运维专员', deptId: '203', family: 'O', sequence: 'OPS', grade: 'O3', isCore: false, headcount: 2 },
  { id: 'p022', name: '数控技师', deptId: '401', family: 'T', sequence: 'OP', grade: 'T3', isCore: false, headcount: 12 },
  { id: 'p023', name: '高级数控技师', deptId: '401', family: 'T', sequence: 'OP', grade: 'T4', isCore: true, headcount: 5 },
  { id: 'p024', name: '装配技师', deptId: '402', family: 'T', sequence: 'OP', grade: 'T2', isCore: false, headcount: 18 },
];

export function deptName(id: string): string {
  return departments.find((d) => d.id === id)?.name ?? id;
}

/** 返回部门子树（含自身）全部部门 id */
export function subtreeDeptIds(rootId: string): string[] {
  const result = [rootId];
  let frontier = [rootId];
  while (frontier.length) {
    const next: string[] = [];
    for (const pid of frontier) {
      for (const d of departments) {
        if (d.parentId === pid) next.push(d.id);
      }
    }
    result.push(...next);
    frontier = next;
  }
  return result;
}
