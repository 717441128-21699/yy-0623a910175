import type { Sentence, CharacterVoice, VoiceStyle, CharacterType } from '@/types';
import { STYLE_PARAM_MAP, CHARACTER_PARAM_MAP } from '@/constants/characters';
import { clamp } from './helpers';

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string | null;
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (ev: SpeechSynthesisEvent) => void;
  onError?: (ev: SpeechSynthesisErrorEvent) => void;
}

interface VoiceCandidate {
  voice: SpeechSynthesisVoice | null;
  score: number;
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;

export const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  if (!('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  if (cachedVoices && cachedVoices.length > 0) {
    return Promise.resolve(cachedVoices);
  }

  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length > 0) {
    cachedVoices = immediate;
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    const handler = () => {
      const v = window.speechSynthesis.getVoices();
      cachedVoices = v;
      window.speechSynthesis.onvoiceschanged = null;
      resolve(v);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    setTimeout(() => {
      const v = window.speechSynthesis.getVoices();
      cachedVoices = v;
      window.speechSynthesis.onvoiceschanged = null;
      resolve(v);
    }, 1500);
  });
};

export const getVoiceForCharacter = async (
  character: CharacterType,
  style: VoiceStyle,
  preferredURI?: string | null
): Promise<SpeechSynthesisVoice | null> => {
  const voices = await loadVoices();
  if (voices.length === 0) return null;

  if (preferredURI) {
    const pref = voices.find((v) => v.voiceURI === preferredURI);
    if (pref) return pref;
  }

  const zhVoices = voices.filter((v) => /zh|chinese|mandarin|cmn|CN/i.test(v.lang) || /zh|中文|普通话/i.test(v.name));
  const pool = zhVoices.length > 0 ? zhVoices : voices;

  const pref: VoiceCandidate[] = pool.map((v) => ({ voice: v, score: 0 }));

  if (character && character in CHARACTER_PARAM_MAP) {
    const genderPref = CHARACTER_PARAM_MAP[character as Exclude<CharacterType, null>].genderPref;
    pref.forEach((c) => {
      const n = c.voice!.name.toLowerCase();
      if (genderPref === 'male') {
        if (/male|男人|男|boy/i.test(n)) c.score += 10;
        if (/female|女人|女|girl|xiaoxiao|yaoyao/i.test(n)) c.score -= 5;
      } else if (genderPref === 'female') {
        if (/female|女人|女|girl|xiaoxiao|yaoyao/i.test(n)) c.score += 10;
        if (/male|男人|男|boy|yunxi|yunjian/i.test(n)) c.score -= 5;
      }
    });
  }

  if (style && style in STYLE_PARAM_MAP) {
    pref.forEach((c) => {
      const n = c.voice!.name.toLowerCase();
      if (style === 'youth' && /xiao|小|youth|young|child/i.test(n)) c.score += 6;
      if (style === 'steady' && /yun|云|old|mature|kang/i.test(n)) c.score += 6;
      if (style === 'cool' && /cool|ice|hi|feng|ying|mei/i.test(n)) c.score += 4;
      if (style === 'funny' && /funny|cartoon|clown|monkey|xiaoyi/i.test(n)) c.score += 4;
    });
  }

  pref.forEach((c) => {
    if (c.voice!.default) c.score += 3;
    if (c.voice!.localService) c.score += 2;
  });

  pref.sort((a, b) => b.score - a.score);
  return pref[0]?.voice || voices[0] || null;
};

export const computeEffectiveParams = (
  sentence: Sentence,
  charVoices: CharacterVoice[]
): Required<Pick<TTSOptions, 'rate' | 'pitch' | 'volume'>> => {
  let baseRate = 1.0;
  let basePitch = 1.0;
  let volume = 1.0;

  if (sentence.character && sentence.character in CHARACTER_PARAM_MAP) {
    const cp = CHARACTER_PARAM_MAP[sentence.character as Exclude<CharacterType, null>];
    baseRate = cp.baseRate;
    basePitch = cp.basePitch;
  }

  const voiceCfg = charVoices.find((c) => c.character === sentence.character);
  const effectiveStyle = sentence.voiceStyle || voiceCfg?.style;

  if (effectiveStyle && effectiveStyle in STYLE_PARAM_MAP) {
    const sp = STYLE_PARAM_MAP[effectiveStyle];
    baseRate *= sp.rate;
    basePitch *= sp.pitch;
    volume = sp.volume;
  }

  const emotion = sentence.emotionLevel || 5;
  const emotionPitchAdj = 1 + (emotion - 5) * 0.03;
  const emotionVolAdj = 1 + (emotion - 5) * 0.02;

  const rate = clamp(sentence.rate * baseRate, 0.5, 2.0);
  const pitch = clamp(sentence.pitch * basePitch * emotionPitchAdj, 0.5, 2.0);
  const finalVolume = clamp(volume * emotionVolAdj, 0.3, 1.5);

  return { rate, pitch, volume: finalVolume };
};

export const speakSentence = async (
  sentence: Sentence,
  charVoices: CharacterVoice[],
  opts: TTSOptions = {}
): Promise<void> => {
  if (!('speechSynthesis' in window)) {
    console.warn('当前浏览器不支持语音合成');
    opts.onEnd?.();
    return;
  }

  if (!sentence.text.trim()) {
    opts.onEnd?.();
    return;
  }

  return new Promise((resolve) => {
    const { rate, pitch, volume } = computeEffectiveParams(sentence, charVoices);
    const preferredURI = charVoices.find((c) => c.character === sentence.character)?.voiceURI;

    const playWithDelay = () => {
      getVoiceForCharacter(sentence.character, sentence.voiceStyle, preferredURI).then((voice) => {
        const u = new SpeechSynthesisUtterance(sentence.text);
        if (voice) u.voice = voice;
        u.lang = voice?.lang || 'zh-CN';
        u.rate = opts.rate ?? rate;
        u.pitch = opts.pitch ?? pitch;
        u.volume = opts.volume ?? volume;

        u.onstart = () => opts.onStart?.();
        u.onend = () => {
          opts.onEnd?.();
          resolve();
        };
        u.onerror = (ev) => {
          opts.onError?.(ev);
          resolve();
        };
        u.onboundary = (ev) => opts.onBoundary?.(ev);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      });
    };

    if (sentence.pauseBefore && sentence.pauseBefore > 0) {
      setTimeout(playWithDelay, sentence.pauseBefore);
    } else {
      playWithDelay();
    }
  });
};

export const cancelSpeak = (): void => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

export const pauseSpeak = (): void => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
};

export const resumeSpeak = (): void => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.resume();
  }
};

export const isTTSSupported = (): boolean => 'speechSynthesis' in window;
