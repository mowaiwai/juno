/**
 * 待办与消息 mock —— 按 persona 投递（真实系统按角色 × 数据范围推导）。
 * link 为 /app/{key}，未交付页面由 ComingSoon 兜底。
 */

export type NoticeKind = 'todo' | 'msg';
export type NoticeLevel = 'urgent' | 'normal' | 'info';

export interface NoticeItem {
  id: string;
  /** 目标 persona：lin / wang / zhou / zhang / chen */
  personaId: string;
  kind: NoticeKind;
  level: NoticeLevel;
  title: string;
  desc: string;
  time: string;
  link?: string;
  linkLabel?: string;
  read?: boolean;
  /** 已办归档（动作完成时间） */
  doneAt?: string;
}

export const notices: NoticeItem[] = [
  // ---- 许星遥（员工） ----
  { id: 'n-01', personaId: 'lin', kind: 'todo', level: 'urgent', title: '举证材料待补交：技术改进', desc: '「技术改进」专项材料尚未归档，AI 提示可引用构建耗时优化 32% 专项。举证截止 2026-10-15。', time: '09:12', link: '/app/cert-apply', linkLabel: '去举证' },
  { id: 'n-02', personaId: 'lin', kind: 'todo', level: 'normal', title: '缺陷修复举证待复审确认', desc: '你补充的 5-Why 根因分析已提交，请确认材料版本后送 HR 预审。', time: '昨天', link: '/app/cert-apply', linkLabel: '查看' },
  { id: 'n-03', personaId: 'lin', kind: 'msg', level: 'info', title: '知识测验成绩发布', desc: 'SW-P4 认证知识测验：86 分（合格线 80），AI 组卷 · 40 题。成绩已回写画像。', time: '09-05', read: true },
  { id: 'n-04', personaId: 'lin', kind: 'todo', level: 'normal', title: 'IDP 行动：「分布式进阶」10 月到期', desc: 'Q4 发展行动还剩 1 项未完成，逾期将影响认证知识维评分。', time: '09-26', link: '/app/idp', linkLabel: '查看 IDP' },
  { id: 'n-05', personaId: 'lin', kind: 'msg', level: 'normal', title: '画像已更新至 v2025Q3', desc: '认证举证回写：职责履行 +2、团队贡献 +6。', time: '09-20', link: '/app/my-profile', linkLabel: '看画像', read: true },

  // ---- 陆行舟（管理者 / 认证小组） ----
  { id: 'n-11', personaId: 'wang', kind: 'todo', level: 'urgent', title: '待预审：曹沐辰 P2→P3 举证材料', desc: '3 项材料已提交，其中知识测验为补考通过，请重点复核举证与标准匹配度。', time: '09:40', link: '/app/cert-review', linkLabel: '去预审' },
  { id: 'n-12', personaId: 'wang', kind: 'todo', level: 'urgent', title: '待表决：许清禾 P2→P3 答辩表决', desc: '认证小组 5 人已表决 3 人（2 同意 / 1 反对），你的表决将决定走向。', time: '10:05', link: '/app/cert-vote', linkLabel: '去表决' },
  { id: 'n-13', personaId: 'wang', kind: 'todo', level: 'normal', title: 'Q4 团队绩效校准会预约', desc: '请在本周内选择校准会时间，会后录入团队绩效评估。', time: '昨天', link: '/app/perf-import', linkLabel: '去预约' },
  { id: 'n-14', personaId: 'wang', kind: 'msg', level: 'urgent', title: '离职风险预警：董斯年', desc: '画像连续两周期下滑 + 认证终止，风险等级 HIGH。建议两周内完成保留面谈。', time: '09-24', link: '/app/roster?id=E10093', linkLabel: '查看档案' },
  { id: 'n-15', personaId: 'wang', kind: 'msg', level: 'info', title: '许星遥举证进度更新', desc: '「编码实现」举证通过 AI 预审；「缺陷修复」驳回后已补交。', time: '09-22', link: '/app/cert-review', linkLabel: '查看' },

  // ---- 温晚晴（HR / 管委会） ----
  { id: 'n-21', personaId: 'zhou', kind: 'todo', level: 'urgent', title: '管委会终审待表决：汪漾 P3→P4', desc: '答辩已完成，管委会 5 人已表决 4 人（4 同意）。表决通过后需终审落库。', time: '10:15', link: '/app/cert-vote', linkLabel: '去表决' },
  { id: 'n-22', personaId: 'zhou', kind: 'todo', level: 'normal', title: 'HR 序列标准 v1.2 评审中', desc: '标准已进入委员会评审环节，请组织评审会并录入结论。', time: '昨天', link: '/app/standard-versions', linkLabel: '去处理' },
  { id: 'n-23', personaId: 'zhou', kind: 'todo', level: 'normal', title: 'AI 组卷待审核 12 份', desc: '10 月认证批次 AI 出卷已生成，需人工审核后发布。', time: '09:30', link: '/app/exam-review', linkLabel: '去审核' },
  { id: 'n-24', personaId: 'zhou', kind: 'msg', level: 'normal', title: '2026 年度盘点批次将于 10-15 启动', desc: '请提前完成画像数据补齐与绩效数据导入。', time: '09-26', link: '/app/inv-batches', linkLabel: '查看批次' },

  // ---- 沈既明（高管） ----
  { id: 'n-31', personaId: 'zhang', kind: 'todo', level: 'normal', title: '2026 调薪窗口 10-08 开启', desc: '调薪引擎已完成初筛：核心岗位核心人才 23 人入围，方案待你审批。', time: '09-26', link: '/app/salary-plan', linkLabel: '查看方案' },
  { id: 'n-32', personaId: 'zhang', kind: 'msg', level: 'normal', title: '三季度人才大盘已生成', desc: '哑铃型部门 1 个（软件研发部），高潜流失风险 2 人，点击查看三张图。', time: '09-25', link: '/app/three-charts', linkLabel: '看大盘' },
  { id: 'n-33', personaId: 'zhang', kind: 'todo', level: 'urgent', title: '待审批：机械设计部梯队方案', desc: '沈鹿溪继任候选方案已由 HR 提交，包含保留与培养双计划。', time: '09-23', link: '/app/succession-matrix', linkLabel: '去审批' },

  // ---- 顾知夏（租户管理员） ----
  { id: 'n-41', personaId: 'chen', kind: 'todo', level: 'normal', title: '9 月 AI 用量已达配额 80%', desc: '认证出题与画像摘要为本月消耗大头，可调整租户配额或升级套餐。', time: '09-26', link: '/app/ai-usage', linkLabel: '查看用量' },
];

export function noticesOf(personaId: string): NoticeItem[] {
  return notices.filter((n) => n.personaId === personaId);
}

export function todosOf(personaId: string): NoticeItem[] {
  return noticesOf(personaId).filter((n) => n.kind === 'todo' && !n.doneAt);
}
