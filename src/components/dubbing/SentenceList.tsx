import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CHARACTER_LIST, VOICE_STYLES, SENTENCE_TYPE_META } from '@/constants/characters';
import {
  Play,
  Pause,
  ChevronRight,
  SplitSquareVertical,
  Merge,
  Sparkles,
  User,
  Star,
  Volume2,
} from 'lucide-react';
import { useAppStore, selectCurrentChapter } from '@/store/useAppStore';
import type { Sentence, CharacterType, VoiceStyle } from '@/types';
import { speakSentence, cancelSpeak, loadVoices } from '@/utils/tts';
import { useAutoPreview } from '@/utils/useAutoPreview';
import { useState, useEffect, useRef } from 'react';

interface Props {
  onFocusSentence: (s: Sentence) => void;
}

export default function SentenceList({ onFocusSentence }: Props) {
  const cur = useAppStore(selectCurrentChapter);
  const characterVoices = useAppStore((s) => s.characterVoices);
  const updateSentence = useAppStore((s) => s.updateSentence);
  const mergeSentences = useAppStore((s) => s.mergeSentences);
  const splitSentence = useAppStore((s) => s.splitSentence);
  const selectedId = useAppStore((s) => s.selectedSentenceId);
  const selectSentence = useAppStore((s) => s.selectSentence);
  const currentPlayingId = useAppStore((s) => s.currentPlayingId);
  const setPlaying = useAppStore((s) => s.setPlaying);

  const [ttsReady, setTtsReady] = useState(false);
  const [splitTarget, setSplitTarget] = useState<string | null>(null);
  const [splitAt, setSplitAt] = useState(0);
  const [mergeMode, setMergeMode] = useState<string | null>(null);
  const [autoPreviewId, setAutoPreviewId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { schedule: scheduleAutoPreview, stopNow: stopAutoPreview } = useAutoPreview(characterVoices);

  useEffect(() => {
    loadVoices().then((v) => setTtsReady(v.length > 0));
  }, []);

  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-sid="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedId]);

  const handlePlay = async (s: Sentence) => {
    stopAutoPreview();
    if (currentPlayingId === s.id) {
      cancelSpeak();
      setPlaying(false, null);
      return;
    }
    setPlaying(true, s.id);
    await speakSentence(s, characterVoices, {
      onEnd: () => setPlaying(false, null),
    });
  };

  const handleAssign = (s: Sentence, character: CharacterType) => {
    const voiceCfg = characterVoices.find((c) => c.character === character);
    const patched: Sentence = {
      ...s,
      character,
      voiceStyle: voiceCfg?.style || s.voiceStyle,
    };
    updateSentence(s.id, {
      character,
      voiceStyle: voiceCfg?.style || s.voiceStyle,
    });
    setAutoPreviewId(s.id);
    scheduleAutoPreview(patched, {
      delay: 320,
      onEnd: () => setAutoPreviewId((id) => (id === s.id ? null : id)),
    });
  };

  const handleStyle = (s: Sentence, style: VoiceStyle) => {
    const next = style === s.voiceStyle ? null : style;
    const patched: Sentence = { ...s, voiceStyle: next };
    updateSentence(s.id, { voiceStyle: next });
    setAutoPreviewId(s.id);
    scheduleAutoPreview(patched, {
      delay: 320,
      onEnd: () => setAutoPreviewId((id) => (id === s.id ? null : id)),
    });
  };

  const confirmSplit = (s: Sentence) => {
    if (splitAt < 1 || splitAt >= s.text.length) return;
    splitSentence(s.id, splitAt);
    setSplitTarget(null);
    setSplitAt(0);
  };

  const confirmMerge = (s: Sentence) => {
    if (!cur) return;
    const sorted = cur.sentences.slice().sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    if (idx < sorted.length - 1) {
      mergeSentences(s.id, sorted[idx + 1].id);
    }
    setMergeMode(null);
  };

  if (!cur) {
    return (
      <div className="card flex items-center justify-center min-h-[500px] text-ink-400">
        <div className="text-center">
          <Sparkles size={40} className="mx-auto mb-3 text-ink-300" />
          <p className="font-song mb-1">还没有可配音的章节</p>
          <p className="text-xs">请先前往「章节导入」粘贴正文</p>
        </div>
      </div>
    );
  }

  const sorted = [...cur.sentences].sort((a, b) => a.order - b.order);
  const unassignedCount = sorted.filter((s) => !s.character).length;
  const progress =
    sorted.length === 0 ? 0 : Math.round(((sorted.length - unassignedCount) / sorted.length) * 100);

  return (
    <div className="card flex flex-col min-h-[720px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-midnight-700 mb-1.5">
            <User size={20} />
            <h2 className="font-song font-semibold text-xl">句子配音列表</h2>
          </div>
          <p className="text-xs text-ink-500">
            点击句子可展开快捷面板，分配角色与风格，红框句子尚未分配
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-ink-500">配音进度</p>
            <p className="font-song font-bold text-lg text-midnight-700">
              {progress}%
              <span className="text-xs text-ink-400 font-normal ml-1">
                ({sorted.length - unassignedCount}/{sorted.length})
              </span>
            </p>
          </div>
          <div className="w-32 h-2.5 rounded-full bg-ink-100 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-midnight-500 to-ink-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin pr-2 -mr-2 space-y-2"
      >
        {sorted.map((s, i) => {
          const meta = SENTENCE_TYPE_META[s.type];
          const isSelected = selectedId === s.id;
          const isPlaying = currentPlayingId === s.id;
          const charCfg = characterVoices.find((c) => c.character === s.character);
          const isSplit = splitTarget === s.id;
          const isMerge = mergeMode === s.id;

          return (
            <motion.div
              key={s.id}
              data-sid={s.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.01, 0.3) }}
              onClick={() => selectSentence(s.id)}
              className={cn(
                'group relative rounded-xl border transition-all cursor-pointer overflow-hidden',
                isSelected
                  ? 'border-ink-400 shadow-card bg-white'
                  : !s.character
                  ? 'border-dashed border-red-400 bg-red-50/30 hover:bg-red-50/60'
                  : 'border-ink-100 bg-white hover:border-ink-300 hover:bg-ink-50/40'
              )}
            >
              <div className="flex">
                <div
                  className={cn('w-1 flex-shrink-0', meta.dotColor)}
                  style={{ background: meta.dotColor.replace('bg-', '') }}
                />

                <div className="flex-1 p-3.5 min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-ink-50 flex items-center justify-center text-xs font-mono font-bold text-ink-500 border border-ink-100">
                      {String(i + 1).padStart(2, '0')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                            meta.color,
                            'bg-white/80 border border-ink-100'
                          )}
                        >
                          {meta.label}
                        </span>
                        {s.character && charCfg ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
                            style={{ backgroundColor: charCfg.color }}
                          >
                            <User size={9} />
                            {charCfg.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-red-500 bg-red-50 border border-red-200">
                            未分配角色
                          </span>
                        )}
                        {s.voiceStyle && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium text-midnight-700 bg-midnight-50 border border-midnight-100">
                            {VOICE_STYLES.find((v) => v.value === s.voiceStyle)?.icon}
                            {VOICE_STYLES.find((v) => v.value === s.voiceStyle)?.label}
                          </span>
                        )}
                        {s.rate !== 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md text-ink-600 bg-ink-50 border border-ink-100 font-mono">
                            {s.rate.toFixed(1)}x
                          </span>
                        )}
                        {s.isReread && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium text-ink-700 bg-ink-200">
                            <Star size={9} className="fill-current" />
                            重读
                          </span>
                        )}
                      </div>

                      {isSplit ? (
                        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                          <p className="text-xs text-yellow-700 mb-1.5">
                            移动滑块选择拆分位置：
                            <span className="font-bold ml-1">{splitAt}</span>字处
                          </p>
                          <div className="flex flex-wrap font-song text-[13px] mb-2 break-all">
                            <span className="bg-yellow-100 rounded">
                              {s.text.slice(0, splitAt)}
                            </span>
                            <span className="text-yellow-600 font-bold mx-0.5">|</span>
                            <span>{s.text.slice(splitAt)}</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={Math.max(s.text.length - 1, 1)}
                            value={splitAt}
                            onChange={(e) => setSplitAt(Number(e.target.value))}
                            className="w-full h-1.5 accent-yellow-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSplitTarget(null);
                              }}
                              className="text-xs px-3 py-1 rounded-full text-ink-600 bg-white border border-ink-200 hover:bg-ink-50"
                            >
                              取消
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmSplit(s);
                              }}
                              className="text-xs px-3 py-1 rounded-full text-white bg-yellow-500 hover:bg-yellow-600"
                            >
                              确认拆分
                            </button>
                          </div>
                        </div>
                      ) : isMerge ? (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                          <p className="text-xs text-blue-700">
                            将与下一句合并。确认执行？
                          </p>
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMergeMode(null);
                              }}
                              className="text-xs px-3 py-1 rounded-full text-ink-600 bg-white border border-ink-200 hover:bg-ink-50"
                            >
                              取消
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmMerge(s);
                              }}
                              className="text-xs px-3 py-1 rounded-full text-white bg-blue-500 hover:bg-blue-600"
                            >
                              确认合并
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <p
                        className={cn(
                          'text-midnight-800 leading-relaxed',
                          s.type === 'title'
                            ? 'font-song font-bold text-base'
                            : s.type === 'dialogue'
                            ? 'font-medium'
                            : 'font-song',
                          isPlaying && 'text-midnight-700'
                        )}
                      >
                        {s.text}
                      </p>

                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3.5 pt-3.5 border-t border-ink-100 space-y-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div>
                            <p className="text-[11px] font-medium text-ink-600 mb-1.5">
                              分配角色
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {CHARACTER_LIST.map((ch) => {
                                const active = s.character === ch.value;
                                return (
                                  <button
                                    key={String(ch.value)}
                                    onClick={() => handleAssign(s, ch.value)}
                                    className={cn(
                                      'chip',
                                      active ? 'chip-active' : 'chip-inactive'
                                    )}
                                    style={
                                      active ? { backgroundColor: ch.value === 'male_lead' ? '#3b82f6' : ch.value === 'female_lead' ? '#ec4899' : ch.value === 'villain' ? '#dc2626' : '#6b7280' } : undefined
                                    }
                                  >
                                    <span
                                      className={cn(
                                        'w-2 h-2 rounded-full',
                                        ch.dotColor
                                      )}
                                    />
                                    {ch.label}
                                  </button>
                                );
                              })}
                              {s.character && (
                                <button
                                  onClick={() => handleAssign(s, null)}
                                  className="chip chip-inactive text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-300"
                                >
                                  清除分配
                                </button>
                              )}
                            </div>
                          </div>

                          {s.character && (
                            <div>
                              <p className="text-[11px] font-medium text-ink-600 mb-1.5">
                                声音风格
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {VOICE_STYLES.map((vs) => {
                                  const active = s.voiceStyle === vs.value;
                                  return (
                                    <button
                                      key={String(vs.value)}
                                      onClick={() =>
                                        handleStyle(s, active ? null : vs.value)
                                      }
                                      className={cn(
                                        'p-2 rounded-xl border text-left transition-all',
                                        active
                                          ? 'border-ink-500 bg-ink-50 shadow-paper'
                                          : 'border-ink-100 bg-white hover:border-ink-300'
                                      )}
                                    >
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <span className="text-sm">{vs.icon}</span>
                                        <span
                                          className={cn(
                                            'text-xs font-bold',
                                            active ? 'text-ink-700' : 'text-ink-600'
                                          )}
                                        >
                                          {vs.label}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-ink-400 leading-tight line-clamp-1">
                                        {vs.desc}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSplitTarget(s.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ink-600 bg-ink-50 hover:bg-ink-100 border border-ink-100"
                              >
                                <SplitSquareVertical size={13} />
                                拆分
                              </button>
                              {i < sorted.length - 1 && (
                                <button
                                  onClick={() => setMergeMode(s.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ink-600 bg-ink-50 hover:bg-ink-100 border border-ink-100"
                                >
                                  <Merge size={13} />
                                  合并下句
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onFocusSentence(s)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-midnight-600 bg-midnight-50 hover:bg-midnight-100 border border-midnight-100"
                              >
                                详细调节
                                <ChevronRight size={13} />
                              </button>
                              <button
                                onClick={() => handlePlay(s)}
                                disabled={!ttsReady}
                                className={cn(
                                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white',
                                  isPlaying
                                    ? 'bg-role-villain hover:bg-red-600'
                                    : 'bg-gradient-to-r from-midnight-500 to-midnight-700 hover:from-midnight-600 hover:to-midnight-800'
                                )}
                              >
                                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                                {isPlaying ? '停止' : '试听'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-1 pl-2">
                      {autoPreviewId === s.id && !isPlaying && (
                        <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-midnight-600 text-white shadow-sm animate-pulse-soft">
                          <Volume2 size={10} className="animate-pulse-soft" />
                          自动预听
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlay(s);
                        }}
                        disabled={!ttsReady}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                          isPlaying
                            ? 'bg-role-villain text-white shadow-paper'
                            : autoPreviewId === s.id
                            ? 'bg-midnight-600 text-white shadow-paper ring-2 ring-midnight-300'
                            : 'bg-ink-50 text-ink-500 hover:bg-midnight-600 hover:text-white border border-ink-100'
                        )}
                      >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                      </button>
                      {!s.character && (
                        <span className="w-2 h-2 rounded-full bg-role-villain animate-pulse-soft" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isPlaying && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-midnight-500 via-ink-400 to-midnight-500 animate-pulse-soft" />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
