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

export interface PlaybackScriptSentence {
  id: string;
  text: string;
  character: string | null;
  characterLabel: string;
  characterColor: string;
  style: string | null;
  styleLabel: string;
  rate: number;
  pitch: number;
  volume: number;
  pauseBefore: number;
  emotionLevel: number;
  isReread: boolean;
  type: string;
  typeLabel: string;
}

export interface PlaybackChapter {
  id: string;
  title: string;
  wordCount: number;
  sentences: PlaybackScriptSentence[];
}

export interface StandalonePlayerData {
  chapters: PlaybackChapter[];
  projectName: string;
  exportedAt: string;
  totalWords: number;
  totalSentences: number;
  rereadCount: number;
  unassignedCount: number;
  includeReread: boolean;
}

export const buildStandalonePlayerHTML = (
  data: StandalonePlayerData,
  filename: string
): string => {
  const json = JSON.stringify(data);
  const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#1e3a5f;--ink2:#2d5a78;--amber:#d4a574;--paper:#faf7f2;--paper2:#f0e8db;--text:#172e4c;--muted:#6b7280;--male:#3b82f6;--female:#ec4899;--villain:#dc2626;--narrator:#6b7280;--reread:#f59e0b}
body{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;background:var(--paper);color:var(--text);min-height:100vh;background-image:radial-gradient(circle at 20% 20%,rgba(212,165,116,.08) 0,transparent 50%),radial-gradient(circle at 80% 80%,rgba(30,58,95,.05) 0,transparent 50%)}
.wrap{max-width:820px;margin:0 auto;padding:32px 24px 80px}
.head{display:flex;align-items:center;gap:16px;margin-bottom:28px}
.logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,var(--ink),var(--amber));display:flex;align-items:center;justify-content:center;color:#fff;font-family:"Noto Serif SC",serif;font-size:26px;font-weight:700;box-shadow:0 6px 20px rgba(30,58,95,.2)}
.meta h1{font-family:"Noto Serif SC",serif;font-size:22px;font-weight:700;color:var(--ink)}
.meta p{font-size:12px;color:var(--muted);margin-top:2px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.stat{padding:14px 16px;border-radius:14px;background:#fff;border:1px solid var(--paper2);box-shadow:0 1px 3px rgba(30,58,95,.06)}
.stat b{display:block;font-size:22px;color:var(--ink);font-family:"Noto Serif SC",serif}
.stat span{font-size:11px;color:var(--muted)}
.player{background:#fff;border:1px solid var(--paper2);border-radius:18px;padding:20px;box-shadow:0 6px 24px rgba(30,58,95,.08);margin-bottom:24px}
.p-top{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.disc{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--ink),var(--amber));display:flex;align-items:center;justify-content:center;color:#fff;position:relative;flex-shrink:0}
.disc svg{width:22px;height:22px}
.disc.playing::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(212,165,116,.5);animation:ring 2s ease-in-out infinite}
@keyframes ring{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.15);opacity:.2}}
.cur{flex:1;min-width:0}
.cur .ch{font-size:11px;color:var(--muted);margin-bottom:3px}
.cur .txt{font-family:"Noto Serif SC",serif;font-size:15px;color:var(--text);font-weight:500;line-height:1.6}
.cur .tag-row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.cur .tag{font-size:10px;padding:2px 8px;border-radius:99px;color:#fff;font-weight:500}
.ctrl{display:flex;align-items:center;justify-content:center;gap:10px;margin:18px 0 14px}
.btn{border:0;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s ease,box-shadow .15s ease}
.btn:active{transform:translateY(1px)}
.btn-s{width:40px;height:40px;border-radius:50%;background:var(--paper2);color:var(--ink2)}
.btn-s:hover{background:#e5d7c3}
.btn-p{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--ink),var(--ink2));color:#fff;box-shadow:0 4px 14px rgba(30,58,95,.28)}
.btn-p:hover{box-shadow:0 6px 20px rgba(30,58,95,.36)}
.btn-p svg{width:22px;height:22px}
.btn svg{width:16px;height:16px}
.progress{height:6px;border-radius:99px;background:var(--paper2);overflow:hidden;margin-bottom:8px}
.progress>div{height:100%;background:linear-gradient(90deg,var(--ink),var(--amber));transition:width .3s ease}
.vol{display:flex;align-items:center;gap:10px;justify-content:center}
.vol label{font-size:11px;color:var(--muted)}
.vol input{width:120px;accent-color:var(--amber)}
.opts{display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap}
.opts label{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer;padding:6px 12px;border-radius:99px;background:var(--paper2)}
.opts input{accent-color:var(--ink)}
.chapters{display:flex;flex-direction:column;gap:16px}
.chapter{background:#fff;border:1px solid var(--paper2);border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(30,58,95,.05)}
.ch-head{padding:14px 18px;background:linear-gradient(135deg,rgba(30,58,95,.04),rgba(212,165,116,.04));border-bottom:1px solid var(--paper2);display:flex;align-items:center;justify-content:space-between}
.ch-head h2{font-family:"Noto Serif SC",serif;font-size:15px;font-weight:700;color:var(--ink)}
.ch-head span{font-size:11px;color:var(--muted)}
.s-list{max-height:420px;overflow-y:auto;padding:4px 8px}
.s-list::-webkit-scrollbar{width:5px}
.s-list::-webkit-scrollbar-thumb{background:var(--paper2);border-radius:5px}
.sen{position:relative;padding:10px 14px 10px 44px;border-radius:10px;cursor:pointer;margin:2px 0;transition:background .15s ease}
.sen:hover{background:rgba(30,58,95,.03)}
.sen.playing{background:linear-gradient(90deg,rgba(30,58,95,.06),rgba(212,165,116,.06));font-weight:500}
.sen.reread::after{content:"⭐";position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:12px;opacity:.8}
.sen.unassigned{opacity:.55}
.sen .idx{position:absolute;left:14px;top:12px;width:22px;height:22px;border-radius:6px;background:var(--paper2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--muted);font-family:monospace}
.sen.playing .idx{background:var(--ink);color:#fff}
.sen .txt{font-family:"Noto Serif SC",serif;font-size:13.5px;line-height:1.7;color:var(--text)}
.sen .tag-row{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap}
.sen .tag{font-size:9.5px;padding:1.5px 7px;border-radius:99px;color:#fff;font-weight:500}
.sen .tag.type{background:rgba(107,114,128,.15);color:var(--muted);font-weight:400}
.foot{margin-top:32px;padding-top:20px;border-top:1px dashed var(--paper2);text-align:center}
.foot p{font-size:11px;color:var(--muted);line-height:1.7}
.warn{padding:12px 16px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#92400e;font-size:12px;margin-bottom:18px;display:flex;gap:10px;align-items:flex-start}
.warn b{font-weight:600;margin-right:6px}</>`;

  const js = `
(function(){
  const DATA = ${json};
  const FLAT = [];
  DATA.chapters.forEach(ch=>ch.sentences.forEach(s=>FLAT.push({...s,chapterTitle:ch.title})));

  const $ = s => document.querySelector(s);
  const el = tag => document.createElement(tag);

  let cur = -1;
  let playing = false;
  let stopFlag = false;
  const opts = { skipReread:false, onlyAssigned:false, autoNext:true };

  function speak(text, params){
    return new Promise(resolve=>{
      if(!window.speechSynthesis){ resolve(); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = params.rate; u.pitch = params.pitch; u.volume = params.volume;
      if(opts.voicePref){ const vv = speechSynthesis.getVoices().find(v=>v.voiceURI===opts.voicePref); if(vv) u.voice=vv; }
      u.onend = ()=>resolve();
      u.onerror = ()=>resolve();
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }
  function loadVoices(){
    return new Promise(res=>{
      const v = speechSynthesis.getVoices();
      if(v.length){ res(v); return; }
      speechSynthesis.onvoiceschanged = ()=>{ speechSynthesis.onvoiceschanged=null; res(speechSynthesis.getVoices()); };
      setTimeout(()=>res(speechSynthesis.getVoices()),1500);
    });
  }
  async function pickVoice(character, style){
    const vs = await loadVoices();
    if(!vs.length) return null;
    const zh = vs.filter(v=>/zh|CN|mandarin|chinese|中文/i.test(v.lang+v.name));
    const pool = zh.length?zh:vs;
    return pool[0];
  }
  function row(s, idx){
    const div = el('div');
    div.className = 'sen' + (s.isReread?' reread':'') + (!s.character?' unassigned':'');
    div.dataset.idx = idx;
    const t = el('div'); t.className='idx'; t.textContent = String(idx+1).padStart(2,'0'); div.appendChild(t);
    const tx = el('div'); tx.className='txt'; tx.textContent = s.text; div.appendChild(tx);
    const tr = el('div'); tr.className='tag-row';
    const t1 = el('span'); t1.className='tag type'; t1.textContent = s.typeLabel; tr.appendChild(t1);
    if(s.character){ const t2 = el('span'); t2.className='tag'; t2.style.background = s.characterColor; t2.textContent = s.characterLabel; tr.appendChild(t2); }
    if(s.style){ const t3 = el('span'); t3.className='tag'; t3.style.background='var(--ink)'; t3.textContent = s.styleLabel; tr.appendChild(t3); }
    div.appendChild(tr);
    div.addEventListener('click', ()=>{ stopFlag=true; speechSynthesis.cancel(); setTimeout(()=>playFrom(idx),80); });
    return div;
  }
  function highlight(idx){
    document.querySelectorAll('.sen').forEach(d=>d.classList.remove('playing'));
    const t = document.querySelector('.sen[data-idx="'+idx+'"]');
    if(t){ t.classList.add('playing'); t.scrollIntoView({behavior:'smooth', block:'center'}); }
    $('#disc').classList.toggle('playing', playing);
  }
  function setCurInfo(s, idx){
    if(!s){ $('#cur-ch').textContent=''; $('#cur-txt').textContent='点击下方任意句子开始播放'; $('#cur-tags').innerHTML=''; return; }
    $('#cur-ch').textContent = (s.chapterTitle||'') + ' · 第 ' + (idx+1) + '/' + FLAT.length + ' 句';
    $('#cur-txt').textContent = s.text;
    const tr = $('#cur-tags'); tr.innerHTML='';
    const mk=(c,l)=>{const x=el('span');x.className='tag';x.style.background=c;x.textContent=l;tr.appendChild(x);};
    if(s.character) mk(s.characterColor, s.characterLabel);
    if(s.style) mk('var(--ink)', s.styleLabel);
    if(s.isReread) mk('var(--reread)', '重读');
    $('#progress').style.width = FLAT.length?(((idx+1)/FLAT.length*100)+'%'):'0%';
  }
  async function playFrom(startIdx){
    if(FLAT.length===0) return;
    stopFlag = false;
    for(let i=startIdx;i<FLAT.length;i++){
      if(stopFlag) break;
      const s = FLAT[i];
      if(opts.skipReread && s.isReread) continue;
      if(opts.onlyAssigned && !s.character) continue;
      cur = i; playing = true; highlight(i); setCurInfo(s,i);
      if(s.pauseBefore>0){ await new Promise(r=>setTimeout(r,s.pauseBefore)); }
      await speak(s.text, { rate:s.rate, pitch:s.pitch, volume:s.volume });
    }
    stopFlag = false; playing = false;
    $('#disc').classList.remove('playing');
  }
  function toggle(){
    if(playing){ stopFlag=true; speechSynthesis.cancel(); playing=false; $('#disc').classList.remove('playing'); return; }
    const start = (cur>=0&&cur<FLAT.length)?cur:0; playFrom(start);
  }
  function next(){ stopFlag=true; speechSynthesis.cancel(); const n = Math.min(cur+1, FLAT.length-1); setTimeout(()=>playFrom(n),80); }
  function prev(){ stopFlag=true; speechSynthesis.cancel(); const n = Math.max(cur-1, 0); setTimeout(()=>playFrom(n),80); }
  function render(){
    document.title = DATA.projectName + ' - 有声样音';
    $('#project').textContent = DATA.projectName;
    $('#exported').textContent = '导出于 ' + DATA.exportedAt + ' · 共 ' + DATA.chapters.length + ' 章';
    $('#stat-ch').textContent = DATA.chapters.length;
    $('#stat-sen').textContent = DATA.totalSentences;
    $('#stat-w').textContent = DATA.totalWords.toLocaleString('zh-CN');
    $('#stat-rr').textContent = DATA.rereadCount;
    const root = $('#chapters'); root.innerHTML='';
    DATA.chapters.forEach(ch=>{
      const wrap = el('div'); wrap.className='chapter';
      const head = el('div'); head.className='ch-head';
      const h2 = el('h2'); h2.textContent = ch.title; head.appendChild(h2);
      const sp = el('span'); sp.textContent = ch.wordCount.toLocaleString('zh-CN') + '字 · ' + ch.sentences.length + '句'; head.appendChild(sp);
      wrap.appendChild(head);
      const list = el('div'); list.className='s-list';
      const baseIdx = FLAT.findIndex(s=>s.chapterTitle===ch.title);
      ch.sentences.forEach((s,i)=>list.appendChild(row(s, baseIdx+i)));
      wrap.appendChild(list); root.appendChild(wrap);
    });
    setCurInfo(FLAT[0], 0);
    $('#btn-play').addEventListener('click', toggle);
    $('#btn-prev').addEventListener('click', prev);
    $('#btn-next').addEventListener('click', next);
    $('#vol').addEventListener('input', e=>{
      const v = parseFloat(e.target.value);
      FLAT.forEach(s=>{ s.volume = v; });
      $('#vol-label').textContent = Math.round(v*100)+'%';
    });
    $('#skipReread').addEventListener('change', e=>opts.skipReread = e.target.checked);
    $('#onlyAssigned').addEventListener('change', e=>opts.onlyAssigned = e.target.checked);
  }
  if(!window.speechSynthesis){
    document.getElementById('warn').style.display='';
  }
  loadVoices().then(render);
})();`;

  const warnDisplay = isTTSSupported() ? 'style="display:none"' : '';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${filename} - 有声样音</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
</head><body>
<div class="wrap">
<div class="head">
<div class="logo">墨</div>
<div class="meta"><h1 id="project"></h1><p id="exported"></p></div>
</div>
<div ${warnDisplay} class="warn" id="warn">
<div>⚠️</div>
<div><b>当前浏览器不支持内置语音合成。</b>建议使用最新版 Chrome / Edge / Safari 打开此文件，以自动播放样音。配音数据仍可在下方查看。</div>
</div>
<div class="stats">
<div class="stat"><b id="stat-ch">0</b><span>章节数</span></div>
<div class="stat"><b id="stat-sen">0</b><span>句子数</span></div>
<div class="stat"><b id="stat-w">0</b><span>总字数</span></div>
<div class="stat"><b id="stat-rr">0</b><span>重读标记</span></div>
</div>
<div class="player">
<div class="p-top">
<div class="disc" id="disc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg></div>
<div class="cur">
<div class="ch" id="cur-ch"></div>
<div class="txt" id="cur-txt">点击下方任意句子开始播放</div>
<div class="tag-row" id="cur-tags"></div>
</div>
</div>
<div class="ctrl">
<button class="btn btn-s" id="btn-prev" title="上一句"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg></button>
<button class="btn btn-p" id="btn-play" title="播放/暂停"><svg viewBox="0 0 24 24" fill="currentColor" id="play-icon"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg></button>
<button class="btn btn-s" id="btn-next" title="下一句"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg></button>
</div>
<div class="progress"><div id="progress" style="width:0"></div></div>
<div class="vol">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#6b7280"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
<label>音量 <span id="vol-label">100%</span></label>
<input type="range" id="vol" min="0.3" max="1.5" step="0.05" value="1" />
</div>
<div class="opts">
<label><input type="checkbox" id="skipReread"/> 跳过重读标记句</label>
<label><input type="checkbox" id="onlyAssigned"/> 仅播放已分配角色</label>
</div>
</div>
<div class="chapters" id="chapters"></div>
<div class="foot">
<p>本样音文件由「墨音」网文听书试音工具独立生成 · 可分发给读者或后期制作人员</p>
<p>双击打开即用，无需联网（字体加载需要首次联网）· 点击任意句子可跳至该处播放</p>
</div>
</div>
<script>${js}</script>
</body></html>`;
};
