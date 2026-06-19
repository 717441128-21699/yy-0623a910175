import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Star,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Volume2,
  ListMusic,
  BookOpenCheck,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  useAppStore,
  selectAllSentences,
} from '@/store/useAppStore';
import { CHARACTER_LIST, VOICE_STYLES, SENTENCE_TYPE_META } from '@/constants/characters';
import { cn } from '@/lib/utils';
import type { Sentence } from '@/types';
import {
  speakSentence,
  cancelSpeak,
  loadVoices,
  computeEffectiveParams,
} from '@/utils/tts';
import {
  exportDubbListJSON,
  exportDubbListCSV,
  exportDubbMarkdown,
  exportSummaryReport,
} from '@/utils/export';
import { estimateReadTime, formatDuration } from '@/utils/helpers';

export default function ExportPage() {
  const chapters = useAppStore((s) => s.chapters);
  const characterVoices = useAppStore((s) => s.characterVoices);
  const currentChapterId = useAppStore((s) => s.currentChapterId);
  const setCurrentChapter = useAppStore((s) => s.setCurrentChapter);
  const selectSentence = useAppStore((s) => s.selectSentence);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const toggleReread = useAppStore((s) => s.toggleReread);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const currentPlayingId = useAppStore((s) => s.currentPlayingId);

  const allSentences = useAppStore(selectAllSentences);
  const [ttsReady, setTtsReady] = useState(false);
  const [scope, setScope] = useState<'all' | 'chapter'>('chapter');
  const [volume, setVolume] = useState(1.0);
  const [playIndex, setPlayIndex] = useState<number>(-1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopFlagRef = useRef(false);

  useEffect(() => {
    loadVoices().then((v) => setTtsReady(v.length > 0));
    return () => {
      cancelSpeak();
      stopFlagRef.current = true;
    };
  }, []);

  const playQueue = useMemo(() => {
    let base: Sentence[];
    if (scope === 'chapter') {
      const ch = chapters.find((c) => c.id === currentChapterId);
      base = ch ? [...ch.sentences].sort((a, b) => a.order - b.order) : [];
    } else {
      base = allSentences;
    }
    return base;
  }, [scope, chapters, currentChapterId, allSentences]);

  useEffect(() => {
    if (currentPlayingId) {
      const idx = playQueue.findIndex((s) => s.id === currentPlayingId);
      if (idx >= 0) {
        setPlayIndex(idx);
        const el = scrollRef.current?.querySelector(
          `[data-play-id="${currentPlayingId}"]`
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    } else if (!isPlaying) {
      // setPlayIndex(-1);
    }
  }, [currentPlayingId, isPlaying, playQueue]);

  const playFrom = useCallback(
    async (startIndex: number) => {
      if (playQueue.length === 0 || !ttsReady) return;
      stopFlagRef.current = false;
      for (let i = startIndex; i < playQueue.length; i++) {
        if (stopFlagRef.current) break;
        const s = playQueue[i];
        setPlaying(true, s.id);
        selectSentence(s.id);
        const params = computeEffectiveParams(s, characterVoices);
        await speakSentence(s, characterVoices, {
          volume: volume * params.volume,
          onEnd: () => {},
        });
      }
      stopFlagRef.current = false;
      setPlaying(false, null);
      setPlayIndex(-1);
    },
    [playQueue, ttsReady, characterVoices, volume, selectSentence, setPlaying]
  );

  const handlePlayPause = () => {
    if (isPlaying) {
      stopFlagRef.current = true;
      cancelSpeak();
      setPlaying(false, null);
    } else {
      const start =
        playIndex >= 0 && playIndex < playQueue.length ? playIndex : 0;
      playFrom(start);
    }
  };

  const handleNext = () => {
    if (playIndex < playQueue.length - 1) {
      stopFlagRef.current = true;
      cancelSpeak();
      setTimeout(() => playFrom(playIndex + 1), 80);
    }
  };

  const handlePrev = () => {
    if (playIndex > 0) {
      stopFlagRef.current = true;
      cancelSpeak();
      setTimeout(() => playFrom(playIndex - 1), 80);
    }
  };

  const rereadCount = useMemo(
    () => allSentences.filter((s) => s.isReread).length,
    [allSentences]
  );

  const totalDuration = useMemo(() => {
    let ms = 0;
    for (const s of allSentences) {
      const params = computeEffectiveParams(s, characterVoices);
      const estimated = estimateReadTime(s.text.length, params.rate);
      ms += estimated + s.pauseBefore;
    }
    return ms;
  }, [allSentences, characterVoices]);

  const currentChapterTitle = useMemo(() => {
    const ch = chapters.find((c) => c.id === currentChapterId);
    return ch?.title || '无';
  }, [chapters, currentChapterId]);

  if (chapters.length === 0) {
    return (
      <div className="max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center py-16"
        >
          <div className="w-20 h-20 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-5">
            <Sparkles size={36} className="text-ink-300" />
          </div>
          <h2 className="font-song font-semibold text-2xl text-midnight-800 mb-2">
            先导入内容吧
          </h2>
          <p className="text-ink-500 mb-8 max-w-sm mx-auto">
            还没有章节可试听，先回到「章节导入」粘贴你的小说正文。
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 播放器栏 */}
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card !p-5"
      >
        <div className="flex flex-wrap items-center gap-6 justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-midnight-600 via-ink-500 to-ink-400 flex items-center justify-center shadow-card">
              <Volume2 size={28} className="text-white" />
              {isPlaying && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-ink-400/60"
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.6, 0.2, 0.6],
                    }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <motion.div
                    className="absolute -inset-1 rounded-full border border-midnight-500/30"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.4, 0, 0.4],
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                </>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-song font-bold text-lg text-midnight-800">
                  连续播放器
                </h2>
                {isPlaying ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-soft" />
                    正在播放
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-50 text-ink-500 border border-ink-100 font-medium">
                    准备就绪
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500">
                <div className="flex items-center gap-1.5 bg-ink-50 rounded-full px-2.5 py-1 border border-ink-100">
                  <ListMusic size={11} />
                  播放队列
                  <span className="font-bold text-midnight-700">
                    {playQueue.length}
                  </span>
                  句
                </div>
                <div className="flex items-center gap-1.5 bg-ink-50 rounded-full px-2.5 py-1 border border-ink-100">
                  <RefreshCw size={11} />
                  预计时长
                  <span className="font-bold text-midnight-700 tabular-nums">
                    {formatDuration(totalDuration)}
                  </span>
                </div>
                {playIndex >= 0 && (
                  <div className="flex items-center gap-1.5 bg-midnight-50 rounded-full px-2.5 py-1 border border-midnight-100">
                    第
                    <span className="font-bold text-midnight-700 tabular-nums">
                      {playIndex + 1}
                    </span>
                    / {playQueue.length} 句
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-ink-50 rounded-full p-1 border border-ink-100">
              <button
                onClick={() => setScope('chapter')}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-all',
                  scope === 'chapter'
                    ? 'bg-white text-midnight-700 shadow-paper'
                    : 'text-ink-500 hover:text-ink-700'
                )}
              >
                当前章
              </button>
              <button
                onClick={() => setScope('all')}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-all',
                  scope === 'all'
                    ? 'bg-white text-midnight-700 shadow-paper'
                    : 'text-ink-500 hover:text-ink-700'
                )}
              >
                全部章节
              </button>
            </div>

            <div className="flex items-center gap-2 bg-ink-50 rounded-full px-3 py-1.5 border border-ink-100">
              <Volume2 size={14} className="text-ink-500" />
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-ink-500"
              />
              <span className="text-[10px] font-mono text-ink-500 tabular-nums w-8">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={playIndex <= 0 || !ttsReady}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-ink-50 border border-ink-100 text-ink-600 hover:bg-midnight-50 hover:border-midnight-200 hover:text-midnight-700 transition-all disabled:opacity-40"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={!ttsReady || playQueue.length === 0}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card disabled:opacity-50 disabled:hover:translate-y-0',
                isPlaying
                  ? 'bg-gradient-to-br from-red-500 to-red-600'
                  : 'bg-gradient-to-br from-midnight-500 to-midnight-700'
              )}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
            <button
              onClick={handleNext}
              disabled={playIndex >= playQueue.length - 1 || !ttsReady}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-ink-50 border border-ink-100 text-ink-600 hover:bg-midnight-50 hover:border-midnight-200 hover:text-midnight-700 transition-all disabled:opacity-40"
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="btn-accent"
            >
              <Download size={17} />
              导出配音材料
            </button>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl shadow-card border border-ink-100 p-1.5 z-20"
              >
                <MenuItem
                  icon={<FileJson size={16} />}
                  title="导出 JSON"
                  desc="结构化配音数据"
                  accent="#3b82f6"
                  onClick={() => {
                    exportDubbListJSON(chapters);
                    setShowExportMenu(false);
                  }}
                />
                <MenuItem
                  icon={<FileSpreadsheet size={16} />}
                  title="导出 CSV"
                  desc="Excel 可直接打开"
                  accent="#10b981"
                  onClick={() => {
                    exportDubbListCSV(chapters);
                    setShowExportMenu(false);
                  }}
                />
                <MenuItem
                  icon={<FileText size={16} />}
                  title="导出 Markdown"
                  desc="可预览的表格文档"
                  accent="#8b5cf6"
                  onClick={() => {
                    exportDubbMarkdown(chapters);
                    setShowExportMenu(false);
                  }}
                />
                <div className="h-px bg-ink-100 my-1" />
                <MenuItem
                  icon={<BookOpenCheck size={16} />}
                  title="导出汇总报告"
                  desc="项目统计文本"
                  accent="#d97706"
                  onClick={() => {
                    exportSummaryReport(chapters);
                    setShowExportMenu(false);
                  }}
                />
              </motion.div>
            )}
          </div>
        </div>

        {playQueue.length > 0 && (
          <div className="mt-4 pt-4 border-t border-ink-100">
            <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-midnight-500 via-ink-400 to-midnight-600"
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    playIndex < 0
                      ? 0
                      : ((playIndex + 1) / playQueue.length) * 100
                  }%`,
                }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}
      </motion.section>

      {/* 章节切换 + 统计 */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 space-y-4"
        >
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-midnight-700">
                <BookOpenCheck size={18} />
                <h3 className="font-song font-semibold text-lg">章节</h3>
              </div>
              <span className="text-xs text-ink-400">
                {scope === 'chapter' ? '当前范围' : '正在播放全部'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
              {chapters.map((ch, i) => {
                const active = currentChapterId === ch.id;
                const reread = ch.sentences.filter((s) => s.isReread).length;
                const un = ch.sentences.filter((s) => !s.character).length;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setCurrentChapter(ch.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all',
                      active
                        ? 'bg-gradient-to-r from-midnight-50 to-ink-50 border-ink-400 shadow-paper'
                        : 'bg-white border-ink-100 hover:border-ink-200 hover:bg-ink-50/50'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                          active
                            ? 'bg-midnight-600 text-white'
                            : 'bg-ink-100 text-ink-600'
                        )}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-song font-medium text-sm text-midnight-800 line-clamp-1 max-w-[200px]">
                          {ch.title}
                        </p>
                        <p className="text-[10px] text-ink-500 mt-0.5">
                          {ch.wordCount.toLocaleString('zh-CN')}字 · {ch.sentences.length}句
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {reread > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 flex items-center gap-0.5">
                          <Star size={8} className="fill-current" />
                          {reread}
                        </span>
                      )}
                      {un > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-50 text-red-500 border border-red-100">
                          待配{un}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card !p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-100">
              <div className="flex items-center gap-1.5 text-amber-700 text-xs mb-1.5">
                <Star size={12} className="fill-current" />
                重读标记
              </div>
              <p className="font-song font-bold text-3xl text-amber-700 tabular-nums">
                {rereadCount}
              </p>
              <p className="text-[10px] text-amber-600/70 mt-0.5">
                需要后期重新处理的句子
              </p>
            </div>
            <div className="card !p-4 bg-gradient-to-br from-midnight-50 to-blue-50/50 border-midnight-100">
              <div className="flex items-center gap-1.5 text-midnight-700 text-xs mb-1.5">
                <CheckCircle2 size={12} />
                完成度
              </div>
              <p className="font-song font-bold text-3xl text-midnight-700 tabular-nums">
                {allSentences.length === 0
                  ? 0
                  : Math.round(
                      ((allSentences.length -
                        allSentences.filter((s) => !s.character).length) /
                        allSentences.length) *
                        100
                    )}
                <span className="text-lg">%</span>
              </p>
              <p className="text-[10px] text-midnight-600/70 mt-0.5">
                角色分配已全部完成
              </p>
            </div>
          </div>

          <div className="card !p-4">
            <h4 className="text-xs font-semibold text-midnight-700 mb-3 font-song">
              角色句数分布
            </h4>
            <div className="space-y-2">
              {CHARACTER_LIST.map((c) => {
                const cnt = allSentences.filter(
                  (s) => s.character === c.value
                ).length;
                const total = allSentences.length || 1;
                const pct = (cnt / total) * 100;
                const colorMap: Record<string, string> = {
                  male_lead: '#3b82f6',
                  female_lead: '#ec4899',
                  villain: '#dc2626',
                  narrator: '#6b7280',
                };
                return (
                  <div key={String(c.value)}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-ink-600">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: colorMap[c.value || 'narrator'] }}
                        />
                        {c.label}
                      </span>
                      <span className="font-bold tabular-nums text-midnight-700">
                        {cnt} <span className="text-ink-400 font-normal">句</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                        style={{ backgroundColor: colorMap[c.value || 'narrator'] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* 播放列表 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="xl:col-span-3 card flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-midnight-700">
              <ListMusic size={18} />
              <h3 className="font-song font-semibold text-lg">
                试听与重读标记
              </h3>
              <span className="text-[10px] text-ink-500 bg-ink-50 px-2 py-0.5 rounded-full border border-ink-100">
                点击句子可跳至此处播放
              </span>
            </div>
            {scope === 'chapter' ? (
              <div className="text-xs text-ink-500 flex items-center gap-1">
                <ChevronLeft size={12} className="rotate-180" />
                当前章：
                <span className="font-medium text-midnight-700">
                  {currentChapterTitle}
                </span>
              </div>
            ) : (
              <span className="text-xs text-midnight-700 bg-midnight-50 px-2 py-0.5 rounded-full border border-midnight-100">
                全章节顺序播放
              </span>
            )}
          </div>

          {!ttsReady && (
            <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 flex items-center gap-2">
              <AlertTriangle size={14} />
              当前浏览器未加载出可用语音，试听功能可能受限。建议使用 Chrome/Edge
              浏览器。
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto scrollbar-thin pr-2 -mr-2 space-y-1.5 max-h-[620px]"
          >
            {playQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-ink-400">
                <ListMusic size={36} className="mb-3 text-ink-300" />
                <p className="font-song mb-1">播放队列为空</p>
                <p className="text-xs">切换到「全部章节」或选择一个章节</p>
              </div>
            ) : (
              playQueue.map((s, i) => (
                <PlaylistRow
                  key={s.id}
                  s={s}
                  i={i}
                  isPlaying={currentPlayingId === s.id}
                  onClick={() => {
                    if (isPlaying) {
                      stopFlagRef.current = true;
                      cancelSpeak();
                    }
                    setTimeout(() => playFrom(i), 80);
                  }}
                  onToggleReread={() => toggleReread(s.id)}
                  charVoices={characterVoices}
                />
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  title,
  desc,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-ink-50 text-left transition-all group"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-midnight-800">{title}</p>
        <p className="text-[10px] text-ink-500">{desc}</p>
      </div>
    </button>
  );
}

function PlaylistRow({
  s,
  i,
  isPlaying,
  onClick,
  onToggleReread,
  charVoices,
}: {
  s: Sentence;
  i: number;
  isPlaying: boolean;
  onClick: () => void;
  onToggleReread: () => void;
  charVoices: ReturnType<typeof useAppStore.getState>['characterVoices'];
}) {
  const meta = SENTENCE_TYPE_META[s.type];
  const cfg = charVoices.find((c) => c.character === s.character);
  return (
    <motion.div
      data-play-id={s.id}
      layout
      onClick={onClick}
      whileHover={{ scale: 1.003 }}
      className={cn(
        'group relative flex gap-3 p-3 rounded-xl border cursor-pointer transition-all overflow-hidden',
        isPlaying
          ? 'bg-gradient-to-r from-midnight-50 via-ink-50/80 to-transparent border-ink-400 shadow-paper'
          : s.isReread
          ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
          : 'bg-white border-ink-100 hover:bg-ink-50/60 hover:border-ink-200'
      )}
    >
      {isPlaying && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 animate-pulse-soft"
          style={{ backgroundColor: cfg?.color || '#1e3a5f' }}
        />
      )}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all',
            isPlaying
              ? 'bg-midnight-600 text-white shadow-paper'
              : 'bg-ink-50 text-ink-500 border border-ink-100'
          )}
        >
          {isPlaying ? (
            <div className="flex items-end gap-0.5 h-4">
              <motion.span
                className="w-0.5 bg-white rounded-full animate-playing"
                style={{ height: '100%', animationDelay: '0s' }}
              />
              <motion.span
                className="w-0.5 bg-white rounded-full animate-playing"
                style={{ height: '100%', animationDelay: '0.15s' }}
              />
              <motion.span
                className="w-0.5 bg-white rounded-full animate-playing"
                style={{ height: '100%', animationDelay: '0.3s' }}
              />
            </div>
          ) : (
            String(i + 1).padStart(2, '0')
          )}
        </div>
        <div
          className="w-1 h-10 rounded-full"
          style={{
            backgroundColor:
              {
                title: '#a855f7',
                dialogue: '#10b981',
                narration: '#64748b',
              }[s.type] || '#64748b',
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1 mb-1">
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
              meta.color,
              'bg-white/80 border border-ink-100'
            )}
          >
            {meta.label}
          </span>
          {cfg ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
              style={{ backgroundColor: cfg.color }}
            >
              {cfg.name}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-50 text-red-500 border border-red-100">
              未分配
            </span>
          )}
          {s.voiceStyle && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-midnight-50 text-midnight-700 border border-midnight-100">
              {VOICE_STYLES.find((v) => v.value === s.voiceStyle)?.label}
            </span>
          )}
          {s.type !== 'narration' &&
            (s.rate !== 1 || s.pitch !== 1 || s.emotionLevel !== 5) && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                自定义参数
              </span>
            )}
        </div>
        <p
          className={cn(
            'leading-relaxed text-midnight-800 text-[14px]',
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
      </div>

      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleReread();
          }}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
            s.isReread
              ? 'bg-amber-100 text-amber-600 shadow-sm'
              : 'bg-white text-ink-300 border border-ink-100 opacity-0 group-hover:opacity-100 hover:bg-amber-50 hover:text-amber-500 hover:border-amber-200'
          )}
          title="重读标记"
        >
          <Star
            size={16}
            className={cn('transition-all', s.isReread && 'fill-current')}
          />
        </button>
        {s.isReread && (
          <span className="text-[9px] font-bold text-amber-600">重读</span>
        )}
      </div>
    </motion.div>
  );
}
