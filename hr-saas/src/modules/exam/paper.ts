/**
 * 知识四档 → 题型映射 (spec/04: 了解→选择 掌握→填空 熟练掌握→问答 精通→答辩).
 * Pure functions — LLM provider is injected.
 */

export type QuestionType = 'CHOICE' | 'FILL' | 'QA' | 'DEFENSE';

export const MASTERY_TO_TYPE: Record<number, QuestionType> = {
  1: 'CHOICE',
  2: 'FILL',
  3: 'QA',
  4: 'DEFENSE',
};

export function questionTypeFor(masteryLevel: number): QuestionType {
  const t = MASTERY_TO_TYPE[masteryLevel];
  if (!t) throw new Error(`unknown mastery level: ${masteryLevel}`);
  return t;
}

export interface KnowledgePoint {
  id: string;
  knowledge_point: string;
  mastery_level: number;
  category: string;
}

export interface DraftQuestion {
  knowledge_id: string;
  type: QuestionType;
  stem: string;
  options: string[]; // CHOICE only
  answer: string;
  score: number;
}

/** LLM provider seam. Real impl calls 豆包/通义; tests use mock. */
export interface LlmProvider {
  name: string;
  generateQuestions(points: KnowledgePoint[]): Promise<DraftQuestion[]>;
}

export const MOCK_LLM: LlmProvider = {
  name: 'mock-v1',
  async generateQuestions(points) {
    return points.map((p, i) => {
      const type = questionTypeFor(p.mastery_level);
      return {
        knowledge_id: p.id,
        type,
        stem: `【${p.category}】请围绕「${p.knowledge_point}」作答（${type}）`,
        options: type === 'CHOICE' ? ['A. 选项一', 'B. 选项二', 'C. 选项三', 'D. 选项四'] : [],
        answer: type === 'CHOICE' ? 'A' : `参考答案：${p.knowledge_point}要点`,
        score: type === 'CHOICE' || type === 'FILL' ? 10 : 20,
      };
    });
  },
};

/** Score CHOICE/FILL questions by exact match (case/space-insensitive). */
export function scoreObjective(answer: string, correct: string): number {
  return answer.trim().toLowerCase() === correct.trim().toLowerCase() ? 1 : 0;
}
