import type { Chapter, Sentence } from '@/types';
import { downloadBlob } from './helpers';
import { CHARACTER_LIST, SENTENCE_TYPE_META, VOICE_STYLES } from '@/constants/characters';

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
