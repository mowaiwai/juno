/** 驾驶舱问答接口。 */
import { api } from './client';
import { USE_MOCK } from './config';

export interface CockpitAnswer {
  answer: string
  sources: string[]
  model: string
}

interface PresetItem {
  q: string
  a: string
  sources: string[]
}

const PRESET: PresetItem[] = [
  {
    q: '软件研发部为什么是哑铃型？有什么风险？',
    a: '软件研发部共 8 人，其中 P2 级 3 人、P3 级 3 人、P4 级 2 人，中坚层（P3）占比 37.5% 低于 40% 阈值，且 P3→P4 通过率不足。风险：中坚断层导致项目交付过度依赖 2 名 P4，一旦流失将直接影响数字化转型专项。建议加速许星遥、温以宁的 P3→P4 认证，并启动外部招聘。',
    sources: ['人才结构图-研发中心', '盘点批次 inv_2026_h1', '认证记录-许星遥 P3→P4'],
  },
  {
    q: '本期有多少意愿度异常员工？分别是谁？',
    a: '本期识别到 2 名意愿度异常员工（能力≥75 但业绩<78）：顾屿白、温以宁。这类员工能力强但业绩未达预期，通常是意愿度或岗位匹配问题，建议 HRBP 逐一介入面谈，结合 IDP 调整工作内容或激励方式。',
    sources: ['人才图-能力×业绩散点', '员工画像-能力维度'],
  },
  {
    q: '核心岗位断层风险最高的是哪个？建议如何补位？',
    a: '断层风险最高的是「高级软件工程师」（研发中心），4 个编制仅 2 人在岗，中坚通过率不足且 1 人有流失风险。建议：① 加速许星遥、温以宁的 P3→P4 认证（90 天内）；② 启动外部招聘 2 名 P4；③ 对顾屿白启动保留面谈，避免核心流失。销售部「大客户经理」为单岗风险，需同步启动继任与外部猎聘。',
    sources: ['断层预警清单', '继任矩阵-核心岗位'],
  },
  {
    q: '高潜人才池有多少人？分布在哪些部门？',
    a: '本期高潜（潜力 HIGH）共 3 人，占盘点总人数约 12%。主要分布在研发中心、制造中心与职能部门，构成核心人才池。建议纳入高潜培养计划，配导师、给核心项目，每季度复盘成长。',
    sources: ['九宫格看板-高潜区', '盘点批次 inv_2026_h1'],
  },
]

/** mock：精确匹配预设问题，否则给通用演示回答 */
function mockAsk(question: string): Promise<CockpitAnswer> {
  const found = PRESET.find((p) => p.q === question.trim())
  if (found) {
    return Promise.resolve({ answer: found.a, sources: found.sources, model: 'mock-preset' })
  }
  return Promise.resolve({
    answer: `（演示数据）您的问题是「${question}」。正式接入 AI 后，系统将基于员工名册、最新盘点与继任概览中的真实数据给出可溯源回答。您也可以点击上方预设问题查看完整演示。`,
    sources: ['演示数据'],
    model: 'mock-preset',
  })
}

export const cockpitApi = {
  preset: PRESET.map((p) => p.q),
  ask: (question: string): Promise<CockpitAnswer> => {
    if (USE_MOCK) return mockAsk(question)
    return api.post<CockpitAnswer>('/cockpit/ask', { question })
  },
}
