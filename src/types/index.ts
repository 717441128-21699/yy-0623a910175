export type SentenceType = 'title' | 'dialogue' | 'narration';

export type CharacterType = 'male_lead' | 'female_lead' | 'villain' | 'narrator' | null;

export type VoiceStyle = 'cool' | 'youth' | 'steady' | 'funny' | null;

export interface Sentence {
  id: string;
  chapterId: string;
  type: SentenceType;
  text: string;
  character: CharacterType;
  voiceStyle: VoiceStyle;
  rate: number;
  pitch: number;
  pauseBefore: number;
  emotionLevel: number;
  isReread: boolean;
  order: number;
}

export interface Chapter {
  id: string;
  title: string;
  wordCount: number;
  sentences: Sentence[];
  createdAt: number;
}

export interface CharacterVoice {
  character: CharacterType;
  name: string;
  style: VoiceStyle;
  voiceURI: string | null;
  color: string;
  bgColor: string;
}

export interface AppState {
  chapters: Chapter[];
  currentChapterId: string | null;
  selectedSentenceId: string | null;
  characterVoices: CharacterVoice[];
  isPlaying: boolean;
  currentPlayingId: string | null;

  addChapter: (title: string, text: string) => void;
  removeChapter: (id: string) => void;
  setCurrentChapter: (id: string) => void;
  updateSentence: (id: string, patch: Partial<Sentence>) => void;
  splitSentence: (id: string, splitIndex: number) => void;
  mergeSentences: (id1: string, id2: string) => void;
  setCharacterVoice: (character: CharacterType, patch: Partial<CharacterVoice>) => void;
  selectSentence: (id: string | null) => void;
  toggleReread: (id: string) => void;
  setPlaying: (isPlaying: boolean, sentenceId?: string | null) => void;
  bulkAssignCharacter: (type: SentenceType, character: CharacterType) => void;
  clearAll: () => void;
}
