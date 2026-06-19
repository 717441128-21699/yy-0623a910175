import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Wand2,
  ChevronRight,
  Trash2,
  Plus,
  Sparkles,
  BookOpenCheck,
  List,
} from 'lucide-react';
import { useAppStore, selectCurrentChapter } from '@/store/useAppStore';
import { SENTENCE_TYPE_META } from '@/constants/characters';
import type { Sentence } from '@/types';
import { cn } from '@/lib/utils';

const SAMPLE_TEXT = `第一章 风起青萍

夜色如墨，金陵城内灯火阑珊。

"你说什么？"沈惊鸿猛地站起身来，袍袖带倒了案上的青瓷茶盏。茶水溅湿了他素白的衣襟，他却浑然不觉，目光如剑地盯着阶前跪报的斥候，"再说一遍！"

"回、回将军……"斥候浑身颤抖，牙关打战，"京中传来消息，三日前……丞相大人他，他已于府中自缢身亡，阖府上下……无一生还。"

恍若惊雷炸响在耳畔，沈惊鸿踉跄后退一步，扶住廊柱才勉强站稳。廊外，漫天飞雪无声落下，将这山河大地，都裹上了一层肃杀的苍白。

"好……好一个帝王心术！"他仰头大笑，笑声中却满是血泪，"飞鸟尽，良弓藏。沈某征战十载，换回的，竟就是这般下场？"

风更急了。远处的群山，在风雪中沉默如巨兽。`;

export default function ImportPage() {
  const navigate = useNavigate();
  const addChapter = useAppStore((s) => s.addChapter);
  const chapters = useAppStore((s) => s.chapters);
  const currentChapterId = useAppStore((s) => s.currentChapterId);
  const setCurrentChapter = useAppStore((s) => s.setCurrentChapter);
  const removeChapter = useAppStore((s) => s.removeChapter);
  const clearAll = useAppStore((s) => s.clearAll);
  const cur = useAppStore(selectCurrentChapter);

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    if (!currentChapterId && chapters.length > 0) {
      setCurrentChapter(chapters[0].id);
    }
  }, [chapters, currentChapterId, setCurrentChapter]);

  const handleLoadSample = () => {
    setTitle('第一章 风起青萍');
    setText(SAMPLE_TEXT);
  };

  const handleImport = () => {
    if (!text.trim()) return;
    addChapter(title, text);
    setTitle('');
    setText('');
  };

  const handleClear = () => {
    clearAll();
    setShowConfirmClear(false);
  };

  const typeCount = (type: Sentence['type']) =>
    cur ? cur.sentences.filter((s) => s.type === type).length : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* 左：输入区 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="xl:col-span-3 space-y-5"
      >
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-midnight-700 mb-1">
                <FileText size={20} />
                <h2 className="font-song font-semibold text-xl">粘贴小说正文</h2>
              </div>
              <p className="text-sm text-ink-500">
                将章节内容粘贴至此，系统将自动识别标题、对话与旁白，完成智能分段。
              </p>
            </div>
            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-ink-600 border border-ink-200 bg-ink-50 hover:bg-ink-100 hover:border-ink-400 transition-all"
            >
              <Sparkles size={13} />
              载入示例
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">
                章节标题 <span className="text-ink-400">(可选，留空将自动识别)</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="如：第一章 风起青萍"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">
                章节正文
              </label>
              <div className="relative">
                <textarea
                  className="input-field min-h-[340px] resize-y font-song text-[15px] leading-relaxed bg-[#fdfaf5]"
                  placeholder='在此粘贴小说正文，对话请用引号「」或""包裹……'
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="absolute bottom-3 right-3 text-xs text-ink-400 font-mono">
                  {text.length.toLocaleString('zh-CN')} 字
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-ink-100">
            <div className="text-xs text-ink-400">
              提示：对话需使用「」或""包裹，系统自动判定为角色台词
            </div>
            <div className="flex items-center gap-3">
              {chapters.length > 0 && (
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="btn-secondary !py-2 !px-4 text-sm"
                >
                  <Trash2 size={15} />
                  清空全部
                </button>
              )}
              <button
                onClick={handleImport}
                disabled={!text.trim()}
                className="btn-primary"
              >
                <Wand2 size={17} />
                智能分段并导入
              </button>
            </div>
          </div>
        </div>

        {/* 章节管理 */}
        {chapters.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-midnight-700">
                <List size={19} />
                <h3 className="font-song font-semibold text-lg">已导入章节</h3>
                <span className="text-xs font-medium text-ink-500 bg-ink-100 px-2 py-0.5 rounded-full">
                  {chapters.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/dubbing')}
                className="btn-accent !py-2 !px-4 text-sm"
              >
                进入角色配音
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {chapters.map((ch, i) => (
                <div
                  key={ch.id}
                  onClick={() => setCurrentChapter(ch.id)}
                  className={cn(
                    'group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                    currentChapterId === ch.id
                      ? 'bg-gradient-to-r from-midnight-50 to-ink-50 border-ink-400 shadow-paper'
                      : 'bg-white border-ink-100 hover:border-ink-300 hover:bg-ink-50/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                        currentChapterId === ch.id
                          ? 'bg-midnight-600 text-white'
                          : 'bg-ink-100 text-ink-600'
                      )}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-song font-medium text-midnight-800 line-clamp-1">
                        {ch.title}
                      </p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {ch.wordCount.toLocaleString('zh-CN')} 字 · {ch.sentences.length} 句
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeChapter(ch.id);
                    }}
                    className="p-2 rounded-lg text-ink-400 hover:text-role-villain hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.section>

      {/* 右：预览区 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="xl:col-span-2"
      >
        <div className="card h-full flex flex-col min-h-[520px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-midnight-700">
              <BookOpenCheck size={20} />
              <h2 className="font-song font-semibold text-xl">分段预览</h2>
            </div>
            {cur && (
              <div className="flex items-center gap-1.5 text-xs text-ink-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-role-title" />
                  标题{typeCount('title')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-role-dialogue" />
                  对话{typeCount('dialogue')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-role-narration" />
                  旁白{typeCount('narration')}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {cur ? (
                <motion.div
                  key={cur.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto scrollbar-thin pr-2 -mr-2 space-y-2 max-h-[540px]"
                >
                  {cur.sentences.map((s, i) => (
                    <SegmentItem key={s.id} index={i} sentence={s} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center py-12 text-ink-400"
                >
                  <div className="w-20 h-20 rounded-full bg-ink-50 flex items-center justify-center mb-4">
                    <Plus size={32} className="text-ink-300" />
                  </div>
                  <p className="font-song text-ink-500 mb-1">还没有导入任何章节</p>
                  <p className="text-xs">在左侧粘贴正文，开启你的有声化之旅</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {showConfirmClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-900/50 backdrop-blur-sm"
            onClick={() => setShowConfirmClear(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-card p-6 w-full max-w-sm mx-4"
            >
              <h3 className="font-song font-semibold text-lg text-midnight-800 mb-2">
                确认清空所有数据？
              </h3>
              <p className="text-sm text-ink-500 mb-5">
                此操作将删除所有已导入的章节及配音信息，且无法恢复。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="btn-secondary !py-2 !px-4 text-sm"
                >
                  取消
                </button>
                <button onClick={handleClear} className="btn-primary !py-2 !px-4 text-sm !bg-red-500">
                  确认清空
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SegmentItem({ index, sentence }: { index: number; sentence: Sentence }) {
  const meta = SENTENCE_TYPE_META[sentence.type];
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.015 }}
      className={cn(
        'group relative pl-3.5 pr-3 py-2.5 rounded-xl text-sm leading-relaxed transition-all hover:shadow-paper',
        meta.bgColor,
        'border border-transparent hover:border-ink-200'
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-2 bottom-2 w-1 rounded-full',
          meta.dotColor
        )}
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-mono text-ink-400 font-bold">
          {String(index + 1).padStart(3, '0')}
        </span>
        <span
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
            meta.color,
            'bg-white/80'
          )}
        >
          {meta.label}
        </span>
      </div>
      <p
        className={cn(
          'text-midnight-800 leading-relaxed',
          sentence.type === 'title'
            ? 'font-song font-bold text-base'
            : sentence.type === 'dialogue'
            ? 'font-medium italic'
            : 'font-song'
        )}
      >
        {sentence.text}
      </p>
    </motion.div>
  );
}
