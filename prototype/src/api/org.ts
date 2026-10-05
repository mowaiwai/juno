/** 组织基础数据接口：部门、岗位编制、职级通道。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { departments as mockDepts, positions as mockPositions } from '@/mock/org';
import { channels as mockChannels, FAMILY_LABEL as mockFamilyLabel } from '@/mock/channels';
import { employees as mockEmployees } from '@/mock/people';

export interface DepartmentItem {
  id: string;
  parent_id: string;
  name: string;
  type: string;
  manager_id: string | null;
  manager_name: string | null;
}

export interface GradeBand {
  grade: string;
  title: string;
  band_range: string;
  salary_band: [number, number];
  review_years?: number;
  promote_rule: string;
  customized?: boolean;
  p25?: number | null;
  p50?: number | null;
  p75?: number | null;
  p90?: number | null;
  market_source_year?: number | null;
}

export interface ChannelFamily {
  family: string;
  name: string;
  desc: string;
  sequences: string[];
  grades: GradeBand[];
}

export interface PositionItem {
  id: string;
  name: string;
  dept_id: string;
  family: string;
  sequence: string;
  grade: string;
  is_core: boolean;
  headcount: number;
  on_duty: number;
}

export type FamilyLabelMap = Record<string, string>;

// 模块级缓存
let _depts: Promise<DepartmentItem[]> | null = null;
let _positions: Promise<PositionItem[]> | null = null;
let _channels: Promise<ChannelFamily[]> | null = null;
let _familyLabel: Promise<FamilyLabelMap> | null = null;

export const orgApi = {
  departments: () => {
    if (USE_MOCK) {
      return Promise.resolve(
        mockDepts.map((d) => ({
          id: d.id,
          parent_id: d.parentId,
          name: d.name,
          type: d.type,
          manager_id: d.managerId ?? null,
          manager_name: d.managerId ? mockEmployees.find((e) => e.id === d.managerId)?.name ?? null : null,
        })),
      );
    }
    if (!_depts) _depts = api.get<DepartmentItem[]>('/org/departments');
    return _depts;
  },

  positions: () => {
    if (USE_MOCK) {
      return Promise.resolve(
        mockPositions.map((p) => ({
          id: p.id,
          name: p.name,
          dept_id: p.deptId,
          family: p.family,
          sequence: p.sequence,
          grade: p.grade,
          is_core: p.isCore,
          headcount: p.headcount,
          on_duty: mockEmployees.filter((e) => e.deptId === p.deptId && e.position === p.name).length,
        })),
      );
    }
    if (!_positions) _positions = api.get<PositionItem[]>('/org/positions');
    return _positions;
  },

  channels: () => {
    if (USE_MOCK) {
      return Promise.resolve(
        mockChannels.map((c) => ({
          family: c.family,
          name: c.name,
          desc: c.desc,
          sequences: c.sequences,
          grades: c.grades.map((g) => ({
            grade: g.grade,
            title: g.title,
            band_range: g.bandRange,
            salary_band: g.salaryBand as [number, number],
            review_years: g.reviewYears,
            promote_rule: g.promoteRule,
          })),
        })),
      );
    }
    if (!_channels) _channels = api.get<ChannelFamily[]>('/org/channels');
    return _channels;
  },

  familyLabel: () => {
    if (USE_MOCK) return Promise.resolve(mockFamilyLabel as FamilyLabelMap);
    if (!_familyLabel) _familyLabel = api.get<FamilyLabelMap>('/org/family-label');
    return _familyLabel;
  },

  invalidate: () => {
    _depts = null;
    _positions = null;
    _channels = null;
    _familyLabel = null;
  },
};

/** 部门名查找（兼容 mock 与真实模式） */
export function makeDeptName(depts: DepartmentItem[]): (id: string) => string {
  return (id: string) => depts.find((d) => d.id === id)?.name ?? id;
}

/** 部门子树（含自身）全部 id */
export function subtreeDeptIds(depts: DepartmentItem[], rootId: string): string[] {
  const result = [rootId];
  let frontier = [rootId];
  while (frontier.length) {
    const next: string[] = [];
    for (const pid of frontier) {
      for (const d of depts) {
        if (d.parent_id === pid) next.push(d.id);
      }
    }
    result.push(...next);
    frontier = next;
  }
  return result;
}
