import { MOCK_LLM, questionTypeFor, scoreObjective } from './paper';

describe('exam paper seams', () => {
  it('mastery level maps to question type (知识四档)', () => {
    expect(questionTypeFor(1)).toBe('CHOICE');
    expect(questionTypeFor(2)).toBe('FILL');
    expect(questionTypeFor(3)).toBe('QA');
    expect(questionTypeFor(4)).toBe('DEFENSE');
    expect(() => questionTypeFor(5)).toThrow();
  });

  it('mock LLM generates one question per knowledge point with mapped type', async () => {
    const qs = await MOCK_LLM.generateQuestions([
      { id: 'k1', knowledge_point: 'A', mastery_level: 1, category: '通用' },
      { id: 'k2', knowledge_point: 'B', mastery_level: 4, category: '专业' },
    ]);
    expect(qs).toHaveLength(2);
    expect(qs[0].type).toBe('CHOICE');
    expect(qs[0].options).toHaveLength(4);
    expect(qs[1].type).toBe('DEFENSE');
    expect(qs[1].options).toEqual([]);
  });

  it('objective scoring is exact-match after trim/case', () => {
    expect(scoreObjective(' a ', 'A')).toBe(1);
    expect(scoreObjective('B', 'A')).toBe(0);
  });
});
