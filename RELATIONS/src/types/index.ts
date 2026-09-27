export type RelationType =
  | 'family'
  | 'friend'
  | 'colleague'
  | 'lover'
  | 'teacher'
  | 'client'
  | 'neighbor'
  | 'other';

export interface ContactInfo {
  phone?: string;
  email?: string;
  wechat?: string;
}

export interface Story {
  id: string;
  title: string;
  content: string;
  images: string[];
  storyDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomDate {
  id: string;
  type: 'birthday' | 'anniversary' | 'custom';
  label: string;
  date: string;
  remindDays: number[];
}

export interface Interaction {
  id: string;
  contactId: string;
  type: 'meet' | 'call' | 'message' | 'gift';
  date: string;
  description?: string;
  storyGenerated?: string;
}

export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  relationType: RelationType;
  relationLabel: string;
  relationDepth: number;
  knownDate?: string;
  lastContactDate?: string;
  contactInfo: ContactInfo;
  storySummary: string;
  knownChannel?: string;
  keyEvents: string[];
  currentStatus?: string;
  notes?: string;
  customDates: CustomDate[];
  stories: Story[];
  interactionRecords: Interaction[];
  createdAt: string;
  updatedAt: string;
}

export interface RelationEdge {
  id: string;
  from: string;
  to: string;
  relation?: string;
  strength: number;
}

export interface ParsedContact {
  name: string;
  relationType: RelationType;
  relationLabel: string;
  knownDate?: string;
  knownChannel?: string;
  keyEvents: string[];
  relationDepth: number;
}

export interface StoryStyle {
  style: 'warm' | 'humor' | 'nostalgic' | 'poetic';
}

export type StoryStyleType = StoryStyle['style'];

export type TimeViewMode = 'present' | 'past' | 'future';

export interface TimeTravelState {
  mode: TimeViewMode;
  selectedDate?: string;
  futureYears?: number;
}

export interface PredictionScenario {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const PREDICTION_SCENARIOS: PredictionScenario[] = [
  {id: 'closer', name: '渐入佳境', description: '关系更加亲密', icon: '💕'},
  {id: 'distant', name: '逐渐疏远', description: '联系减少', icon: '💔'},
  {id: 'turning', name: '重大转折', description: '关系发生重大变化', icon: '🎭'},
  {id: 'stable', name: '保持稳定', description: '维持现状', icon: '⚖️'},
];
