import { useRef, useCallback, useEffect } from 'react';
import type { Sentence, CharacterVoice } from '@/types';
import { speakSentence, cancelSpeak } from './tts';

type Token = number;

export function useAutoPreview(charVoices: CharacterVoice[]) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTokenRef = useRef<Token>(0);
  const cancelPendingRef = useRef<() => void>(() => {});

  const clearPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    cancelPendingRef.current();
    cancelPendingRef.current = () => {};
  }, []);

  useEffect(() => () => clearPending(), [clearPending]);

  const schedule = useCallback(
    (sentence: Sentence, opts?: { delay?: number; onStart?: () => void; onEnd?: () => void }) => {
      if (!sentence || !sentence.text.trim()) return;

      clearPending();
      const myToken = ++playTokenRef.current;
      const delay = opts?.delay ?? 380;

      const cancelled = { v: false };
      cancelPendingRef.current = () => {
        cancelled.v = true;
        cancelSpeak();
      };

      timerRef.current = setTimeout(async () => {
        if (cancelled.v) return;
        if (myToken !== playTokenRef.current) return;
        opts?.onStart?.();
        await speakSentence(sentence, charVoices, {
          onEnd: () => opts?.onEnd?.(),
        });
      }, delay);
    },
    [charVoices, clearPending]
  );

  const stopNow = useCallback(() => {
    clearPending();
    cancelSpeak();
  }, [clearPending]);

  return { schedule, stopNow };
}
