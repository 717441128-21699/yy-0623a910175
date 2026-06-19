import type { Sentence, SentenceType, Chapter } from '@/types';
import { genUUID } from './helpers';

const CHAPTER_TITLE_REGEX =
  /^\s*第[\s\d零一二三四五六七八九十百千万两]+[章节回卷部集篇折幕].*$/;

const SHORT_TITLE_REGEX = /^\s*(序章|终章|尾声|楔子|番外|前传|后传|续集)[^，。！？\n]*$/;

const QUOTED_DIALOGUE_REGEX =
  /["""「」『』]([^""""「」『』]{1,500}?)["""「」『』]/g;

const SENTENCE_END_REGEX = /([。！？!?……\.\n]+)(?=[^\s])/g;

interface SegmentResult {
  chapter: Chapter;
}

export const segmentText = (inputText: string, chapterId?: string): SegmentResult => {
  const text = inputText.replace(/\r\n/g, '\n').replace(/\u3000/g, ' ').trim();
  const id = chapterId || genUUID();
  const sentences: Sentence[] = [];
  let order = 0;

  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  let firstLineAsTitle = false;
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (
      !CHAPTER_TITLE_REGEX.test(firstLine) &&
      !SHORT_TITLE_REGEX.test(firstLine) &&
      firstLine.length <= 20 &&
      !firstLine.match(/[，。！？；：,.!?;:]/)
    ) {
      firstLineAsTitle = true;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    if (CHAPTER_TITLE_REGEX.test(line) || SHORT_TITLE_REGEX.test(line)) {
      sentences.push(createSentence(id, line, 'title', order++));
      continue;
    }

    if (firstLineAsTitle && lines.indexOf(rawLine) === 0) {
      sentences.push(createSentence(id, line, 'title', order++));
      firstLineAsTitle = false;
      continue;
    }

    const lineSentences = extractFromLine(line, id, order);
    lineSentences.forEach((s) => {
      s.order = order++;
      sentences.push(s);
    });
  }

  const finalSentences = sentences.map((s, i) => ({ ...s, order: i }));
  const wordCount = finalSentences.reduce((acc, s) => acc + s.text.length, 0);
  const title =
    finalSentences.find((s) => s.type === 'title')?.text?.slice(0, 30) ||
    (finalSentences[0]?.text?.slice(0, 15) + '...') ||
    '未命名章节';

  return {
    chapter: {
      id,
      title,
      wordCount,
      sentences: finalSentences,
      createdAt: Date.now(),
    },
  };
};

const createSentence = (
  chapterId: string,
  text: string,
  type: SentenceType,
  order: number
): Sentence => ({
  id: genUUID(),
  chapterId,
  type,
  text: text.trim(),
  character: type === 'title' ? 'narrator' : type === 'narration' ? 'narrator' : null,
  voiceStyle: null,
  rate: 1.0,
  pitch: 1.0,
  pauseBefore: type === 'title' ? 800 : 0,
  emotionLevel: 5,
  isReread: false,
  order,
});

const extractFromLine = (line: string, chapterId: string, startOrder: number): Sentence[] => {
  const results: Sentence[] = [];
  const stripped = line;

  QUOTED_DIALOGUE_REGEX.lastIndex = 0;
  const dialogueMatches: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = QUOTED_DIALOGUE_REGEX.exec(stripped)) !== null) {
    dialogueMatches.push({ start: m.index, end: m.index + m[0].length, text: m[1] });
  }

  if (dialogueMatches.length === 0) {
    pushNarrationSentences(results, stripped, chapterId);
    return results;
  }

  let cursor = 0;
  let orderOffset = 0;

  for (const dm of dialogueMatches) {
    if (dm.start > cursor) {
      const leading = stripped.slice(cursor, dm.start).trim();
      if (leading.length > 0) {
        pushNarrationSentences(results, leading, chapterId);
      }
    }

    results.push({
      ...createSentence(chapterId, dm.text, 'dialogue', startOrder + results.length),
    });
    orderOffset++;
    cursor = dm.end;
  }

  if (cursor < stripped.length) {
    const trailing = stripped.slice(cursor).trim();
    if (trailing.length > 0) {
      pushNarrationSentences(results, trailing, chapterId);
    }
  }

  return results;
};

const pushNarrationSentences = (
  accum: Sentence[],
  text: string,
  chapterId: string
): void => {
  if (text.length === 0) return;

  SENTENCE_END_REGEX.lastIndex = 0;
  const splitPoints: number[] = [];
  let m2: RegExpExecArray | null;
  while ((m2 = SENTENCE_END_REGEX.exec(text)) !== null) {
    splitPoints.push(m2.index + m2[0].length);
  }

  if (splitPoints.length === 0) {
    accum.push(createSentence(chapterId, text, 'narration', accum.length));
    return;
  }

  let start = 0;
  for (const p of splitPoints) {
    const frag = text.slice(start, p).trim();
    if (frag.length > 0) {
      accum.push(createSentence(chapterId, frag, 'narration', accum.length));
    }
    start = p;
  }

  if (start < text.length) {
    const frag = text.slice(start).trim();
    if (frag.length > 0) {
      accum.push(createSentence(chapterId, frag, 'narration', accum.length));
    }
  }
};
