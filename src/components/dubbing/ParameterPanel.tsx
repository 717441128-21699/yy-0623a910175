import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  Play,
  Pause,
  Gauge,
  PauseCircle,
  Heart,
  Info,
  RotateCcw,
  Sparkles,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHARACTER_LIST, VOICE_STYLES, DEFAULT_CHARACTER_VOICES } from '@/constants/characters';
import { useAppStore, selectCurrentChapter } from '@/store/useAppStore';
import type { Sentence, CharacterType, VoiceStyle } from '@/types';
import { speakSentence, cancelSpeak, computeEffectiveParams, loadVoices } from '@/utils/tts';
import { useAutoPreview } from '@/utils/useAutoPreview';

interface Props {
  focused: Sentence | null;
}

const EMOTION_META = [
  { level: 1, label: '平淡', emoji: '😐' },
  { level: 3, label: '舒缓', emoji: '🙂' },
  { level: 5, label: '自然', emoji: '😊' },
  { level: 7, label: '投入', emoji: '😃' },
  { level: 9, label: '激昂', emoji: '🤩' },
  { level: 10, label: '极烈', emoji: '🔥' },
];

export default function ParameterPanel({ focused }: Props) {
  const cur = useAppStore(selectCurrentChapter);
  const chapters = useAppStore((s) => s.chapters);
  const characterVoices = useAppStore((s) => s.characterVoices);
  const setCharacterVoice = useAppStore((s) => s.setCharacterVoice);
  const updateSentence = useAppStore((s) => s.updateSentence);
  const bulkAssignCharacter = useAppStore((s) => s.bulkAssignCharacter);
  const selectSentence = useAppStore((s) => s.selectSentence);
  const currentPlayingId = useAppStore((s) => s.currentPlayingId);
  const setPlaying = useAppStore((s) => s.setPlaying);

  const [ttsReady, setTtsReady] = useState(false);
  const [tab, setTab] = useState<'sentence' | 'role'>('sentence');
  const [autoPreviewId, setAutoPreviewId] = useState<string | null>(null);

  const { schedule: scheduleAutoPreview, stopNow: stopAutoPreview } = useAutoPreview(characterVoices);

  useEffect(() => {
    loadVoices().then((v) => setTtsReady(v.length > 0));
  }, []);

  const sentence = focused;

  const effectiveParams = useMemo(() => {
    if (!sentence) return null;
    return computeEffectiveParams(sentence, characterVoices);
  }, [sentence, characterVoices]);

  const handleUpdate = <K extends keyof Sentence>(key: K, value: Sentence[K]) => {
    if (!sentence) return;
    const patched = { ...sentence, [key]: value };
    updateSentence(sentence.id, { [key]: value });
    if (key === 'rate' || key === 'pitch' || key === 'emotionLevel' || key === 'pauseBefore') {
      setAutoPreviewId(sentence.id);
      scheduleAutoPreview(patched as Sentence, {
        delay: 380,
        onEnd: () => setAutoPreviewId((id) => (id === sentence.id ? null : id)),
      });
    }
  };

  const handleReset = () => {
    if (!sentence) return;
    updateSentence(sentence.id, {
      rate: 1.0,
      pitch: 1.0,
      pauseBefore: 0,
      emotionLevel: 5,
    });
  };

  const handlePlay = async () => {
    if (!sentence) return;
    stopAutoPreview();
    if (currentPlayingId === sentence.id) {
      cancelSpeak();
      setPlaying(false, null);
      return;
    }
    setPlaying(true, sentence.id);
    await speakSentence(sentence, characterVoices, {
      onEnd: () => setPlaying(false, null),
    });
  };

  const handleRoleStyle = (character: CharacterType, style: VoiceStyle) => {
    const current = characterVoices.find((c) => c.character === character);
    if (!current) return;
    const nextStyle = current.style === style ? null : style;
    setCharacterVoice(character, { style: nextStyle });
    if (sentence && (sentence.character === character || !sentence.character)) {
      const patched = {
        ...sentence,
        voiceStyle: sentence.voiceStyle || nextStyle,
      };
      setAutoPreviewId(sentence.id);
      scheduleAutoPreview(patched, {
        delay: 320,
        onEnd: () => setAutoPreviewId((id) => (id === sentence.id ? null : id)),
      });
    }
  };

  const handleBulkAssign = (type: 'dialogue' | 'narration' | 'title', character: CharacterType) => {
    bulkAssignCharacter(type, character);
    if (sentence && sentence.type === type) {
      const voiceCfg = characterVoices.find((c) => c.character === character);
      const patched: Sentence = {
        ...sentence,
        character,
        voiceStyle: sentence.voiceStyle || voiceCfg?.style || null,
      };
      setTimeout(() => {
        setAutoPreviewId(sentence.id);
        scheduleAutoPreview(patched, {
          delay: 280,
          onEnd: () => setAutoPreviewId((id) => (id === sentence.id ? null : id)),
        });
      }, 60);
    }
  };

  const isPlaying = sentence && currentPlayingId === sentence.id;

  if (!cur && chapters.length === 0) {
    return (
      <div className="card h-full flex flex-col items-center justify-center min-h-[500px] text-ink-400">
        <Sparkles size={40} className="mb-3 text-ink-300" />
        <p className="font-song mb-1">请先导入章节</p>
        <p className="text-xs">导入完成后在此处配音</p>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col min-h-[720px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-midnight-700">
          <Palette size={20} />
          <h2 className="font-song font-semibold text-xl">参数调节台</h2>
        </div>
        <div className="flex bg-ink-50 rounded-full p-1 border border-ink-100">
          <button
            onClick={() => setTab('sentence')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
              tab === 'sentence'
                ? 'bg-white text-midnight-700 shadow-paper'
                : 'text-ink-500 hover:text-ink-700'
            )}
          >
            单句精细调节
          </button>
          <button
            onClick={() => setTab('role')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
              tab === 'role'
                ? 'bg-white text-midnight-700 shadow-paper'
                : 'text-ink-500 hover:text-ink-700'
            )}
          >
            角色批量设置
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'sentence' ? (
          <motion.div
            key="sentence"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="flex-1 flex flex-col"
          >
            {sentence ? (
              <>
                <div className="p-4 rounded-xl bg-gradient-to-br from-ink-50 to-midnight-50/40 border border-ink-100 mb-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-xs text-ink-500 flex items-center gap-1">
                      <Info size={12} />
                      当前调节句子
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-xs text-ink-500 hover:text-midnight-700 inline-flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      重置参数
                    </button>
                  </div>
                  <p className="font-song text-midnight-800 leading-relaxed text-[15px] mb-3">
                    「{sentence.text}」
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {sentence.character && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
                          style={{
                            backgroundColor:
                              characterVoices.find((c) => c.character === sentence.character)
                                ?.color || '#6b7280',
                          }}
                        >
                          {characterVoices.find((c) => c.character === sentence.character)?.name}
                        </span>
                      )}
                      {sentence.voiceStyle && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-midnight-700 bg-white border border-midnight-100">
                          {VOICE_STYLES.find((v) => v.value === sentence.voiceStyle)?.icon}
                          {VOICE_STYLES.find((v) => v.value === sentence.voiceStyle)?.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handlePlay}
                      disabled={!ttsReady}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-white transition-all',
                        isPlaying
                          ? 'bg-role-villain hover:bg-red-600'
                          : 'bg-gradient-to-r from-midnight-500 to-midnight-700 hover:shadow-paper hover:-translate-y-0.5'
                      )}
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                      {isPlaying ? '停止试听' : '试听本句'}
                    </button>
                  </div>
                </div>

                <div className="space-y-6 flex-1 overflow-y-auto scrollbar-thin pr-2 -mr-2">
                  <SliderBlock
                    icon={<Gauge size={15} />}
                    title="语速 Rate"
                    desc="数值越大读得越快，建议对话略快、旁白适中"
                    value={sentence.rate}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    unit="x"
                    color="#3b82f6"
                    markers={[
                      { v: 0.5, label: '极慢' },
                      { v: 1.0, label: '标准' },
                      { v: 1.5, label: '较快' },
                      { v: 2.0, label: '极快' },
                    ]}
                    effective={effectiveParams?.rate.toFixed(2)}
                    onChange={(v) => handleUpdate('rate', v)}
                  />

                  <SliderBlock
                    icon={<Volume2 size={15} />}
                    title="音调 Pitch"
                    desc="影响声音高低，女主偏高、反派可稍夸张"
                    value={sentence.pitch}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    unit=""
                    suffixLabel="倍"
                    color="#ec4899"
                    markers={[
                      { v: 0.5, label: '低沉' },
                      { v: 1.0, label: '自然' },
                      { v: 1.5, label: '高亢' },
                      { v: 2.0, label: '尖细' },
                    ]}
                    effective={effectiveParams?.pitch.toFixed(2)}
                    onChange={(v) => handleUpdate('pitch', v)}
                  />

                  <SliderBlock
                    icon={<PauseCircle size={15} />}
                    title="句前停顿"
                    desc="句子开始前的静默时间，用于场景切换或强调"
                    value={sentence.pauseBefore}
                    min={0}
                    max={3000}
                    step={100}
                    unit="ms"
                    color="#a855f7"
                    markers={[
                      { v: 0, label: '无' },
                      { v: 500, label: '短' },
                      { v: 1500, label: '中' },
                      { v: 3000, label: '长' },
                    ]}
                    onChange={(v) => handleUpdate('pauseBefore', Math.round(v))}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-midnight-700">
                        <Heart size={15} className="text-rose-500" />
                        <span className="text-sm font-semibold">情绪强度</span>
                      </div>
                      <span className="text-xs text-ink-500">
                        作用于音调微调和音量
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 mb-3">
                      {EMOTION_META.map((e) => {
                        const active = sentence.emotionLevel >= e.level;
                        const exact = sentence.emotionLevel === e.level;
                        return (
                          <button
                            key={e.level}
                            onClick={() => handleUpdate('emotionLevel', e.level)}
                            className={cn(
                              'p-2 rounded-xl border text-center transition-all',
                              exact
                                ? 'border-rose-400 bg-rose-50 shadow-paper -translate-y-0.5'
                                : active
                                ? 'border-rose-200 bg-rose-50/50'
                                : 'border-ink-100 bg-white hover:border-ink-200'
                            )}
                          >
                            <div className="text-lg leading-none mb-1">{e.emoji}</div>
                            <div className="text-[10px] font-medium text-ink-600">{e.label}</div>
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={sentence.emotionLevel}
                      onChange={(e) =>
                        handleUpdate('emotionLevel', Number(e.target.value))
                      }
                      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-rose-500"
                      style={{
                        background: `linear-gradient(to right, #fecdd3 ${
                          ((sentence.emotionLevel - 1) / 9) * 100
                        }%, #f1f5f9 ${((sentence.emotionLevel - 1) / 9) * 100}%)`,
                      }}
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-ink-400">
                      <span>压抑克制</span>
                      <span className="font-medium text-rose-500">
                        Lv.{sentence.emotionLevel}
                      </span>
                      <span>爆发释放</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-ink-400 py-12">
                <div className="w-20 h-20 rounded-full bg-ink-50 flex items-center justify-center mb-4">
                  <Gauge size={32} className="text-ink-300" />
                </div>
                <p className="font-song text-ink-500 mb-1">尚未选择句子</p>
                <p className="text-xs max-w-[260px]">
                  在左侧句子列表中点击任意一句，即可在此处精细调节语速、停顿、情绪等参数
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="role"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="flex-1 overflow-y-auto scrollbar-thin pr-2 -mr-2 space-y-4"
          >
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
              💡 在这里为每种角色选择默认的声音风格，或一键将某类型句子批量分配给指定角色。
            </div>

            {CHARACTER_LIST.map((ch) => {
              const cfg =
                characterVoices.find((c) => c.character === ch.value) ||
                DEFAULT_CHARACTER_VOICES.find((c) => c.character === ch.value)!;
              return (
                <div
                  key={String(ch.value)}
                  className="p-4 rounded-xl border border-ink-100 bg-gradient-to-br from-white to-ink-50/40"
                  style={{ borderColor: cfg.color + '40' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                        style={{ backgroundColor: cfg.color }}
                      >
                        {cfg.name.slice(0, 1)}
                      </span>
                      <div>
                        <p className="font-song font-semibold text-midnight-800">{cfg.name}</p>
                        <p className="text-[10px] text-ink-500">
                          共{' '}
                          <span className="font-bold">
                            {chapters.reduce(
                              (a, cc) =>
                                a + cc.sentences.filter((s) => s.character === ch.value).length,
                              0
                            )}
                          </span>{' '}
                          句
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium text-ink-600 mb-1.5">默认声音风格</p>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {VOICE_STYLES.map((vs) => {
                      const active = cfg.style === vs.value;
                      return (
                        <button
                          key={String(vs.value)}
                          onClick={() => handleRoleStyle(ch.value, vs.value)}
                          className={cn(
                            'p-1.5 rounded-lg border text-center transition-all',
                            active
                              ? 'shadow-paper border-transparent text-white'
                              : 'bg-white border-ink-100 hover:border-ink-300 text-ink-600'
                          )}
                          style={active ? { backgroundColor: cfg.color } : undefined}
                        >
                          <div className="text-sm leading-none mb-0.5">{vs.icon}</div>
                          <div className="text-[10px] font-medium">{vs.label}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] font-medium text-ink-600 mb-1.5">批量分配</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { t: 'dialogue' as const, label: '所有对话' },
                      { t: 'narration' as const, label: '所有旁白' },
                      { t: 'title' as const, label: '所有标题' },
                    ].map((m) => (
                      <button
                        key={m.t}
                        onClick={() => handleBulkAssign(m.t, ch.value)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-ink-200 bg-white text-ink-600 hover:border-transparent hover:text-white transition-all"
                        style={{
                          ['--hbg' as any]: cfg.color,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = cfg.color;
                          (e.currentTarget as HTMLElement).style.color = '#fff';
                          (e.currentTarget as HTMLElement).style.borderColor = cfg.color;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = '';
                          (e.currentTarget as HTMLElement).style.color = '';
                          (e.currentTarget as HTMLElement).style.borderColor = '';
                        }}
                      >
                        → {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="p-4 rounded-xl bg-midnight-600/5 border border-midnight-100 space-y-2">
              <p className="text-sm font-semibold text-midnight-700 font-song">快捷操作</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (!cur) return;
                    const first = [...cur.sentences].sort((a, b) => a.order - b.order)[0];
                    if (first) selectSentence(first.id);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-white border border-midnight-200 text-midnight-700 hover:bg-midnight-50"
                >
                  选中首句开始调节
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SliderBlockProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  markers: { v: number; label: string }[];
  onChange: (v: number) => void;
  effective?: string;
  suffixLabel?: string;
}

function SliderBlock({
  icon,
  title,
  desc,
  value,
  min,
  max,
  step,
  unit,
  color,
  markers,
  onChange,
  effective,
  suffixLabel,
}: SliderBlockProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-midnight-700">
          <span style={{ color }}>{icon}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="font-song font-bold text-lg tabular-nums"
            style={{ color }}
          >
            {typeof value === 'number' && step >= 1 ? value : value.toFixed(2)}
            <span className="text-xs font-normal ml-0.5 text-ink-400">
              {suffixLabel || unit}
            </span>
          </span>
          {effective && effective !== String(value.toFixed(2)) && (
            <span className="text-[10px] text-ink-400 ml-2">
              综合 {effective}
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-ink-500 mb-3 pl-6">{desc}</p>
      <div className="relative pl-2 pr-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} ${pct}%, #f1f5f9 ${pct}%)`,
            accentColor: color,
          }}
        />
        <div className="flex justify-between mt-1.5 px-0.5">
          {markers.map((m) => (
            <div key={m.v} className="flex flex-col items-center gap-0.5">
              <div
                className="w-px h-1.5 rounded-full"
                style={{
                  backgroundColor: value >= m.v ? color : '#e5d7c3',
                  opacity: value >= m.v ? 1 : 0.5,
                }}
              />
              <span className="text-[9px] text-ink-400 tabular-nums whitespace-nowrap">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
