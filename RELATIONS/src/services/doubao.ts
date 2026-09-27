const DOUBAO_API_BASE = 'https://ark.cn-beijing.volces.com/api/v3';

const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || '';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  messages: ChatMessage[],
  model: string = 'doubao-pro-32k'
): Promise<ChatCompletionResponse> {
  const response = await fetch(`${DOUBAO_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DOUBAO_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat completion failed: ${response.status}`);
  }

  return response.json();
}

export async function generateText(prompt: string): Promise<string> {
  const messages: ChatMessage[] = [
    {role: 'user', content: prompt},
  ];

  const response = await chatCompletion(messages);
  return response.choices[0]?.message?.content || '';
}

export interface OnThisDayStoryParams {
  contactName: string;
  contactRelation: string;
  relationDepth: number;
  interactionRecords: Array<{
    type: string;
    description: string;
    date: string;
  }>;
  stories: Array<{
    title: string;
    content: string;
    storyDate?: string;
  }>;
  daysSinceLastContact: number;
}

export async function generateOnThisDayStory(params: OnThisDayStoryParams): Promise<string> {
  const systemPrompt = `你是一位擅长叙事和情感描写的作家。请根据提供的人际关系信息，用文学化的手法撰写一篇"去年今日"风格的故事。

要求：
1. 故事要有人文关怀和情感温度
2. 可以使用各种文学手法：倒叙、插叙、比喻、象征等
3. 突出关系的独特性和珍贵性
4. 长度适中（约300-500字）
5. 语言优美但不过度煽情
6. 如果有多次互动记录，选择最有意义的一次作为故事核心`;

  const userPrompt = `请为"${params.contactName}"撰写一篇"去年今日"风格的故事。

关系信息：
- 关系类型：${params.contactRelation}
- 关系深度：${params.relationDepth}/10
- 最后联系：${params.daysSinceLastContact}天前

互动记录：
${params.interactionRecords.length > 0
  ? params.interactionRecords.map(r => `- ${r.date}: ${r.description}`).join('\n')
  : '暂无详细记录'}

故事记录：
${params.stories.length > 0
  ? params.stories.map(s => `- ${s.storyDate || '某时'}: ${s.title}`).join('\n')
  : '暂无故事记录'}

请用文学化的手法，以"去年的今天"为视角，撰写一篇温暖人心的故事。`;

  const messages: ChatMessage[] = [
    {role: 'system', content: systemPrompt},
    {role: 'user', content: userPrompt},
  ];

  const response = await chatCompletion(messages, 'doubao-pro-32k');
  return response.choices[0]?.message?.content || '';
}
