import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Package,
  FileText,
  FileJson,
  FileSpreadsheet,
  Star,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FolderOpen,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chapter, CharacterVoice } from '@/types';
import {
  computeDeliverySummary,
  exportDeliveryPackage,
  type DeliveryOptions,
  type DeliverySummary,
} from '@/utils/export';
import { formatDuration } from '@/utils/helpers';

interface Props {
  open: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterId: string | null;
  currentChapterTitle: string;
  characterVoices: CharacterVoice[];
}

interface UnassignedGuardProps {
  unassignedCount: number;
  onContinue: (excludeUnassigned: boolean) => void;
  onCancel: () => void;
  onGoDubbing: () => void;
}

function UnassignedGuard({
  unassignedCount,
  onContinue,
  onCancel,
  onGoDubbing,
}: UnassignedGuardProps) {
  const [exclude, setExclude] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-white rounded-2xl shadow-card border border-ink-100 p-6 w-full max-w-md mx-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={22} className="text-amber-600" />
        </div>
        <div>
          <h3 className="font-song font-bold text-lg text-midnight-800 mb-1">
            还有 {unassignedCount} 句未分配角色
          </h3>
          <p className="text-sm text-ink-500 leading-relaxed">
            未分配角色的句子可能导致样音中这些句子使用默认旁白音色。请选择如何处理：
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-ink-50 border border-ink-100 cursor-pointer hover:border-ink-300 transition-all mb-3">
        <input
          type="radio"
          name="guard"
          checked={!exclude}
          onChange={() => setExclude(false)}
          className="mt-1 accent-midnight-600"
        />
        <div>
          <p className="text-sm font-medium text-midnight-800">继续导出（未完成版）</p>
          <p className="text-xs text-ink-500 mt-0.5">
            保留所有句子，未分配句子仍会用默认旁白音色朗读，适合自己预览
          </p>
        </div>
      </label>

      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-100 cursor-pointer hover:border-emerald-300 transition-all mb-4">
        <input
          type="radio"
          name="guard"
          checked={exclude}
          onChange={() => setExclude(true)}
          className="mt-1 accent-emerald-600"
        />
        <div>
          <p className="text-sm font-medium text-emerald-800">
            排除未分配句子后再导出
            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">
              <Sparkles size={9} />
              推荐
            </span>
          </p>
          <p className="text-xs text-emerald-700/80 mt-0.5">
            自动跳过所有未分配角色的句子，交付成品更干净
          </p>
        </div>
      </label>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onCancel}
          className="flex-1 btn-secondary !py-2.5 text-sm"
        >
          <X size={15} />
          取消导出
        </button>
        <button
          onClick={onGoDubbing}
          className="flex-1 btn-secondary !py-2.5 text-sm !border-midnight-300 !text-midnight-700"
        >
          去补齐角色
        </button>
        <button
          onClick={() => onContinue(exclude)}
          className="flex-[1.2] btn-primary !py-2.5 text-sm"
        >
          <CheckCircle2 size={15} />
          确认导出
        </button>
      </div>
    </motion.div>
  );
}

export default function DeliveryDialog({
  open,
  onClose,
  chapters,
  currentChapterId,
  currentChapterTitle,
  characterVoices,
}: Props) {
  const defaultProjectName = useMemo(() => {
    const first = chapters[0]?.title?.replace(/[\\/:*?"<>|]/g, '_') || '我的网文样音';
    const base = first.slice(0, 18);
    const date = new Date();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${base}_${mm}${dd}`;
  }, [chapters]);

  const [projectName, setProjectName] = useState(defaultProjectName);
  const [scope, setScope] = useState<'current' | 'all'>(
    chapters.length > 1 ? 'all' : 'current'
  );
  const [includeReread, setIncludeReread] = useState(true);
  const [excludeUnassigned, setExcludeUnassigned] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState(0);
  const [exportedFiles, setExportedFiles] = useState<string[] | null>(null);
  const [showGuard, setShowGuard] = useState<null | { count: number }>(null);
  const [pendingOptions, setPendingOptions] = useState<DeliveryOptions | null>(null);

  useEffect(() => {
    if (open) {
      setProjectName(defaultProjectName);
      setScope(chapters.length > 1 ? 'all' : 'current');
      setIncludeReread(true);
      setExcludeUnassigned(false);
      setExportedFiles(null);
      setExporting(false);
      setExportStep(0);
      setShowGuard(null);
    }
  }, [open, defaultProjectName, chapters.length]);

  const buildOpts = (): DeliveryOptions => ({
    projectName: projectName.trim() || '我的网文样音',
    scope,
    includeRereadTags: includeReread,
    excludeUnassigned,
    chapters,
    currentChapterId,
    characterVoices,
  });

  const summary: DeliverySummary | null = useMemo(() => {
    if (!open) return null;
    return computeDeliverySummary(buildOpts());
  }, [open, projectName, scope, includeReread, excludeUnassigned, chapters, currentChapterId, characterVoices]);

  const FILES_PREVIEW = [
    {
      key: 'audio',
      icon: Volume2,
      color: '#1e3a5f',
      suffix: '_有声样音.html',
      desc: '可直接播放的独立样音，双击打开即用',
    },
    {
      key: 'json',
      icon: FileJson,
      color: '#3b82f6',
      suffix: '_配音清单.json',
      desc: '结构化数据，便于后续制作流水线导入',
    },
    {
      key: 'csv',
      icon: FileSpreadsheet,
      color: '#10b981',
      suffix: '_配音清单.csv',
      desc: 'Excel / WPS 可直接打开查阅',
    },
    {
      key: 'md',
      icon: FileText,
      color: '#8b5cf6',
      suffix: '_配音清单.md',
      desc: 'Markdown 排版表格，编辑器内友好预览',
    },
    {
      key: 'reread',
      icon: Star,
      color: '#f59e0b',
      suffix: '_重读句清单.md',
      desc: '仅包含重读标记句，便于针对性重录',
    },
    {
      key: 'readme',
      icon: FolderOpen,
      color: '#6b7280',
      suffix: '_交付说明.txt',
      desc: '文件说明 + 使用指南 + 项目摘要',
    },
  ];

  const totalUnassigned = summary?.unassignedCount ?? 0;

  const startExport = async (opts: DeliveryOptions) => {
    setExporting(true);
    setExportStep(1);
    try {
      const safeName = (opts.projectName || '我的网文样音').replace(/[\\/:*?"<>|]/g, '_');
      const totalSteps = 6;
      const stepDelay = 180;
      const result = await exportDeliveryPackage({
        ...opts,
        projectName: safeName,
      });
      for (let i = 1; i <= totalSteps; i++) {
        await new Promise((r) => setTimeout(r, stepDelay));
        setExportStep(i + 1);
      }
      setExportedFiles(result.files);
    } finally {
      setExporting(false);
    }
  };

  const handleSubmit = () => {
    const opts = buildOpts();
    const unassigned = computeDeliverySummary(opts).unassignedCount;
    if (unassigned > 0 && !excludeUnassigned) {
      setPendingOptions(opts);
      setShowGuard({ count: unassigned });
      return;
    }
    startExport(opts);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-900/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <AnimatePresence mode="wait">
            {showGuard ? (
              <UnassignedGuard
                key="guard"
                unassignedCount={showGuard.count}
                onCancel={() => {
                  setShowGuard(null);
                  setPendingOptions(null);
                }}
                onGoDubbing={() => {
                  setShowGuard(null);
                  setPendingOptions(null);
                  onClose();
                  const e = new CustomEvent('navigate-dubbing');
                  window.dispatchEvent(e);
                }}
                onContinue={(shouldExclude) => {
                  const opts = {
                    ...(pendingOptions || buildOpts()),
                    excludeUnassigned: shouldExclude,
                  };
                  setExcludeUnassigned(shouldExclude);
                  setShowGuard(null);
                  setPendingOptions(null);
                  startExport(opts);
                }}
              />
            ) : (
              <motion.div
                key="main"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-2xl shadow-card border border-ink-100 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 bg-gradient-to-r from-midnight-50 to-ink-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-midnight-600 to-ink-500 flex items-center justify-center text-white shadow-paper">
                      <Package size={18} />
                    </div>
                    <div>
                      <h2 className="font-song font-bold text-xl text-midnight-800">
                        导出交付包
                      </h2>
                      <p className="text-xs text-ink-500">
                        一次性导出样音、配音清单、重读列表共 6 个文件
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-midnight-700 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-5">
                  {exportedFiles ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8"
                    >
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.08, type: 'spring', stiffness: 200 }}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-card"
                      >
                        <CheckCircle2 size={40} className="text-white" />
                      </motion.div>
                      <h3 className="font-song font-bold text-2xl text-midnight-800 mb-1.5">
                        交付包导出成功！
                      </h3>
                      <p className="text-sm text-ink-500 mb-6 max-w-md mx-auto">
                        共 {exportedFiles.length} 个文件已开始下载，请查看浏览器下载列表。
                        可直接打包成压缩包分发给读者或制作人员。
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-w-lg mx-auto mb-6">
                        {exportedFiles.map((f, i) => (
                          <motion.div
                            key={f}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + i * 0.06 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ink-50 border border-ink-100 text-left"
                          >
                            <ListChecks size={13} className="text-emerald-500 flex-shrink-0" />
                            <span className="text-xs text-ink-700 font-mono truncate">
                              {f}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                      <button onClick={onClose} className="btn-primary !px-8">
                        <CheckCircle2 size={16} />
                        完成
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-midnight-700">
                            项目 / 交付包名称
                          </label>
                          <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="input-field text-sm !py-2.5 font-song"
                            placeholder="如：风起青萍_第1-3章"
                          />
                          <p className="text-[10px] text-ink-400">
                            所有导出文件将以此名称为前缀，建议包含章范围
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-midnight-700">
                            导出范围
                          </label>
                          <div className="flex bg-ink-50 rounded-xl p-1 border border-ink-100">
                            <button
                              onClick={() => setScope('current')}
                              className={cn(
                                'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                                scope === 'current'
                                  ? 'bg-white text-midnight-700 shadow-paper'
                                  : 'text-ink-500 hover:text-ink-700'
                              )}
                            >
                              仅当前章节
                              <span className="block text-[9px] text-ink-400 font-normal mt-0.5">
                                {currentChapterTitle || '未选择'}
                              </span>
                            </button>
                            <button
                              onClick={() => setScope('all')}
                              disabled={chapters.length <= 1}
                              className={cn(
                                'flex-1 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                                scope === 'all'
                                  ? 'bg-white text-midnight-700 shadow-paper'
                                  : 'text-ink-500 hover:text-ink-700'
                              )}
                            >
                              全部章节
                              <span className="block text-[9px] text-ink-400 font-normal mt-0.5">
                                共 {chapters.length} 章
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ToggleRow
                          icon={<Star size={14} />}
                          title="在文件中包含重读标记"
                          desc="配音清单中保留⭐标签，独立生成重读句列表"
                          checked={includeReread}
                          onChange={setIncludeReread}
                          accent="#f59e0b"
                        />
                        <ToggleRow
                          icon={<AlertTriangle size={14} />}
                          title="跳过未分配角色的句子"
                          desc={
                            totalUnassigned > 0
                              ? `当前范围共 ${totalUnassigned} 句未分配，勾选后导出时会排除`
                              : '当前所有句子均已分配角色'
                          }
                          checked={excludeUnassigned}
                          onChange={setExcludeUnassigned}
                          accent="#10b981"
                          disabled={totalUnassigned === 0}
                        />
                      </div>

                      {summary && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-ink-100 bg-gradient-to-br from-ink-50/60 via-white to-midnight-50/40 p-4"
                        >
                          <div className="flex items-center justify-between mb-3.5">
                            <div className="flex items-center gap-2 text-midnight-700">
                              <Sparkles size={15} className="text-ink-500" />
                              <h3 className="text-sm font-bold">导出内容摘要</h3>
                            </div>
                            {totalUnassigned > 0 && !excludeUnassigned ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                                <AlertTriangle size={10} />
                                含 {totalUnassigned} 句未分配
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                                <CheckCircle2 size={10} />
                                就绪
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
                            <SummaryCell label="章节数" value={summary.chapterCount + '章'} icon="📚" />
                            <SummaryCell
                              label="句子"
                              value={summary.sentenceCount.toLocaleString()}
                              icon="💬"
                            />
                            <SummaryCell
                              label="字数"
                              value={summary.wordCount.toLocaleString()}
                              icon="✍️"
                            />
                            <SummaryCell
                              label="重读"
                              value={summary.rereadCount + '句'}
                              icon="⭐"
                              highlight={summary.rereadCount > 0 ? '#f59e0b' : undefined}
                            />
                            <SummaryCell
                              label="未分配"
                              value={
                                excludeUnassigned
                                  ? '0句 (已排除)'
                                  : summary.unassignedCount + '句'
                              }
                              icon="🔖"
                              danger={summary.unassignedCount > 0 && !excludeUnassigned}
                            />
                            <SummaryCell
                              label="预计时长"
                              value={formatDuration(summary.estimatedDurationMs)}
                              icon={<Clock size={12} />}
                              highlight="#1e3a5f"
                            />
                          </div>
                          {summary.chapterTitles.length > 0 && (
                            <div className="mt-3.5 pt-3 border-t border-ink-100/70">
                              <p className="text-[10px] text-ink-400 mb-1.5">包含章节：</p>
                              <div className="flex flex-wrap gap-1.5">
                                {summary.chapterTitles.map((t, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-ink-100 text-ink-600 font-song"
                                  >
                                    {i + 1}. {t.length > 18 ? t.slice(0, 18) + '…' : t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}

                      <div>
                        <h3 className="text-xs font-bold text-midnight-700 mb-2.5 flex items-center gap-2">
                          <FolderOpen size={13} />
                          将生成以下 6 个文件
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {FILES_PREVIEW.map((f, i) => {
                            const name =
                              (projectName.trim() || '我的网文样音').replace(
                                /[\\/:*?"<>|]/g,
                                '_'
                              ) + f.suffix;
                            const step = i + 1;
                            const done = exporting && exportStep > step;
                            const now = exporting && exportStep === step;
                            return (
                              <div
                                key={f.key}
                                className={cn(
                                  'flex items-center gap-3 p-2.5 rounded-xl border transition-all',
                                  done
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : now
                                    ? 'bg-midnight-50 border-midnight-300 shadow-paper -translate-y-0.5'
                                    : 'bg-white border-ink-100'
                                )}
                              >
                                <div
                                  className={cn(
                                    'w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0',
                                    done ? 'bg-emerald-500' : 'opacity-90'
                                  )}
                                  style={{
                                    backgroundColor: done ? undefined : f.color,
                                  }}
                                >
                                  {done ? (
                                    <CheckCircle2 size={16} />
                                  ) : (
                                    <f.icon size={15} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-midnight-800 font-mono truncate">
                                    {name}
                                  </p>
                                  <p className="text-[10px] text-ink-500 leading-tight mt-0.5">
                                    {f.desc}
                                  </p>
                                </div>
                                {now && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-midnight-600 text-white font-medium animate-pulse-soft">
                                    生成中…
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {!exportedFiles && (
                  <div className="px-6 py-4 border-t border-ink-100 bg-ink-50/30 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-ink-500 max-w-md">
                      💡 由于浏览器安全限制，样音以独立可播放 HTML 形式提供，双击即用，所有数据完全离线。
                    </p>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <button onClick={onClose} className="btn-secondary !py-2.5 text-sm">
                        取消
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={
                          exporting ||
                          !summary ||
                          summary.chapterCount === 0 ||
                          summary.sentenceCount === 0
                        }
                        className="btn-primary !py-2.5 text-sm !px-6"
                      >
                        {exporting ? (
                          <>
                            <motion.div
                              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.8,
                                ease: 'linear',
                              }}
                            />
                            正在打包 {exportStep}/6
                          </>
                        ) : (
                          <>
                            <Package size={15} />
                            开始生成交付包
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}

function ToggleRow({
  icon,
  title,
  desc,
  checked,
  onChange,
  accent,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
        disabled
          ? 'bg-ink-50 border-ink-100 opacity-60 cursor-not-allowed'
          : checked
          ? 'bg-white shadow-paper border-transparent ring-2'
          : 'bg-white border-ink-100 hover:border-ink-300 hover:bg-ink-50/40'
      )}
      style={{ ['--ac' as any]: accent, boxShadow: checked ? undefined : undefined, ['--tw-ring-color' as any]: checked ? accent + '40' : undefined }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
        style={{ backgroundColor: accent, opacity: disabled ? 0.4 : 1 }}
      >
        {icon}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-sm font-semibold text-midnight-800">{title}</p>
        <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <div
        className={cn(
          'relative w-10 h-6 rounded-full transition-all flex-shrink-0 mt-1',
          disabled ? 'bg-ink-200' : checked ? 'bg-opacity-100' : 'bg-ink-200'
        )}
        style={{ backgroundColor: checked && !disabled ? accent : undefined }}
      >
        <div
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </div>
      <input
        type="checkbox"
        className="hidden"
        checked={checked}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
      />
    </label>
  );
}

function SummaryCell({
  label,
  value,
  icon,
  highlight,
  danger,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        'px-3 py-2.5 rounded-xl bg-white border',
        danger ? 'border-amber-200 bg-amber-50/40' : 'border-ink-100'
      )}
    >
      <div className="flex items-center gap-1 text-[10px] text-ink-500 mb-0.5">
        <span className="text-[11px] leading-none">{icon}</span>
        {label}
      </div>
      <p
        className={cn(
          'font-song font-bold text-sm tabular-nums leading-tight',
          danger ? 'text-amber-700' : highlight ? 'text-midnight-800' : 'text-midnight-700'
        )}
        style={highlight && !danger ? { color: highlight } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
