#!/usr/bin/env node
/**
 * split-takes.mjs —— 口报 slate 的长录音 → 切成单个 one-shot 原子
 *
 * 用法：
 *   atom-split --input <长录音.wav> --dry-run
 *   atom-split --input <长录音.wav> --map <属性.json> --out <原子目录>
 *
 * 原理：语音（口报）和拟音瞬态在 attack 陡峭度上差一个数量级 ——
 *   人说话能量爬升 30-80ms，硬物敲击 < 5ms。靠这个分开，不需要 ASR。
 *
 * 序列约定（见 docs/recording-guide.md）：
 *   口报(长语音) → take × N → 口报 → take × N → ...
 *   录的时候换档按 M 打 marker，切分器读 wav 的 cue chunk 给 take 分档。
 *
 * 命名两种模式：
 *   --map    自由模式（推荐）—— 属性来自口报 + marker 档位，录之前不用定表
 *   --slates 表模式 —— 预先定好顺序表，按顺序对应。顺序错一条后面全错位
 * 两种都会在组数对不上时拒绝写文件（防静默错位），除非 --force。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SR = 48000;
const WIN_MS = 5;
const HOP_MS = 1; // hop = 1ms → 包络下标即毫秒，后面所有时间单位都是 ms

// 表模式的内建表默认为空 —— 项目特定的表用 --slates <json> 外挂。
// 推荐走 --map 自由模式：录之前不用定表，属性录完再配。
const SLATES = [];

// ── 分类阈值 ──
const TAKE_MAX_ATTACK_MS = 15; // 瞬态 attack 上限（木子实测 <5ms，留 3 倍余量）
const TAKE_MAX_DUR_MS = 700; // 含板共振尾巴
const TAKE_MAX_PEAKS = 2; // 单峰急降；语音多音节会有 3+
const NG_MAX_DUR_MS = 700; // 短语音 = NG；更长 = slate

function parseArgs(argv) {
  const a = { input: null, out: 'atoms', dryRun: false, force: false, headSec: 3, slates: null, ng: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--input') a.input = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--force') a.force = true;
    else if (k === '--head-sec') a.headSec = Number(argv[++i]);
    else if (k === '--slates') a.slates = argv[++i];
    else if (k === '--map') a.map = argv[++i];
    else if (k === '--speech') a.speech = argv[++i];
    else if (k === '--min-peak') a.minPeak = Number(argv[++i]); // 滤掉低于此 dBFS 的 take
    else if (k === '--min-dur') a.minDur = Number(argv[++i]); // 滤掉短于此 ms 的 take
    else if (k === '--gate') a.gate = Number(argv[++i]); // 触发门限，噪声地板之上多少 dB（默认 21.6）
    else if (k === '--require-marker') a.requireMarker = true; // 只要第一个 marker 之后的 take
    else if (k === '--ng') a.ng = true;
    else throw new Error(`未知参数：${k}`);
  }
  if (!a.input) throw new Error('缺 --input <长录音.wav>');
  return a;
}

function decodeMono(input) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], {
    maxBuffer: 1 << 30,
  });
  if (r.error) throw new Error(`ffmpeg 起不来（装了吗 / 在 PATH 里吗）：${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg 解码失败：${r.stderr?.toString().trim()}`);
  const buf = r.stdout;
  // Int16Array 需要 2 字节对齐；不齐就 copy 一次
  const aligned = buf.byteOffset % 2 === 0 ? buf : Buffer.from(buf);
  return new Int16Array(aligned.buffer, aligned.byteOffset, aligned.length >> 1);
}

/**
 * 读 wav 的 marker（Audition 里按 M 打的）。
 * cue chunk 存位置，LIST/adtl 里的 labl/ltxt 存标签文本（没命名就是空）。
 * 存成 .sesx session 的话 marker 留在工程里不进文件，读不到。
 */
function readCues(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return [];
  const raw = [];
  const labels = new Map();
  let sr = SR;
  let p = 12;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4);
    const sz = b.readUInt32LE(p + 4);
    const body = p + 8;
    if (id === 'fmt ' && body + 8 <= b.length) sr = b.readUInt32LE(body + 4) || SR;
    else if (id === 'cue ' && body + 4 <= b.length) {
      const n = b.readUInt32LE(body);
      for (let i = 0; i < n; i++) {
        const o = body + 4 + i * 24;
        if (o + 24 > b.length) break;
        raw.push({ id: b.readUInt32LE(o), sample: b.readUInt32LE(o + 20) }); // dwSampleOffset
      }
    } else if (id === 'LIST' && b.toString('ascii', body, body + 4) === 'adtl') {
      let q = body + 4;
      const end = Math.min(body + sz, b.length);
      while (q + 8 <= end) {
        const sid = b.toString('ascii', q, q + 4);
        const ssz = b.readUInt32LE(q + 4);
        const txtAt = sid === 'ltxt' ? q + 28 : q + 12; // ltxt 头比 labl 多 20 字节
        if ((sid === 'labl' || sid === 'note' || sid === 'ltxt') && q + 12 <= end) {
          const cueId = b.readUInt32LE(q + 8);
          const t = b
            .toString('utf8', Math.min(txtAt, end), Math.min(q + 8 + ssz, end))
            .replace(/\0[\s\S]*$/, '')
            .trim();
          if (t) labels.set(cueId, t);
        }
        q += 8 + ssz + (ssz % 2);
      }
    }
    p = body + sz + (sz % 2);
  }
  return raw
    .map((c) => ({ ms: Math.round((c.sample / sr) * 1000), label: labels.get(c.id) ?? null }))
    .sort((a, b) => a.ms - b.ms);
}

/** 滑动窗 RMS 包络，下标单位 = ms */
function rmsEnvelope(pcm) {
  const win = Math.round((SR * WIN_MS) / 1000);
  const hop = Math.round((SR * HOP_MS) / 1000);
  if (pcm.length < win) return new Float64Array(0);
  const n = Math.floor((pcm.length - win) / hop) + 1;
  const out = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < win; i++) sum += pcm[i] * pcm[i];
  out[0] = Math.sqrt(sum / win);
  let idx = 1;
  for (let start = hop; start + win <= pcm.length; start += hop) {
    for (let i = start - hop; i < start; i++) sum -= pcm[i] * pcm[i];
    for (let i = start + win - hop; i < start + win; i++) sum += pcm[i] * pcm[i];
    out[idx++] = Math.sqrt(Math.max(0, sum) / win);
  }
  return out;
}

function percentile(arr, p, from = 0, to = arr.length) {
  const s = Float64Array.from(arr.slice(from, to)).sort();
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

/** 双阈值 + 最小间隔的状态机切段 */
function segment(env, thOn, thOff, minActiveMs = 8, minGapMs = 150) {
  const segs = [];
  let inSeg = false;
  let start = 0;
  let lastAbove = 0;
  for (let i = 0; i < env.length; i++) {
    if (!inSeg) {
      if (env[i] > thOn) {
        inSeg = true;
        start = i;
        lastAbove = i;
      }
    } else if (env[i] > thOff) {
      lastAbove = i;
    } else if (i - lastAbove > minGapMs) {
      if (lastAbove - start >= minActiveMs) segs.push({ start, end: lastAbove });
      inSeg = false;
    }
  }
  if (inSeg && lastAbove - start >= minActiveMs) segs.push({ start, end: lastAbove });
  return segs;
}

/**
 * marker 落在某一段内部时，在 marker 处把它切开 —— marker 语义上就是 take 边界。
 *
 * 为什么需要：持续音（摩擦、火、风）压低门限才捞得到轻的那档，但压低之后
 * 段间静音也过线，整批连成一片。实测皮革摩擦：默认门限漏掉最轻的两档，
 * 门限降到 +12dB 后 18 段塌成 3 段。靠 marker 切就两头都不误。
 */
function splitAtMarkers(segs, points, guardMs = 60) {
  if (!points.length) return segs;
  const sorted = [...new Set(points)].sort((a, b) => a - b);
  const out = [];
  for (const s of segs) {
    const inside = sorted.filter((ms) => ms > s.start + guardMs && ms < s.end - guardMs);
    if (!inside.length) {
      out.push(s);
      continue;
    }
    let prev = s.start;
    for (const ms of inside) {
      out.push({ start: prev, end: ms - 1 });
      prev = ms;
    }
    out.push({ start: prev, end: s.end });
  }
  return out;
}

function analyze(seg, env) {
  const dur = seg.end - seg.start;
  let peak = 0;
  let peakAt = seg.start;
  for (let i = seg.start; i <= seg.end; i++) {
    if (env[i] > peak) {
      peak = env[i];
      peakAt = i;
    }
  }
  // 超过半峰的独立起伏个数：单峰瞬态 = 1，多音节语音 = 3+
  const half = peak * 0.5;
  let peaks = 0;
  let above = false;
  for (let i = seg.start; i <= seg.end; i++) {
    if (!above && env[i] > half) {
      above = true;
      peaks++;
    } else if (above && env[i] < half * 0.7) above = false;
  }
  return { dur, attack: peakAt - seg.start, peak, peaks, peakDb: 20 * Math.log10(peak / 32768 || 1e-9) };
}

/**
 * NG 检测默认**关闭**（--ng 开启）。
 * 原因：轻放的 attack 可能超过 TAKE_MAX_ATTACK_MS（软接触能量爬升慢），
 * 那它既不满足 take 又很短，开着 NG 就会被判成 NG 并**静默弹掉前面一个好 take**。
 * 录完自己把 NG 剪掉的话，这条判据纯是负担。
 * 关闭时短段一律按 take 收，attack 偏慢的在报告里标出来让人看。
 */
/**
 * 有语音区间时的分类（--speech）：跟语音重叠过半 = 口报，其余全是素材。
 *
 * 这条比 attack 判据可靠得多，而且是**持续音唯一能用的办法** ——
 * 火焰/风/水/摩擦跟语音一样慢 attack、长、多峰，声学特征分不开
 * （实测喷火录音 30 秒火焰被 attack 判据判成了口报）。
 * 反过来先定位语音、剩下的都算素材，瞬态和持续音就一视同仁了。
 */
function classifyBySpeech(seg, spans) {
  const s = seg.start / 1000;
  const e = seg.end / 1000;
  const dur = Math.max(1e-6, e - s);
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    const ov = Math.min(e, sp.e) - Math.max(s, sp.s);
    // 带 spanIdx 是为了合并时去重 —— 一段口报会被换气切成多个 seg，
    // 每个都指向同一个 span，直接累加 text 会把整段口报重复好几遍
    if (ov > 0 && ov / dur > 0.5) return { kind: 'slate', spanIdx: i };
  }
  return { kind: 'take', spanIdx: null };
}

function classify(a, ngEnabled) {
  const isTake = a.attack <= TAKE_MAX_ATTACK_MS && a.dur <= TAKE_MAX_DUR_MS && a.peaks <= TAKE_MAX_PEAKS;
  if (isTake) return 'take';
  if (a.dur >= NG_MAX_DUR_MS) return 'slate'; // 长段 = 口报
  if (ngEnabled) return 'ng';
  return a.peaks <= TAKE_MAX_PEAKS ? 'take_slow' : 'slate'; // 短多峰仍归口报
}

/** slate → takes 分组；NG 弹掉当前组末尾一个 take */
function group(items) {
  const groups = [];
  let cur = null;
  const warnings = [];
  // 不口报、只打 marker 也是合法工作流 —— 没有任何口报时全部 take 归一组，
  // 否则它们会被当成「第一个口报之前的」全部丢掉。
  // （颤动/刮擦类是慢 attack + 多峰，启发式容易误判成口报，所以这条必须兜住）
  if (!items.some((i) => i.kind === 'slate')) {
    cur = { slateAt: 0, takes: [] };
    groups.push(cur);
  }
  for (const it of items) {
    if (it.kind === 'slate') {
      // 当前组还没收到 take → 这是同一段口报里的换气停顿，不开新组，只延长区间。
      // 判据：两段口报之间一定隔着录的东西。实测 73s 素材，说话换气被切成
      // 12 段「slate」，实际只有 2 段口报。
      if (cur && cur.takes.length === 0) {
        cur.slateEnd = it.end;
        if (it.spanIdx != null) cur.spanIdx.add(it.spanIdx);
        continue;
      }
      cur = { slateAt: it.start, slateEnd: it.end, spanIdx: new Set(it.spanIdx != null ? [it.spanIdx] : []), takes: [] };
      groups.push(cur);
    } else if (it.kind === 'ng') {
      if (!cur || !cur.takes.length) warnings.push(`${it.start}ms 处的 NG 没有可丢弃的 take`);
      else cur.takes.pop();
    } else if (cur) {
      cur.takes.push(it);
    } else {
      warnings.push(`${it.start}ms 处的 take 出现在第一个 slate 之前，已忽略`);
    }
  }
  return { groups, warnings };
}

function atomName(entry, n) {
  const ax = Object.entries(entry.axis)
    .map(([k, v]) => `${k}_${v}`)
    .join('__');
  return `${entry.family}__${ax}__${String(n).padStart(2, '0')}.wav`;
}

/**
 * 自由模式命名（--map）：属性来自口报 + marker 档位，不需要预先定表。
 * map 形如：
 *   { source: "desk_padded", technique: "fingernail", tierAxis: "f",
 *     groups: [{ axis: { r: "center" } }, { axis: { r: "mid" } }, ...] }
 * 出：desk_padded__fingernail__r_center__f1__01.wav
 * variant 编号是**档内**的（每档从 01 重新开始），不是整组连续。
 */
function atomNameFromMap(map, gi, take) {
  const g = map.groups?.[gi];
  // technique 可以按组覆盖 —— 一份录音里常有多种手法（抽卡 / 洗牌）
  const parts = [map.source, g?.technique ?? map.technique];
  if (g?.axis) for (const [k, v] of Object.entries(g.axis)) parts.push(`${k}_${v}`);
  // tierMap：一个 marker 档位展开成多个轴 —— 双轴录法（位置 × 力度）打出来
  // 是 9 个连续 marker，但语义是 3×3，靠 tierAxis 单字母表达不了
  const tm = map.tierMap?.[String(take.tier)];
  if (tm) for (const [k, v] of Object.entries(tm)) parts.push(`${k}_${v}`);
  else if (map.tierAxis && take.tier) parts.push(`${map.tierAxis}${take.tier}`);
  // variantOffset：同一档被中途的口报切成两组时，让后一组的编号接着数不撞名
  parts.push(String((take.vit ?? 1) + (g?.variantOffset ?? 0)).padStart(2, '0'));
  return parts.filter(Boolean).join('__') + '.wav';
}

function cut(input, outPath, startMs, endMs) {
  const ss = Math.max(0, startMs - 20) / 1000; // 前留 20ms
  const dur = (endMs + 120) / 1000 - ss; // 后留 120ms 让尾巴收完
  // 必须重编码，不能 -c copy：wav 的 -c copy 走 packet 级 seek，-ss 会 round 到包边界
  // （实测偏移几十 ms，直接把 attack 切掉，峰值比报告低 3-8dB）。
  // pcm_f32le → pcm_f32le 是无损的，只是让 seek 变成样本精确。
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-ss', ss.toFixed(4), '-t', dur.toFixed(4), '-c:a', 'pcm_f32le', outPath]);
  if (r.status !== 0) throw new Error(`切分失败 ${outPath}：${r.stderr?.toString().trim()}`);
}

function main() {
  const args = parseArgs(process.argv);
  const slates = args.slates ? JSON.parse(readFileSync(args.slates, 'utf8')) : SLATES;
  const mapCfg = args.map ? JSON.parse(readFileSync(args.map, 'utf8')) : null;
  const input = resolve(args.input);

  const pcm = decodeMono(input);
  const env = rmsEnvelope(pcm);
  const totalSec = pcm.length / SR;

  // 噪声地板：取「开头静默段」和「全局低分位」里更小的那个。
  // 只靠开头会翻车 —— 实录经常一上来就说话（实测 73s 素材：开头无静默 →
  // 地板算成 -25.8dBFS，比真实底噪高 12dB+，整段只切出 1 段）。
  // 段间静音在任何录音里都占 >10%，全局 10 分位是更稳的兜底。
  const headMs = Math.min(env.length, Math.round(args.headSec * 1000));
  const floorHead = headMs > 0 ? percentile(env, 0.9, 0, headMs) : Infinity;
  const floorGlobal = percentile(env, 0.1);
  const floor = Math.min(floorHead, floorGlobal);
  const globalPeak = percentile(env, 0.999);
  // 地板 +21dB，或峰值 −40dB，取大。
  // 实测（73s 真实素材，底噪 -64.4dBFS）：+12dB 太敏感，段间底噪波动没掉下去，
  // 整段连成 1 段。ffmpeg silencedetect 扫阈值显示 -40~-45dB 是稳定平台
  // （都检出 41 个间隔），-50dB 起开始把信号内部低谷也当静音（跳到 88）。
  // 显式给 --gate 就只按噪声地板算，不再受峰值下限约束 —— 轻素材（皮革摩擦、
  // 布料、轻刮）实测 peak 只有 -41dBFS，默认门限 -42 会把整段吃掉，
  // marker 编号跳号就是这么来的。
  const thOn = args.gate != null ? floor * Math.pow(10, args.gate / 20) : Math.max(floor * 12, globalPeak * 0.01);
  const thOff = thOn * 0.5;

  const markers = readCues(input);
  const speech = args.speech ? JSON.parse(readFileSync(args.speech, 'utf8')).spans ?? [] : null;
  // 切点 = marker + 语音边界。语音边界也要切，否则低门限下一段长素材会把
  // 中间那句短口报吞进去（重叠不过半 → 整段判成 take，口报混在素材里）
  const cutPoints = markers.map((m) => m.ms);
  if (speech) for (const sp of speech) cutPoints.push(Math.round(sp.s * 1000), Math.round(sp.e * 1000));
  const segs = splitAtMarkers(segment(env, thOn, thOff), cutPoints);
  const items = segs.map((s) => {
    const a = analyze(s, env);
    if (speech) {
      const c = classifyBySpeech(s, speech);
      return { ...s, ...a, kind: c.kind, spanIdx: c.spanIdx };
    }
    return { ...s, ...a, kind: classify(a, args.ng) };
  });
  // --min-peak：滤掉说话前的呼吸、放下东西的响动这类杂音。默认不滤 ——
  // 宁可让它们出现在报告里被看见，也不静默丢掉可能是真素材的东西。
  // 持续音场景优先用 --min-dur：实测喷火录音里杂音和真素材的**电平完全重叠**
  // （火 -25.0/-30.1dBFS，呼吸和放东西 -28.4/-30.3/-33.7），--min-peak 分不开；
  // 但时长差 100 倍（火 8.9s vs 杂音 26-81ms），--min-dur 一刀切干净。
  // --require-marker：第一个 marker 之前的 take 一律不要。口报刚说完顺手试一下
  // 是常见动作，那一下混进正式素材里会占掉 variant 编号还拉歪族增益。
  const firstMarker = args.requireMarker && markers.length ? markers[0].ms : null;
  let filtered = 0;
  for (const it of items) {
    if (it.kind !== 'take') continue;
    if (
      (args.minPeak != null && it.peakDb < args.minPeak) ||
      (args.minDur != null && it.dur < args.minDur) ||
      (firstMarker != null && it.start < firstMarker)
    ) {
      it.kind = 'noise';
      filtered++;
    }
  }
  const { groups, warnings } = group(items.filter((i) => i.kind !== 'noise'));

  // ── marker 分档 ──
  // 录的时候换档按一次 M。算法能准确切出每一下，但猜不出档位边界
  // （实测：主观「轻」和「中」峰值只差 <3dB，混在一起分不开），marker 把它定死。
  for (const g of groups) {
    for (const t of g.takes) {
      // >= 而不是 > ：不口报时虚拟组起点是 0，marker 打在 0.0s（录制一开始就按 M）
      // 会正好落在边界外，那一档的 take 全部丢失档位标签
      const before = markers.filter((m) => m.ms >= g.slateAt && m.ms <= t.start);
      t.tier = before.length + 1;
      t.tierLabel = before.length ? before[before.length - 1].label : null;
    }
    // 去掉空档重新编号 —— 第一档前面打不打 marker 都得到 1,2,3
    const used = [...new Set(g.takes.map((t) => t.tier))].sort((a, b) => a - b);
    const remap = new Map(used.map((v, i) => [v, i + 1]));
    for (const t of g.takes) t.tier = remap.get(t.tier);
    // 档内 variant 序号（每档从 1 重新数）
    const counter = new Map();
    for (const t of g.takes) {
      const c = (counter.get(t.tier) ?? 0) + 1;
      counter.set(t.tier, c);
      t.vit = c;
    }
  }

  // ── 报告 ──
  console.log(`\n输入：${input}`);
  console.log(`时长 ${totalSec.toFixed(1)}s · 噪声地板 ${(20 * Math.log10(floor / 32768 || 1e-9)).toFixed(1)}dBFS · 触发阈值 ${(20 * Math.log10(thOn / 32768 || 1e-9)).toFixed(1)}dBFS`);
  const nSlow = items.filter((i) => i.kind === 'take_slow').length;
  console.log(
    `切到 ${items.length} 段：slate ${items.filter((i) => i.kind === 'slate').length} · take ${items.filter((i) => i.kind === 'take' || i.kind === 'take_slow').length}` +
      (nSlow ? `（其中 ${nSlow} 个 attack 偏慢）` : '') +
      (args.ng ? ` · NG ${items.filter((i) => i.kind === 'ng').length}` : ' · NG 检测关闭'),
  );
  console.log(
    markers.length
      ? `marker ${markers.length} 个：${markers.map((m) => `${(m.ms / 1000).toFixed(1)}s${m.label ? `(${m.label})` : ''}`).join(' ')}`
      : `marker 0 个（没打，或存成了 .sesx —— marker 要跟 wav 走才读得到）`,
  );
  console.log(mapCfg ? `合并出 ${groups.length} 段口报 · map 里有 ${mapCfg.groups?.length ?? 0} 组\n` : `合并出 ${groups.length} 段口报 · 表里有 ${slates.length} 条\n`);

  const rows = [];
  groups.forEach((g, gi) => {
    const entry = slates[gi];
    const mapG = mapCfg?.groups?.[gi];
    const label = mapCfg
      ? mapG?.skip
        ? `（skip：${mapG.why ?? '不入库'}）`
        : mapG
          ? Object.entries(mapG.axis ?? {})
              .map(([k, v]) => `${k}=${v}`)
              .join(' ') || `组${gi + 1}`
          : '⚠ map 里没有对应组'
      : entry
        ? entry.slate
        : '⚠ 表里没有对应条目';
    console.log(`[${String(gi + 1).padStart(2)}] ${label}  —— ${g.takes.length} 个 take  (口报 @ ${(g.slateAt / 1000).toFixed(2)}s)`);
    const said = speech && g.spanIdx?.size ? [...g.spanIdx].map((i) => speech[i].t).join(' ').trim() : null;
    if (said) console.log(`       「${said.slice(0, 70)}${said.length > 70 ? '…' : ''}」`);
    g.takes.forEach((t, ti) => {
      const name = mapCfg
        ? mapG && !mapG.skip
          ? atomNameFromMap(mapCfg, gi, t)
          : `unmapped_${gi + 1}_${ti + 1}.wav`
        : entry
          ? atomName(entry, ti + 1)
          : `unmapped_${gi + 1}_${ti + 1}.wav`;
      const tier = markers.length ? `  档${t.tier}${t.tierLabel ? `(${t.tierLabel})` : ''}` : '';
      console.log(
        `       ${String(ti + 1).padStart(2)}.${tier}  ${(t.start / 1000).toFixed(2)}s  attack ${String(t.attack).padStart(3)}ms  dur ${String(t.dur).padStart(4)}ms  peak ${t.peakDb.toFixed(1)}dBFS  → ${name}` +
          (t.kind === 'take_slow' ? '   ⚠ attack 偏慢（软接触/闷响常见，不一定是杂音）' : ''),
      );
      rows.push({ group: gi + 1, label, tier: t.tier ?? null, tierLabel: t.tierLabel ?? null, variantInTier: t.vit ?? null, name, startMs: t.start, endMs: t.end, attackMs: t.attack, durMs: t.dur, peakDb: Number(t.peakDb.toFixed(2)) });
    });
    // 有 marker 时按「档」查数量（一组可能 9 个 = 3 档 × 3 下），没 marker 才按组查
    if (markers.length) {
      const per = new Map();
      for (const t of g.takes) per.set(t.tier, (per.get(t.tier) ?? 0) + 1);
      // 持续音（火/风/水）每档就录一条长的，别按瞬态的"每档 3-5 下"报警
      const avgDur = g.takes.reduce((s, t) => s + t.dur, 0) / g.takes.length;
      const sustained = avgDur > 1000;
      const bad = sustained ? [] : [...per.entries()].filter(([, n]) => n < 2 || n > 6);
      if (bad.length) console.log(`       ⚠ 档 ${bad.map(([k, n]) => `${k}(${n}个)`).join(' ')} 数量异常`);
    } else if (g.takes.length < 3 || g.takes.length > 6) {
      console.log(`       ⚠ 数量异常（期望 3-5 个）`);
    }
  });

  for (const w of warnings) console.log(`⚠ ${w}`);

  // 比的是**合并后的口报段数**，不是原始语音段数（说话换气会被切成多段，已合并）
  const expected = mapCfg ? (mapCfg.groups?.length ?? 0) : slates.length;
  const mismatch = groups.length !== expected;
  if (mismatch) {
    if (expected === 0) {
      console.log(`\n没给属性表 —— 上面 ${groups.length} 段口报各是什么？写个 map JSON 用 --map 传进来（格式见 docs/schema.md）。`);
    } else {
      console.log(`\n⚠ 口报段数 ${groups.length} ≠ ${mapCfg ? 'map 里' : '表里'} ${expected} 组。`);
      console.log(`  看上面每组的归属对不对；顺序错位的话所有命名都会错。`);
    }
  }

  if (args.dryRun) {
    console.log(`\n--dry-run：没有写任何文件。确认无误后去掉 --dry-run 正式切。\n`);
    return;
  }
  if (mismatch && !args.force) {
    console.log(`\n拒绝切分（防止静默错位）。核对无误就加 --force，或改 SLATES 表 / 用 --slates <json>。\n`);
    process.exitCode = 1;
    return;
  }

  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const r of rows) {
    if (r.name.startsWith('unmapped_')) continue; // 没对应属性的不写，报告里已列出
    cut(input, join(outDir, r.name), r.startMs, r.endMs);
    n++;
  }
  // 报告名带 source —— 多份录音切进同一个原子目录时，固定名会互相覆盖
  const reportName = `split-report${mapCfg?.source ? `-${mapCfg.source}` : ''}.json`;
  writeFileSync(join(outDir, reportName), JSON.stringify({ input, source: mapCfg?.source ?? null, note: mapCfg?.note ?? null, generatedAt: new Date().toISOString(), thresholdDb: 20 * Math.log10(thOn / 32768), rows }, null, 2));
  console.log(`\n写出 ${n} 个原子到 ${outDir}`);
  console.log(`报告：${join(outDir, reportName)}\n`);
}

try {
  main();
} catch (e) {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
}
