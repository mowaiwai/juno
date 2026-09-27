import type { Employee, Persona } from '@/types';

export const employees: Employee[] = [
  // ---- 高管 / 中心负责人 ----
  { id: 'E10001', name: '沈既明', deptId: '100', position: '首席执行官', family: 'M', sequence: 'MGT', grade: 'M5', years: 12, perf: 'S', perfScore: 96, potential: 'HIGH', grid: '9A1', salary: 120000, isCorePosition: true, risk: 'LOW', tags: ['一把手'] },
  { id: 'E10010', name: '江予安', deptId: '300', position: '研发总监', family: 'M', sequence: 'MGT', grade: 'M4', years: 10, perf: 'A', perfScore: 91, potential: 'HIGH', grid: '9A1', salary: 78000, isCorePosition: true, risk: 'MID', tags: ['核心人才', '外部机会多'] },
  { id: 'E10050', name: '岑屿', deptId: '400', position: '制造总监', family: 'M', sequence: 'MGT', grade: 'M4', years: 15, perf: 'B', perfScore: 84, potential: 'MID', grid: '9B2', salary: 70000, isCorePosition: true, risk: 'LOW', tags: ['老黄牛'] },
  { id: 'E10060', name: '苏见微', deptId: '500', position: '供应链总监', family: 'M', sequence: 'MGT', grade: 'M3', years: 9, perf: 'A', perfScore: 89, potential: 'MID', grid: '9A2', salary: 56000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10070', name: '温既白', deptId: '600', position: '营销总监', family: 'M', sequence: 'MGT', grade: 'M3', years: 8, perf: 'S', perfScore: 97, potential: 'HIGH', grid: '9A1', salary: 62000, isCorePosition: true, risk: 'LOW', tags: ['核心人才'] },
  { id: 'E10002', name: '温晚晴', deptId: '201', position: 'HRD', family: 'M', sequence: 'MGT', grade: 'M3', years: 11, perf: 'A', perfScore: 90, potential: 'HIGH', grid: '9A1', salary: 52000, isCorePosition: true, risk: 'LOW', tags: ['管委会成员'] },
  { id: 'E10003', name: '简时', deptId: '202', position: '财务总监', family: 'M', sequence: 'MGT', grade: 'M3', years: 13, perf: 'B', perfScore: 85, potential: 'MID', grid: '9B2', salary: 50000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10004', name: '林知秋', deptId: '203', position: '综合管理经理', family: 'M', sequence: 'MGT', grade: 'M2', years: 7, perf: 'B', perfScore: 83, potential: 'MID', grid: '9B2', salary: 32000, isCorePosition: false, risk: 'LOW', tags: [] },

  // ---- 部门经理 ----
  { id: 'E10020', name: '陆行舟', deptId: '305', position: '软件研发经理', family: 'M', sequence: 'MGT', grade: 'M2', years: 9, perf: 'A', perfScore: 90, potential: 'MID', grid: '9A2', salary: 55000, isCorePosition: true, risk: 'LOW', tags: ['认证小组成员'] },
  { id: 'E10030', name: '谢星野', deptId: '306', position: '机械设计经理', family: 'M', sequence: 'MGT', grade: 'M2', years: 8, perf: 'B', perfScore: 84, potential: 'MID', grid: '9B2', salary: 48000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10040', name: '韩朔', deptId: '307', position: '工艺工程经理', family: 'M', sequence: 'MGT', grade: 'M2', years: 7, perf: 'B', perfScore: 82, potential: 'MID', grid: '9B2', salary: 45000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10051', name: '唐雨时', deptId: '401', position: '机加车间主任', family: 'M', sequence: 'MGT', grade: 'M2', years: 16, perf: 'B', perfScore: 83, potential: 'LOW', grid: '9B3', salary: 40000, isCorePosition: true, risk: 'LOW', tags: ['老师傅'] },
  { id: 'E10052', name: '何栖迟', deptId: '402', position: '装配车间主任', family: 'M', sequence: 'MGT', grade: 'M2', years: 12, perf: 'A', perfScore: 88, potential: 'MID', grid: '9A2', salary: 38000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10053', name: '冯柚', deptId: '403', position: '质量经理', family: 'M', sequence: 'MGT', grade: 'M2', years: 8, perf: 'A', perfScore: 87, potential: 'HIGH', grid: '9A1', salary: 42000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10061', name: '袁汀', deptId: '501', position: '采购主管', family: 'O', sequence: 'PUR', grade: 'O3', years: 6, perf: 'B', perfScore: 84, potential: 'MID', grid: '9B2', salary: 26000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10062', name: '范屿青', deptId: '502', position: '仓储主管', family: 'O', sequence: 'PUR', grade: 'O3', years: 5, perf: 'C', perfScore: 76, potential: 'LOW', grid: '9C3', salary: 22000, isCorePosition: false, risk: 'MID', tags: ['绩效待改进'] },
  { id: 'E10071', name: '江望舒', deptId: '601', position: '销售经理', family: 'M', sequence: 'MGT', grade: 'M2', years: 7, perf: 'A', perfScore: 90, potential: 'HIGH', grid: '9A1', salary: 45000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10072', name: '郑予望', deptId: '602', position: '市场经理', family: 'O', sequence: 'SAL', grade: 'O3', years: 6, perf: 'B', perfScore: 85, potential: 'MID', grid: '9B2', salary: 30000, isCorePosition: false, risk: 'LOW', tags: [] },

  // ---- 软件研发部（哑铃型：新人多、中坚少） ----
  { id: 'E10087', name: '顾屿白', deptId: '305', position: '高级软件工程师', family: 'P', sequence: 'SW', grade: 'P4', years: 7, perf: 'A', perfScore: 92, potential: 'HIGH', grid: '9A1', salary: 36000, isCorePosition: true, risk: 'LOW', tags: ['重点培养', 'B 角'] },
  { id: 'E10088', name: '彭清樾', deptId: '305', position: '高级软件工程师', family: 'P', sequence: 'SW', grade: 'P4', years: 8, perf: 'A', perfScore: 89, potential: 'LOW', grid: '9A3', salary: 34000, isCorePosition: true, risk: 'LOW', tags: ['留用激励'] },
  { id: 'E10086', name: '许云清', deptId: '305', position: '软件工程师', family: 'P', sequence: 'SW', grade: 'P3', years: 4, perf: 'B', perfScore: 84, potential: 'HIGH', grid: '9B1', salary: 23000, isCorePosition: false, risk: 'LOW', tags: ['P4 认证中', 'IDP 执行中'] },
  { id: 'E10092', name: '温以宁', deptId: '305', position: '软件工程师', family: 'P', sequence: 'SW', grade: 'P3', years: 5, perf: 'S', perfScore: 96, potential: 'HIGH', grid: '9A1', salary: 27000, isCorePosition: false, risk: 'MID', tags: ['明星员工'] },
  { id: 'E10093', name: '董斯年', deptId: '305', position: '软件工程师', family: 'P', sequence: 'SW', grade: 'P3', years: 6, perf: 'C', perfScore: 74, potential: 'LOW', grid: '9C3', salary: 20000, isCorePosition: false, risk: 'HIGH', tags: ['绩效改进', '离职风险'] },
  { id: 'E10089', name: '曹沐辰', deptId: '305', position: '初级软件工程师', family: 'P', sequence: 'SW', grade: 'P2', years: 2, perf: 'C', perfScore: 75, potential: 'MID', grid: '9C2', salary: 14000, isCorePosition: false, risk: 'MID', tags: ['补知识'] },
  { id: 'E10091', name: '许清禾', deptId: '305', position: '初级软件工程师', family: 'P', sequence: 'SW', grade: 'P2', years: 1, perf: 'B', perfScore: 83, potential: 'HIGH', grid: '9B1', salary: 15000, isCorePosition: false, risk: 'LOW', tags: ['新人'] },
  { id: 'E10094', name: '许言蹊', deptId: '305', position: '初级软件工程师', family: 'P', sequence: 'SW', grade: 'P2', years: 2, perf: 'A', perfScore: 88, potential: 'HIGH', grid: '9A1', salary: 16000, isCorePosition: false, risk: 'LOW', tags: ['梯队候选'] },

  // ---- 机械设计部 ----
  { id: 'E10101', name: '沈鹿溪', deptId: '306', position: '高级机械工程师', family: 'P', sequence: 'ENG', grade: 'P4', years: 9, perf: 'S', perfScore: 97, potential: 'HIGH', grid: '9A1', salary: 38000, isCorePosition: true, risk: 'MID', tags: ['核心人才', '继任候选'] },
  { id: 'E10102', name: '贺知行', deptId: '306', position: '高级机械工程师', family: 'P', sequence: 'ENG', grade: 'P4', years: 10, perf: 'B', perfScore: 82, potential: 'LOW', grid: '9B3', salary: 33000, isCorePosition: true, risk: 'LOW', tags: [] },
  { id: 'E10104', name: '汪漾', deptId: '306', position: '机械工程师', family: 'P', sequence: 'ENG', grade: 'P3', years: 4, perf: 'A', perfScore: 89, potential: 'HIGH', grid: '9A1', salary: 26000, isCorePosition: false, risk: 'MID', tags: ['B 角'] },
  { id: 'E10103', name: '田禾', deptId: '306', position: '机械工程师', family: 'P', sequence: 'ENG', grade: 'P3', years: 3, perf: 'B', perfScore: 84, potential: 'MID', grid: '9B2', salary: 24000, isCorePosition: false, risk: 'LOW', tags: [] },

  // ---- 工艺 / 制造 / 质量（菱形结构：T3-T4 为主） ----
  { id: 'E10111', name: '林听澜', deptId: '307', position: '高级工艺工程师', family: 'T', sequence: 'OP', grade: 'T4', years: 8, perf: 'A', perfScore: 90, potential: 'HIGH', grid: '9A1', salary: 31000, isCorePosition: true, risk: 'LOW', tags: ['继任候选'] },
  { id: 'E10112', name: '简宁', deptId: '307', position: '工艺工程师', family: 'T', sequence: 'OP', grade: 'T3', years: 4, perf: 'B', perfScore: 85, potential: 'MID', grid: '9B2', salary: 21000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10121', name: '时樾', deptId: '401', position: '高级数控技师', family: 'T', sequence: 'OP', grade: 'T4', years: 10, perf: 'B', perfScore: 84, potential: 'MID', grid: '9B2', salary: 30000, isCorePosition: true, risk: 'LOW', tags: ['AB 角'] },
  { id: 'E10122', name: '潘临', deptId: '401', position: '数控技师', family: 'T', sequence: 'OP', grade: 'T3', years: 5, perf: 'B', perfScore: 82, potential: 'LOW', grid: '9B3', salary: 19000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10123', name: '宋知柚', deptId: '401', position: '数控技师', family: 'T', sequence: 'OP', grade: 'T3', years: 6, perf: 'A', perfScore: 88, potential: 'MID', grid: '9A2', salary: 22000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10131', name: '阮清', deptId: '402', position: '装配技师', family: 'T', sequence: 'OP', grade: 'T2', years: 3, perf: 'B', perfScore: 83, potential: 'MID', grid: '9B2', salary: 12000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10132', name: '余行之', deptId: '402', position: '装配技师', family: 'T', sequence: 'OP', grade: 'T2', years: 4, perf: 'C', perfScore: 74, potential: 'LOW', grid: '9C3', salary: 11000, isCorePosition: false, risk: 'HIGH', tags: ['过程监督'] },
  { id: 'E10141', name: '江悦', deptId: '403', position: '质量工程师', family: 'T', sequence: 'OP', grade: 'T3', years: 5, perf: 'A', perfScore: 89, potential: 'HIGH', grid: '9A1', salary: 23000, isCorePosition: false, risk: 'LOW', tags: [] },

  // ---- 采购 / 销售 / HR / IT ----
  { id: 'E10151', name: '朱沐晴', deptId: '501', position: '采购专员', family: 'O', sequence: 'PUR', grade: 'O3', years: 4, perf: 'B', perfScore: 84, potential: 'MID', grid: '9B2', salary: 18000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10161', name: '秦越', deptId: '601', position: '大客户经理', family: 'S', sequence: 'SAL', grade: 'S3', years: 7, perf: 'S', perfScore: 98, potential: 'HIGH', grid: '9A1', salary: 40000, isCorePosition: true, risk: 'LOW', tags: ['销冠', '核心人才'] },
  { id: 'E10162', name: '白溪', deptId: '601', position: '大客户经理', family: 'S', sequence: 'SAL', grade: 'S3', years: 5, perf: 'B', perfScore: 85, potential: 'MID', grid: '9B2', salary: 28000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10171', name: '孟星辞', deptId: '201', position: 'HRBP', family: 'O', sequence: 'HR', grade: 'O3', years: 3, perf: 'B', perfScore: 84, potential: 'MID', grid: '9B2', salary: 17000, isCorePosition: false, risk: 'LOW', tags: [] },
  { id: 'E10090', name: '顾知夏', deptId: '203', position: 'IT 运维专员', family: 'O', sequence: 'OPS', grade: 'O3', years: 4, perf: 'B', perfScore: 85, potential: 'MID', grid: '9B2', salary: 19000, isCorePosition: false, risk: 'LOW', tags: ['系统管理员'] },
];

export const personas: Persona[] = [
  {
    id: 'lin',
    employeeId: 'E10086',
    name: '许云清',
    title: '软件工程师 · P3',
    roles: ['employee'],
    defaultRole: 'employee',
    tenantId: 't_huali',
    tenantName: '华砺精工',
    blurb: '正在准备 P4 晋升认证，想看清差距与学习路径',
  },
  {
    id: 'wang',
    employeeId: 'E10020',
    name: '陆行舟',
    title: '软件研发经理 · M2',
    roles: ['manager', 'cert_panel'],
    defaultRole: 'manager',
    tenantId: 't_huali',
    tenantName: '华砺精工',
    blurb: '带 20 人研发团队，负责审批与认证小组评审',
  },
  {
    id: 'zhou',
    employeeId: 'E10002',
    name: '温晚晴',
    title: 'HRD · M3',
    roles: ['hr', 'committee'],
    defaultRole: 'hr',
    tenantId: 't_huali',
    tenantName: '华砺精工',
    blurb: '运营标准、盘点与调薪，管委会终审成员',
  },
  {
    id: 'zhang',
    employeeId: 'E10001',
    name: '沈既明',
    title: '首席执行官',
    roles: ['exec'],
    defaultRole: 'exec',
    tenantId: 't_huali',
    tenantName: '华砺精工',
    blurb: '看三张图做人才决策，审批调薪与盘点',
  },
  {
    id: 'chen',
    employeeId: 'E10090',
    name: '顾知夏',
    title: '租户管理员 · IT',
    roles: ['tenant_admin'],
    defaultRole: 'tenant_admin',
    tenantId: 't_huali',
    tenantName: '华砺精工',
    blurb: '管理配置中心、模板与用量，维护本租户',
  },
  {
    id: 'platform',
    name: '程亦',
    title: '平台管理员',
    roles: ['platform_admin'],
    defaultRole: 'platform_admin',
    tenantId: 'platform',
    tenantName: 'SaaS 平台运营',
    blurb: '开通/封禁租户、模板上架、平台用量账单（不可见员工明文）',
  },
];

export function employeeById(id?: string): Employee | undefined {
  return employees.find((e) => e.id === id);
}
