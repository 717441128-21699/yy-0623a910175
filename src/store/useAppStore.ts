import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Chapter, Sentence, CharacterVoice, CharacterType, SentenceType } from '@/types';
import { segmentText } from '@/utils/segmentation';
import { genUUID } from '@/utils/helpers';
import { DEFAULT_CHARACTER_VOICES } from '@/constants/characters';

const initialChapters: Chapter[] = [];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      chapters: initialChapters,
      currentChapterId: null,
      selectedSentenceId: null,
      characterVoices: DEFAULT_CHARACTER_VOICES,
      isPlaying: false,
      currentPlayingId: null,

      addChapter: (title: string, text: string) => {
        const result = segmentText(text);
        if (title.trim() && result.chapter) {
          result.chapter.title = title.trim();
        }
        set((state) => {
          const chapters = [...state.chapters, result.chapter];
          return {
            chapters,
            currentChapterId: state.currentChapterId ?? result.chapter.id,
          };
        });
      },

      removeChapter: (id: string) => {
        set((state) => {
          const chapters = state.chapters.filter((c) => c.id !== id);
          return {
            chapters,
            currentChapterId:
              state.currentChapterId === id
                ? chapters[0]?.id ?? null
                : state.currentChapterId,
          };
        });
      },

      setCurrentChapter: (id: string) => set({ currentChapterId: id }),

      updateSentence: (id: string, patch: Partial<Sentence>) => {
        set((state) => ({
          chapters: state.chapters.map((ch) => ({
            ...ch,
            sentences: ch.sentences.map((s) =>
              s.id === id ? { ...s, ...patch } : s
            ),
          })),
        }));
      },

      splitSentence: (id: string, splitIndex: number) => {
        set((state) => ({
          chapters: state.chapters.map((ch) => {
            const idx = ch.sentences.findIndex((s) => s.id === id);
            if (idx === -1) return ch;
            const original = ch.sentences[idx];
            const text1 = original.text.slice(0, splitIndex).trim();
            const text2 = original.text.slice(splitIndex).trim();
            if (!text1 || !text2) return ch;

            const s1: Sentence = {
              ...original,
              id: genUUID(),
              text: text1,
              order: original.order,
            };
            const s2: Sentence = {
              ...original,
              id: genUUID(),
              text: text2,
              order: original.order + 1,
              pauseBefore: 0,
            };

            const before = ch.sentences.slice(0, idx);
            const after = ch.sentences
              .slice(idx + 1)
              .map((s) => ({ ...s, order: s.order + 1 }));
            const newList = [...before, s1, s2, ...after].map((s, i) => ({
              ...s,
              order: i,
            }));

            return {
              ...ch,
              sentences: newList,
              wordCount: newList.reduce((a, s) => a + s.text.length, 0),
            };
          }),
        }));
      },

      mergeSentences: (id1: string, id2: string) => {
        set((state) => ({
          chapters: state.chapters.map((ch) => {
            const i1 = ch.sentences.findIndex((s) => s.id === id1);
            const i2 = ch.sentences.findIndex((s) => s.id === id2);
            if (i1 === -1 || i2 === -1) return ch;
            const minIdx = Math.min(i1, i2);
            const maxIdx = Math.max(i1, i2);
            if (maxIdx - minIdx !== 1) return ch;

            const a = ch.sentences[minIdx];
            const b = ch.sentences[maxIdx];
            const merged: Sentence = {
              ...a,
              id: genUUID(),
              text: (a.text + b.text).trim(),
              order: minIdx,
              type: a.type === b.type ? a.type : 'narration',
              character: b.character || a.character,
              voiceStyle: b.voiceStyle || a.voiceStyle,
            };

            const newList: Sentence[] = [];
            ch.sentences.forEach((s, i) => {
              if (i === minIdx) newList.push(merged);
              else if (i === maxIdx) return;
              else newList.push({ ...s, order: newList.length });
            });

            return {
              ...ch,
              sentences: newList.map((s, i) => ({ ...s, order: i })),
              wordCount: newList.reduce((a, s) => a + s.text.length, 0),
            };
          }),
        }));
      },

      setCharacterVoice: (character: CharacterType, patch: Partial<CharacterVoice>) => {
        set((state) => ({
          characterVoices: state.characterVoices.map((c) =>
            c.character === character ? { ...c, ...patch } : c
          ),
        }));
      },

      selectSentence: (id: string | null) => set({ selectedSentenceId: id }),

      toggleReread: (id: string) => {
        const s = get()
          .chapters.flatMap((c) => c.sentences)
          .find((x) => x.id === id);
        if (s) get().updateSentence(id, { isReread: !s.isReread });
      },

      setPlaying: (isPlaying: boolean, sentenceId?: string | null) => {
        set({
          isPlaying,
          currentPlayingId:
            sentenceId === undefined ? get().currentPlayingId : sentenceId,
        });
      },

      bulkAssignCharacter: (type: SentenceType, character: CharacterType) => {
        set((state) => ({
          chapters: state.chapters.map((ch) => ({
            ...ch,
            sentences: ch.sentences.map((s) =>
              s.type === type ? { ...s, character } : s
            ),
          })),
        }));
      },

      clearAll: () =>
        set({
          chapters: [],
          currentChapterId: null,
          selectedSentenceId: null,
          currentPlayingId: null,
          isPlaying: false,
        }),
    }),
    {
      name: 'moyin-audiobook-store',
      partialize: (state) => ({
        chapters: state.chapters,
        currentChapterId: state.currentChapterId,
        characterVoices: state.characterVoices,
      }),
    }
  )
);

export const selectCurrentChapter = (state: AppState): Chapter | null => {
  if (!state.currentChapterId) return null;
  return state.chapters.find((c) => c.id === state.currentChapterId) ?? null;
};

export const selectAllSentences = (state: AppState): Sentence[] => {
  return state.chapters
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .flatMap((c) =>
      c.sentences.slice().sort((a, b) => a.order - b.order)
    );
};

export const selectUnassignedCount = (state: AppState): number => {
  return state.chapters.reduce(
    (a, c) => a + c.sentences.filter((s) => !s.character).length,
    0
  );
};
