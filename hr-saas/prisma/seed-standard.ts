/**
 * Ticket 02 PLACEHOLDER (ADR-0010: ticket 02 is human-owned).
 * Minimal seed standard library for 软件研发 P1-P5 so tickets 03-06 are unblocked.
 * TODO(human): replace with domain-expert-authored standard skeleton —
 * see .scratch/mvp-certification/issues/02-seed-standard.md.
 */
import { PrismaClient } from '@prisma/client';
import { CHANNEL_IDS, TENANT_ID } from './seed';

const prisma = new PrismaClient();

const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;

// minimal basic/perf conditions per grade (hard-check rules read these)
const BASIC: Record<string, object> = {
  P1: { education: '大专', work_years: 0 },
  P2: { education: '本科', work_years: 1 },
  P3: { education: '本科', work_years: 3 },
  P4: { education: '本科', work_years: 5 },
  P5: { education: '硕士', work_years: 8 },
};
const PERF: Record<string, object> = {
  P2: { recent_year_min: 'B' }, // P1->P2
  P3: { recent_two_year_min_a: 1, recent_year_min: 'B' }, // P2->P3
  P4: { recent_two_year_min_a: 1, recent_year_min: 'B' }, // P3->P4
  P5: { recent_two_year_min_a: 2, recent_year_min: 'A' }, // P4->P5
};

const DUTIES: Record<string, Array<[string, string, number]>> = {
  P1: [['在指导下完成模块开发与自测', '代码通过评审与单元测试', 1], ['修复一般缺陷', '缺陷按期闭环', 1], ['撰写模块文档', '文档齐套', 1]],
  P2: [['独立完成模块设计与开发', '按期交付且质量达标', 2], ['参与需求评审', '提出有效意见', 1], ['指导实习生', '完成带教任务', 2]],
  P3: [['主导子系统设计', '方案评审通过并落地', 3], ['攻克中等技术难题', '形成可复用方案', 2], ['跨组协作推进联调', '联调按期完成', 2]],
  P4: [['主导系统架构设计', '架构支撑业务年度目标', 3], ['技术预研与选型', '预研成果转化', 3], ['培养 P2-P3 工程师', '被带人晋升或达标', 3]],
  P5: [['规划技术方向', '技术路线获管委会通过', 4], ['跨团队技术影响力', '推动 2+ 团队采用', 4], ['关键技术攻坚', '解决公司级难题', 3]],
};

// knowledge points with 知识四档 mastery levels
const KNOWLEDGE: Record<string, Array<[string, number, string]>> = {
  P1: [['编程语言基础语法', 2, '通用'], ['常用数据结构', 1, '通用'], ['开发工具使用', 2, '通用']],
  P2: [['设计模式', 2, '专业'], ['数据库基本操作', 2, '专业'], ['接口设计规范', 1, '专业']],
  P3: [['分布式系统基础', 3, '专业'], ['性能分析方法', 2, '专业'], ['领域建模', 2, '专业']],
  P4: [['高并发架构', 3, '专业'], ['稳定性工程', 3, '专业'], ['技术选型方法论', 3, '通用']],
  P5: [['技术战略规划', 4, '通用'], ['行业技术趋势', 3, '行业'], ['大型系统演进', 4, '专业']],
};

const ABILITIES: Record<string, Array<[string, string]>> = {
  P1: [['学习能力', '能快速掌握导师指定的新知识点并应用']],
  P2: [['执行力', '承诺的任务按期高质量完成'], ['沟通协作', '主动同步进展与风险']],
  P3: [['问题分析与解决', '独立定位复杂问题根因'], ['Owner 意识', '对子系统结果负责']],
  P4: [['技术领导力', '带领小组完成系统设计并达成共识'], ['培养他人', '系统性带教并产出成果']],
  P5: [['战略思维', '从业务战略推导技术规划'], ['组织影响力', '跨团队推动技术决策落地']],
};

export async function seedStandard() {
  await prisma.qc_standard_ability.deleteMany({ where: { tenant_id: TENANT_ID } });
  await prisma.qc_standard_knowledge.deleteMany({ where: { tenant_id: TENANT_ID } });
  await prisma.qc_standard_duty.deleteMany({ where: { tenant_id: TENANT_ID } });
  await prisma.qc_standard.deleteMany({ where: { tenant_id: TENANT_ID } });

  for (let i = 0; i < GRADES.length; i++) {
    const grade = GRADES[i];
    const std = await prisma.qc_standard.create({
      data: {
        id: `std-sw-${grade.toLowerCase()}`,
        tenant_id: TENANT_ID,
        channel_id: CHANNEL_IDS[i],
        grade,
        version: '1.0',
        status: 1, // effective
        basic_condition: JSON.stringify(BASIC[grade]),
        perf_condition: JSON.stringify(PERF[grade] ?? {}),
      },
    });
    await prisma.qc_standard_duty.createMany({
      data: DUTIES[grade].map(([duty_item, completion_standard, duty_level], j) => ({
        id: `${std.id}-duty-${j + 1}`, tenant_id: TENANT_ID, standard_id: std.id,
        duty_item, completion_standard, duty_level, sort: j,
      })),
    });
    await prisma.qc_standard_knowledge.createMany({
      data: KNOWLEDGE[grade].map(([knowledge_point, mastery_level, category], j) => ({
        id: `${std.id}-kn-${j + 1}`, tenant_id: TENANT_ID, standard_id: std.id,
        knowledge_point, mastery_level, category, sort: j,
      })),
    });
    await prisma.qc_standard_ability.createMany({
      data: ABILITIES[grade].map(([ability_item, key_behavior], j) => ({
        id: `${std.id}-ab-${j + 1}`, tenant_id: TENANT_ID, standard_id: std.id,
        ability_item, key_behavior, sort: j,
      })),
    });
  }
  console.log('seed-standard done (PLACEHOLDER, TODO human-authored): P1-P5, version 1.0, status effective');
}

if (require.main === module) {
  seedStandard().finally(() => prisma.$disconnect());
}
