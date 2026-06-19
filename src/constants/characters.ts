import type { CharacterVoice, VoiceStyle, CharacterType } from '@/types';

export const VOICE_STYLES: {
  value: VoiceStyle;
  label: string;
  desc: string;
  icon: string;
}[] = [
  { value: 'cool', label: '清冷', desc: '声线清澈冷淡，疏离感强', icon: '❄️' },
  { value: 'youth', label: '少年', desc: '声线明亮活泼，青春洋溢', icon: '🌱' },
  { value: 'steady', label: '沉稳', desc: '声线厚重有力，成熟稳重', icon: '🏔️' },
  { value: 'funny', label: '搞笑', desc: '声线夸张戏谑，滑稽有趣', icon: '🎭' },
];

export const DEFAULT_CHARACTER_VOICES: CharacterVoice[] = [
  {
    character: 'male_lead',
    name: '男主',
    style: 'steady',
    voiceURI: null,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
  },
  {
    character: 'female_lead',
    name: '女主',
    style: 'cool',
    voiceURI: null,
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.12)',
  },
  {
    character: 'villain',
    name: '反派',
    style: 'funny',
    voiceURI: null,
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.12)',
  },
  {
    character: 'narrator',
    name: '旁白',
    style: 'steady',
    voiceURI: null,
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.12)',
  },
];

export const CHARACTER_LIST: {
  value: CharacterType;
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}[] = [
  {
    value: 'male_lead',
    label: '男主',
    color: 'text-role-male',
    bgColor: 'bg-role-male',
    dotColor: 'bg-role-male',
  },
  {
    value: 'female_lead',
    label: '女主',
    color: 'text-role-female',
    bgColor: 'bg-role-female',
    dotColor: 'bg-role-female',
  },
  {
    value: 'villain',
    label: '反派',
    color: 'text-role-villain',
    bgColor: 'bg-role-villain',
    dotColor: 'bg-role-villain',
  },
  {
    value: 'narrator',
    label: '旁白',
    color: 'text-role-narrator',
    bgColor: 'bg-role-narrator',
    dotColor: 'bg-role-narrator',
  },
];

export const SENTENCE_TYPE_META: Record<
  string,
  { label: string; color: string; dotColor: string; bgColor: string }
> = {
  title: {
    label: '章节标题',
    color: 'text-role-title',
    dotColor: 'bg-role-title',
    bgColor: 'bg-purple-50',
  },
  dialogue: {
    label: '对话',
    color: 'text-role-dialogue',
    dotColor: 'bg-role-dialogue',
    bgColor: 'bg-emerald-50',
  },
  narration: {
    label: '旁白',
    color: 'text-role-narration',
    dotColor: 'bg-role-narration',
    bgColor: 'bg-slate-50',
  },
};

export const STYLE_PARAM_MAP: Record<
  string,
  { rate: number; pitch: number; volume: number }
> = {
  cool: { rate: 0.95, pitch: 1.05, volume: 0.95 },
  youth: { rate: 1.1, pitch: 1.2, volume: 1.0 },
  steady: { rate: 0.85, pitch: 0.85, volume: 1.0 },
  funny: { rate: 1.2, pitch: 1.4, volume: 1.05 },
};

export const CHARACTER_PARAM_MAP: Record<
  Exclude<CharacterType, null>,
  { genderPref: 'male' | 'female' | 'any'; basePitch: number; baseRate: number }
> = {
  male_lead: { genderPref: 'male', basePitch: 0.9, baseRate: 0.95 },
  female_lead: { genderPref: 'female', basePitch: 1.1, baseRate: 1.0 },
  villain: { genderPref: 'any', basePitch: 1.0, baseRate: 1.0 },
  narrator: { genderPref: 'any', basePitch: 1.0, baseRate: 0.95 },
};
