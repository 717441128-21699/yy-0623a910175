import type { Chapter, Sentence, CharacterVoice } from '@/types';
import { downloadBlob } from './helpers';
import { CHARACTER_LIST, SENTENCE_TYPE_META, VOICE_STYLES } from '@/constants/characters';
import {
  buildStandalonePlayerHTML,
  computeEffectiveParams,
  type StandalonePlayerData,
  type PlaybackChapter,
} from './tts';
import { estimateReadTime, formatDuration } from './helpers';

const characterLabelOf = (ch: Sentence['character']): string => {
  const found = CHARACTER_LIST.find((c) => c.value === ch);
  return found ? found.label : '未分配';
};

const styleLabelOf = (s: Sentence['voiceStyle']): string => {
  const found = VOICE_STYLES.find((v) => v.value === s);
  return found ? found.label : '默认';
};

const typeLabelOf = (t: Sentence['type']): string => SENTENCE_TYPE_META[t]?.label || t;

interface ExportListRow {
  index: number;
  type: string;
  character: string;
  style: string;
  text: string;
  rate: string;
  pitch: string;
  pauseBefore: string;
  emotion: string;
  isReread: string;
}

const buildExportRows = (chapters: Chapter[]): { chapterTitle: string; rows: ExportListRow[] }[] => {
  return chapters.map((ch) => {
    const rows: ExportListRow[] = ch.sentences
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({
        index: i + 1,
        type: typeLabelOf(s.type),
        character: characterLabelOf(s.character),
        style: styleLabelOf(s.voiceStyle),
        text: s.text.replace(/"/g, '""'),
        rate: s.rate.toFixed(2) + 'x',
        pitch: s.pitch.toFixed(2),
        pauseBefore: s.pauseBefore + 'ms',
        emotion: 'Lv.' + s.emotionLevel,
        isReread: s.isReread ? '是' : '否',
      }));
    return { chapterTitle: ch.title, rows };
  });
};

export const exportDubbListJSON = (chapters: Chapter[]): void => {
  const payload = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    wordCount: ch.wordCount,
    totalSentences: ch.sentences.length,
    createdAt: new Date(ch.createdAt).toISOString(),
    sentences: ch.sentences
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        index: s.order + 1,
        type: s.type,
        text: s.text,
        character: s.character,
        voiceStyle: s.voiceStyle,
        rate: s.rate,
        pitch: s.pitch,
        pauseBefore: s.pauseBefore,
        emotionLevel: s.emotionLevel,
        isReread: s.isReread,
      })),
  }));

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  downloadBlob(blob, `配音清单_${ts}.json`);
};

export const exportDubbListCSV = (chapters: Chapter[]): void => {
  const parts = buildExportRows(chapters);
  const HEADER =
    '序号,章节,类型,角色,声音风格,文本内容,语速,音调,句前停顿,情绪强度,重读标记\n';

  let csv = '\uFEFF' + HEADER;
  for (const part of parts) {
    for (const r of part.rows) {
      csv += `${r.index},"${part.chapterTitle}",${r.type},${r.character},${r.style},"${r.text}",${r.rate},${r.pitch},${r.pauseBefore},${r.emotion},${r.isReread}\n`;
    }
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  downloadBlob(blob, `配音清单_${ts}.csv`);
};

export const exportDubbMarkdown = (chapters: Chapter[]): void => {
  const parts = buildExportRows(chapters);
  let md = '# 有声书配音清单\n\n';
  md += `> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `---\n\n`;

  for (const part of parts) {
    md += `## ${part.chapterTitle}\n\n`;
    md += `| 序号 | 类型 | 角色 | 风格 | 重读 | 文本内容 |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|:---|\n`;
    for (const r of part.rows) {
      md += `| ${r.index} | ${r.type} | ${r.character} | ${r.style} | ${r.isReread === '是' ? '⭐' : ''} | ${r.text.replace(/\|/g, '\\|')} |\n`;
    }
    md += '\n---\n\n';
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  downloadBlob(blob, `配音清单_${ts}.md`);
};

export const exportSummaryReport = (chapters: Chapter[]): void => {
  const totalWords = chapters.reduce((a, c) => a + c.wordCount, 0);
  const totalSentences = chapters.reduce((a, c) => a + c.sentences.length, 0);
  const unassigned = chapters.reduce(
    (a, c) => a + c.sentences.filter((s) => !s.character).length,
    0
  );
  const rereadCount = chapters.reduce(
    (a, c) => a + c.sentences.filter((s) => s.isReread).length,
    0
  );
  const perRole: Record<string, number> = {};
  chapters.forEach((c) => {
    c.sentences.forEach((s) => {
      const k = s.character || 'unassigned';
      perRole[k] = (perRole[k] || 0) + 1;
    });
  });

  const roleBreakdown = Object.entries(perRole)
    .map(([k, v]) => `${characterLabelOf(k === 'unassigned' ? null : (k as Sentence['character']))}: ${v}句`)
    .join('、');

  const report = `
网文听书试音 · 项目汇总报告
============================

导出时间: ${new Date().toLocaleString('zh-CN')}

一、项目概况
------------
章节数: ${chapters.length} 章
总字数: ${totalWords.toLocaleString('zh-CN')} 字
总句数: ${totalSentences} 句
未分配角色: ${unassigned} 句
重读标记句: ${rereadCount} 句

二、角色分布
------------
${roleBreakdown}

三、章节明细
------------
${chapters
  .map(
    (c, i) =>
      `第${i + 1}章 《${c.title}》 — ${c.wordCount.toLocaleString('zh-CN')}字 / ${
        c.sentences.length
      }句`
  )
  .join('\n')}

============================
由「墨音」网文听书试音工具生成
`.trim();

  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  downloadBlob(blob, `项目汇总_${ts}.txt`);
};

export interface DeliverySummary {
  chapterCount: number;
  sentenceCount: number;
  wordCount: number;
  rereadCount: number;
  unassignedCount: number;
  estimatedDurationMs: number;
  scopes: 'current' | 'all';
  chapterTitles: string[];
}

export interface DeliveryOptions {
  projectName: string;
  scope: 'current' | 'all';
  includeRereadTags: boolean;
  excludeUnassigned: boolean;
  chapters: Chapter[];
  currentChapterId: string | null;
  characterVoices: CharacterVoice[];
}

const resolveChapters = (
  opts: Pick<DeliveryOptions, 'chapters' | 'scope' | 'currentChapterId' | 'excludeUnassigned'>
): Chapter[] => {
  let list = opts.scope === 'current'
    ? opts.chapters.filter((c) => c.id === opts.currentChapterId)
    : opts.chapters.slice();
  if (opts.excludeUnassigned) {
    list = list.map((c) => ({
      ...c,
      sentences: c.sentences.filter((s) => !!s.character),
      wordCount: c.sentences.filter((s) => !!s.character).reduce((a, s) => a + s.text.length, 0),
    }));
  }
  return list;
};

export const computeDeliverySummary = (opts: DeliveryOptions): DeliverySummary => {
  const chapters = resolveChapters(opts);
  const sentences = chapters.flatMap((c) => c.sentences);
  const unassigned = chapters.reduce(
    (a, c) => a + c.sentences.filter((s) => !s.character).length,
    0
  );
  const reread = chapters.reduce(
    (a, c) => a + c.sentences.filter((s) => s.isReread).length,
    0
  );
  const words = chapters.reduce((a, c) => a + c.wordCount, 0);
  let dur = 0;
  for (const s of sentences) {
    const p = computeEffectiveParams(s, opts.characterVoices);
    dur += estimateReadTime(s.text.length, p.rate) + s.pauseBefore;
  }
  return {
    chapterCount: chapters.length,
    sentenceCount: sentences.length,
    wordCount: words,
    rereadCount: reread,
    unassignedCount: unassigned,
    estimatedDurationMs: dur,
    scopes: opts.scope,
    chapterTitles: chapters.map((c) => c.title),
  };
};

const buildPlayerData = (opts: DeliveryOptions): StandalonePlayerData => {
  const chapters = resolveChapters(opts);
  const sentences = chapters.flatMap((c) => c.sentences);
  const unassigned = chapters.reduce(
    (a, c) => a + c.sentences.filter((s) => !s.character).length,
    0
  );
  const reread = chapters.reduce(
    (a, c) => a + c.sentences.filter((s) => s.isReread).length,
    0
  );
  const words = chapters.reduce((a, c) => a + c.wordCount, 0);

  const charColorOf = (ch: Sentence['character']) => {
    const found = opts.characterVoices.find((c) => c.character === ch);
    return found?.color || '#6b7280';
  };
  const styleInfoOf = (style: Sentence['voiceStyle']) => {
    const found = VOICE_STYLES.find((v) => v.value === style);
    return found ? { label: found.label, icon: found.icon } : null;
  };
  const typeInfoOf = (t: Sentence['type']) => SENTENCE_TYPE_META[t]?.label || t;

  const playbackChapters: PlaybackChapter[] = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    wordCount: c.wordCount,
    sentences: c.sentences
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => {
        const p = computeEffectiveParams(s, opts.characterVoices);
        const si = styleInfoOf(s.voiceStyle);
        return {
          id: s.id,
          text: s.text,
          character: s.character,
          characterLabel: characterLabelOf(s.character),
          characterColor: charColorOf(s.character),
          style: s.voiceStyle,
          styleLabel: si ? `${si.icon}${si.label}` : '',
          rate: p.rate,
          pitch: p.pitch,
          volume: p.volume,
          pauseBefore: s.pauseBefore,
          emotionLevel: s.emotionLevel,
          isReread: opts.includeRereadTags ? s.isReread : false,
          type: s.type,
          typeLabel: typeInfoOf(s.type),
        };
      }),
  }));

  return {
    chapters: playbackChapters,
    projectName: opts.projectName,
    exportedAt: new Date().toLocaleString('zh-CN'),
    totalWords: words,
    totalSentences: sentences.length,
    rereadCount: reread,
    unassignedCount: unassigned,
    includeReread: opts.includeRereadTags,
  };
};

export const exportRereadList = (opts: DeliveryOptions): void => {
  const chapters = resolveChapters(opts);
  const entries: { chapter: string; order: number; text: string; character: string; reason: string }[] = [];
  chapters.forEach((c) => {
    c.sentences
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((s) => {
        if (s.isReread) {
          entries.push({
            chapter: c.title,
            order: s.order + 1,
            text: s.text,
            character: characterLabelOf(s.character),
            reason: '需重新录制/调整',
          });
        }
      });
  });

  let md = `# ${opts.projectName} · 重读句清单\n\n`;
  md += `> 导出于 ${new Date().toLocaleString('zh-CN')} · 共 ${entries.length} 句需重新处理\n\n`;
  md += `---\n\n`;
  if (entries.length === 0) {
    md += `> 🎉 太棒了！当前范围内没有任何重读标记，所有句子均已通过。\n`;
  } else {
    md += `| # | 章节 | 句序 | 角色 | 原句内容 | 备注 |\n`;
    md += `|---:|:---|:---:|:---:|:---|:---|\n`;
    entries.forEach((e, i) => {
      md += `| ${i + 1} | ${e.chapter} | ${e.order} | ${e.character} | ${e.text.replace(/\|/g, '\\|')} | ${e.reason} |\n`;
    });
  }
  md += `\n---\n\n> 由「墨音」网文听书试音工具自动生成`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const safeName = opts.projectName.replace(/[\\/:*?"<>|]/g, '_');
  downloadBlob(blob, `${safeName}_重读句清单.md`);
};

export const exportStandaloneAudio = (opts: DeliveryOptions): void => {
  const data = buildPlayerData(opts);
  const safeName = opts.projectName.replace(/[\\/:*?"<>|]/g, '_');
  const html = buildStandalonePlayerHTML(data, opts.projectName);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${safeName}_有声样音.html`);
};

export const exportDeliveryReadme = (
  opts: DeliveryOptions,
  summary: DeliverySummary
): void => {
  const safeName = opts.projectName.replace(/[\\/:*?"<>|]/g, '_');
  const readme = `
# ${opts.projectName} · 交付包说明
=================================================

📦 导出于 ${new Date().toLocaleString('zh-CN')}
🎬 生成工具：墨音 · 网文听书试音工具

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 交付内容摘要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  • 范围：${summary.scopes === 'all' ? '全部章节' : '当前章节'}
  • 章节数：${summary.chapterCount} 章
  • 总句数：${summary.sentenceCount} 句
  • 总字数：${summary.wordCount.toLocaleString('zh-CN')} 字
  • 预计播放时长：${formatDuration(summary.estimatedDurationMs)}
  • 重读标记句：${summary.rereadCount} 句
  • 未分配角色：${summary.unassignedCount} 句
  • 包含重读标签：${opts.includeRereadTags ? '是' : '否'}
  • 排除未分配句：${opts.excludeUnassigned ? '是' : '否'}

包含章节：
${summary.chapterTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 文件清单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1) ${safeName}_有声样音.html
     → 独立可播放样音文件，双击即可在浏览器自动播放
     → 包含播放器 UI、进度条、章节导航、音量控制
     → 可单独转发给读者或制作人员

  2) ${safeName}_配音清单.json
     → 结构化配音数据，便于程序导入后续制作流水线
     → 包含每句的角色、风格、语速、音调、停顿等全部参数

  3) ${safeName}_配音清单.csv
     → 表格格式，可用 Excel/Numbers/WPS 直接打开
     → 便于人工核对或团队协作批注

  4) ${safeName}_配音清单.md
     → Markdown 格式，带表格排版，适合直接在编辑器预览

  5) ${safeName}_重读句清单.md
     → 仅列出被标记为"重读"的句子
     → 便于后续针对性重录或调整参数

  6) ${safeName}_项目汇总.txt
     → 纯文本项目概览，适合作为邮件附件摘要

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧑‍💻 使用指南
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【给读者】
  双击打开 *_有声样音.html，建议使用 Chrome / Edge / Safari 浏览器
  → 点击播放按钮自动顺序播放
  → 点击任意句子可跳转播放
  → 播放器内可调节音量、选择跳过重读标记

【给制作人员】
  使用 *_配音清单.json / .csv / .md 作为底稿
  → 重读标记句请重点关注，优先重新处理
  → 每句参数包含：角色、风格、语速、音调、句前停顿、情绪
  → 样音 HTML 可作为效果参考，最终成品建议专业配音

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 提示
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  • 若样音 HTML 打开后没有声音，请检查：
    1) 是否使用 Chrome / Edge / Safari 最新版
    2) 浏览器是否已授权自动播放（需用户先点击一次播放按钮）
    3) 系统音量是否开启
  • 交付包内所有文件为 UTF-8 编码
  • 如需调整参数或追加内容，返回墨音工具重新导出即可

=================================================
                    墨音 · 让文字被听见
=================================================
`.trim();
  const blob = new Blob([readme], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${safeName}_交付说明.txt`);
};

export interface DeliveryResult {
  files: string[];
  summary: DeliverySummary;
}

export const exportDeliveryPackage = async (opts: DeliveryOptions): Promise<DeliveryResult> => {
  const summary = computeDeliverySummary(opts);
  const chaptersForExport = resolveChapters(opts);
  const safeName = opts.projectName.replace(/[\\/:*?"<>|]/g, '_');

  const files: string[] = [];
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await delay(80);
  exportStandaloneAudio({ ...opts, chapters: chaptersForExport });
  files.push(`${safeName}_有声样音.html`);

  await delay(180);
  const jsonBlobContent = JSON.stringify(
    chaptersForExport.map((ch) => ({
      id: ch.id,
      title: ch.title,
      wordCount: ch.wordCount,
      totalSentences: ch.sentences.length,
      sentences: ch.sentences
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          index: s.order + 1,
          type: s.type,
          text: s.text,
          character: s.character,
          characterLabel: characterLabelOf(s.character),
          voiceStyle: s.voiceStyle,
          styleLabel: styleLabelOf(s.voiceStyle),
          rate: s.rate,
          pitch: s.pitch,
          pauseBefore: s.pauseBefore,
          emotionLevel: s.emotionLevel,
          isReread: opts.includeRereadTags ? s.isReread : false,
        })),
    })),
    null,
    2
  );
  downloadBlob(
    new Blob([jsonBlobContent], { type: 'application/json;charset=utf-8' }),
    `${safeName}_配音清单.json`
  );
  files.push(`${safeName}_配音清单.json`);

  await delay(180);
  {
    const parts = buildExportRows(chaptersForExport);
    const HEADER =
      '序号,章节,类型,角色,声音风格,文本内容,语速,音调,句前停顿,情绪强度,重读标记\n';
    let csv = '\uFEFF' + HEADER;
    for (const part of parts) {
      for (const r of part.rows) {
        const reread = opts.includeRereadTags ? r.isReread : '否';
        csv += `${r.index},"${part.chapterTitle}",${r.type},${r.character},${r.style},"${r.text}",${r.rate},${r.pitch},${r.pauseBefore},${r.emotion},${reread}\n`;
      }
    }
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeName}_配音清单.csv`);
    files.push(`${safeName}_配音清单.csv`);
  }

  await delay(180);
  {
    const parts = buildExportRows(chaptersForExport);
    let md = `# ${opts.projectName} · 配音清单\n\n`;
    md += `> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    md += `---\n\n`;
    for (const part of parts) {
      md += `## ${part.chapterTitle}\n\n`;
      md += `| 序号 | 类型 | 角色 | 风格 | 重读 | 文本内容 |\n`;
      md += `|:---:|:---:|:---:|:---:|:---:|:---|\n`;
      for (const r of part.rows) {
        const reread = opts.includeRereadTags && r.isReread === '是' ? '⭐' : '';
        md += `| ${r.index} | ${r.type} | ${r.character} | ${r.style} | ${reread} | ${r.text.replace(/\|/g, '\\|')} |\n`;
      }
      md += '\n---\n\n';
    }
    downloadBlob(
      new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      `${safeName}_配音清单.md`
    );
    files.push(`${safeName}_配音清单.md`);
  }

  await delay(180);
  exportRereadList({ ...opts, chapters: chaptersForExport });
  files.push(`${safeName}_重读句清单.md`);

  await delay(180);
  exportDeliveryReadme(opts, summary);
  files.push(`${safeName}_交付说明.txt`);

  return { files, summary };
};
