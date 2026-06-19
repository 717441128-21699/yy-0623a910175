import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, AlertTriangle, CheckCircle2, List, Wand2 } from 'lucide-react';
import SentenceList from '@/components/dubbing/SentenceList';
import ParameterPanel from '@/components/dubbing/ParameterPanel';
import {
  useAppStore,
  selectCurrentChapter,
  selectAllSentences,
  selectUnassignedCount,
} from '@/store/useAppStore';
import type { Sentence } from '@/types';
import { cn } from '@/lib/utils';

export default function DubbingPage() {
  const navigate = useNavigate();
  const chapters = useAppStore((s) => s.chapters);
  const currentChapterId = useAppStore((s) => s.currentChapterId);
  const setCurrentChapter = useAppStore((s) => s.setCurrentChapter);
  const cur = useAppStore(selectCurrentChapter);
  const all = useAppStore(selectAllSentences);
  const unassigned = useAppStore(selectUnassignedCount);
  const selectedSentenceId = useAppStore((s) => s.selectedSentenceId);

  const [focused, setFocused] = useState<Sentence | null>(null);

  useEffect(() => {
    const match = all.find((s) => s.id === selectedSentenceId);
    setFocused(match || null);
  }, [selectedSentenceId, all]);

  const stats = useMemo(() => {
    const total = all.length;
    const assigned = total - unassigned;
    const dialogue = all.filter((s) => s.type === 'dialogue').length;
    const dialogueAssigned = all.filter(
      (s) => s.type === 'dialogue' && s.character
    ).length;
    const reread = all.filter((s) => s.isReread).length;
    return { total, assigned, dialogue, dialogueAssigned, reread };
  }, [all, unassigned]);

  const canProceed = stats.assigned === stats.total && stats.total > 0;

  if (chapters.length === 0) {
    return (
      <div className="max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center py-16"
        >
          <div className="w-20 h-20 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-5">
            <List size={36} className="text-ink-300" />
          </div>
          <h2 className="font-song font-semibold text-2xl text-midnight-800 mb-2">
            先导入一些内容吧
          </h2>
          <p className="text-ink-500 mb-8 max-w-sm mx-auto">
            还没有可配音的章节，回到「章节导入」页面粘贴你的小说正文，再来配音。
          </p>
          <button
            onClick={() => navigate('/import')}
            className="btn-primary"
          >
            <Wand2 size={18} />
            前往章节导入
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card !p-4 flex flex-wrap items-center gap-4 justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex bg-ink-50 rounded-xl border border-ink-100 p-1 overflow-x-auto max-w-md">
            {chapters.map((ch, i) => {
              const active = currentChapterId === ch.id;
              const cu = ch.sentences.filter((s) => !s.character).length;
              return (
                <button
                  key={ch.id}
                  onClick={() => setCurrentChapter(ch.id)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-white text-midnight-700 shadow-paper'
                      : 'text-ink-500 hover:text-midnight-700'
                  )}
                >
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">
                    {i + 1}
                  </span>
                  <span className="line-clamp-1 max-w-[140px]">{ch.title}</span>
                  {cu > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                      {cu}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs">
            <StatPill
              label="总句数"
              value={stats.total}
              color="#1e3a5f"
            />
            <StatPill
              label="已分配"
              value={stats.assigned}
              color="#10b981"
              suffix={`/${stats.total}`}
            />
            <StatPill
              label="对话待分配"
              value={stats.dialogue - stats.dialogueAssigned}
              color="#f59e0b"
            />
            <StatPill label="重读标记" value={stats.reread} color="#8b5cf6" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!canProceed ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              <AlertTriangle size={13} />
              还有 {unassigned} 句未分配角色
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <CheckCircle2 size={13} />
              所有句子均已配音完成
            </div>
          )}
          <button
            onClick={() => navigate('/export')}
            className="btn-accent"
            disabled={!canProceed}
          >
            前往试听导出
            <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="xl:col-span-3"
        >
          <SentenceList
            onFocusSentence={(s) => {
              useAppStore.getState().selectSentence(s.id);
            }}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="xl:col-span-2"
        >
          <ParameterPanel focused={focused} />
        </motion.div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-ink-100">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-ink-500">{label}</span>
      <span className="font-bold tabular-nums" style={{ color }}>
        {value}
        {suffix && <span className="text-ink-400 font-normal ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}
