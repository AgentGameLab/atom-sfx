#!/usr/bin/env node
/**
 * compare-shape.mjs —— 比两版产物的「形状」是否还是同一个音效
 *
 *   node tools/compare-shape.mjs <旧目录> <新目录> [--tol 1.5] [--json out.json]
 *   node tools/compare-shape.mjs <旧.ogg> <新.ogg>
 *
 * 改配方（换底座、调滤镜、重构脚本）之后用它守「声音没变」。有偏差就 exit 1，
 * 可以直接串在跑完配方后面。
 *
 * ── 为什么是这两把尺子 ──────────────────────────────────────
 *
 * 1. **RMS 包络**（每 50ms）看时间上的形状：起振多快、身体多长、尾巴怎么收。
 *    ⚠️ **不能用峰值包络**。限幅之后的峰值包络必然贴着天花板走，拿它比什么
 *    都"一样"，也会把每一条正常成品都误判成被压平了（0820 点兵误判过一轮）。
 * 2. **九频带相对能量**（40…10240Hz，各占总能量的比例）看音色。相对总能量而
 *    不是绝对值，所以整体电平变了不影响这把尺子。
 *
 * ── 比之前必须做的两次归零 ──────────────────────────────────
 *
 * **对齐时间**。`alimiter` 有前视延时（默认 attack 5ms），链上多挂一道 limiter
 * 整条就晚 5ms。这几毫秒落在陡峭的起振段上，50ms 窗能读出 2dB 的假差异
 * （0820 迁 attack-swing 时就这么被骗了一轮，九条全"超差"，其实只是晚了 5ms）。
 * 所以先拿峰值附近做互相关求整数样本偏移，对齐了再比。
 *
 * **减掉整体电平差**。响度目标是各自收敛的，整体高低不该算进形状偏差里 ——
 * 它单独报在「电平Δ」那一列，一眼能看出"只是响度不同"还是"形状变了"。
 *
 * ── 阈值 ────────────────────────────────────────────────────
 * 默认 1.5dB。经验：同一条链的可复现差异在 0.5dB 以内；超过 1.5dB 一定有
 * 原因（配比错了 / 压缩器阈值没跟着挪 / 下混系数不同），别急着调参，先查。
 * 频带那边低于总能量 40dB 的档不参与判定 —— 那点能量听不见，而"相对总能量的
 * dB"在这种量级上会把毫无意义的差放大（锣的 40Hz 档在 -50dB，差 4dB 纯属噪声）。
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const [srcA, srcB] = positional;
const TOL = Number(flag('tol', 1.5));
const JSON_OUT = flag('json', null);
if (!srcA || !srcB) {
  console.error('用法：node tools/compare-shape.mjs <旧目录|旧文件> <新目录|新文件> [--tol 1.5] [--json out.json]');
  process.exit(1);
}

const SR = 48000, WIN = Math.round(SR * 0.05);          // 50ms
const CENTERS = [40, 80, 160, 320, 640, 1280, 2560, 5120, 10240];
const AUDIO = /\.(ogg|wav|mp3|flac)$/i;

function decode(f) {
  const b = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-'],
    { maxBuffer: 1 << 28 }).stdout;
  if (!b || !b.length) throw new Error(`解不出音频：${f}`);
  return new Float32Array(b.buffer, b.byteOffset, b.length >> 2);
}
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));

/** RMS 包络（不是峰值包络，见文件头） */
function envelope(a) {
  const n = Math.floor(a.length / WIN), e = new Float64Array(n);
  for (let w = 0; w < n; w++) {
    let s = 0;
    for (let i = w * WIN; i < (w + 1) * WIN; i++) s += a[i] * a[i];
    e[w] = db(Math.sqrt(s / WIN));
  }
  return e;
}

/** 迭代 radix-2 FFT（就地，实/虚分开） */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** 九频带能量占比（dB）。Hann 窗 4096 / 50% 叠加，累加整段 */
function bands(a) {
  const N = 4096, hop = N / 2, out = new Float64Array(CENTERS.length);
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const edges = CENTERS.map((c) => [c / Math.SQRT2, c * Math.SQRT2]);
  for (let off = 0; off + N <= a.length; off += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = a[off + i] * hann[i];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = k * SR / N, p = re[k] * re[k] + im[k] * im[k];
      for (let b = 0; b < CENTERS.length; b++) if (f >= edges[b][0] && f < edges[b][1]) { out[b] += p; break; }
    }
  }
  const tot = out.reduce((s, v) => s + v, 0) || 1e-30;
  return Array.from(out, (v) => db(Math.sqrt(v / tot)));
}

/** b 相对 a 的整数样本偏移（拿峰值附近 ±100ms 做互相关）。见文件头「对齐时间」 */
function bestLag(a, b, maxLag = 480) {
  let pi = 0, pv = 0;
  for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > pv) { pv = v; pi = i; } }
  const s = Math.max(0, pi - 4800), e = Math.min(a.length, pi + 4800);
  let best = 0, bestScore = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let dot = 0, nb = 0;
    for (let i = s; i < e; i++) {
      const j = i + lag;
      if (j < 0 || j >= b.length) continue;
      dot += a[i] * b[j]; nb += b[j] * b[j];
    }
    const score = nb > 0 ? dot / Math.sqrt(nb) : -Infinity;
    if (score > bestScore) { bestScore = score; best = lag; }
  }
  return best;
}
const shift = (b, lag) => {
  if (!lag) return b;
  const out = new Float32Array(b.length);
  for (let i = 0; i < b.length; i++) { const j = i + lag; out[i] = j >= 0 && j < b.length ? b[j] : 0; }
  return out;
};

// ── 配对：两个目录取同名文件，或直接两个文件 ──────────────────
const isDir = (p) => statSync(p).isDirectory();
let pairs;
if (isDir(srcA) && isDir(srcB)) {
  const listA = readdirSync(srcA).filter((f) => AUDIO.test(f));
  const setB = new Set(readdirSync(srcB).filter((f) => AUDIO.test(f)));
  const onlyA = listA.filter((f) => !setB.has(f));
  const onlyB = [...setB].filter((f) => !listA.includes(f));
  if (onlyA.length) console.log(`⚠ 只在旧目录：${onlyA.join(' ')}`);
  if (onlyB.length) console.log(`⚠ 只在新目录：${onlyB.join(' ')}`);
  pairs = listA.filter((f) => setB.has(f)).sort().map((f) => [f, join(srcA, f), join(srcB, f)]);
} else {
  pairs = [[basename(srcA), srcA, srcB]];
}

const report = [];
let worst = 0;
console.log(`\n${'文件'.padEnd(26)} 对齐    电平Δ  包络max  超差窗  频带max (档)`);
for (const [name, fa, fb] of pairs) {
  const A = decode(fa), B0 = decode(fb);
  const lag = bestLag(A, B0);
  const B = shift(B0, lag);
  const ea = envelope(A), eb = envelope(B);
  const n = Math.min(ea.length, eb.length);
  // 只比听得见的那些窗：比各自峰值窗低 40dB 以上的不算
  const peakA = Math.max(...ea), peakB = Math.max(...eb);
  const idx = [];
  for (let i = 0; i < n; i++) if (ea[i] > peakA - 40 || eb[i] > peakB - 40) idx.push(i);
  let off = 0;
  for (const i of idx) off += eb[i] - ea[i];
  off = idx.length ? off / idx.length : 0;
  let envMax = 0, envBad = 0, envAt = -1;
  for (const i of idx) {
    const d = Math.abs(eb[i] - ea[i] - off);
    if (d > TOL) envBad++;
    if (d > envMax) { envMax = d; envAt = i; }
  }
  const ba = bands(A), bb = bands(B);
  let bandMax = 0, bandAt = -1;
  for (let b = 0; b < CENTERS.length; b++) {
    if (ba[b] < -40 && bb[b] < -40) continue;    // 听不见的档不参与判定，见文件头
    const d = Math.abs(bb[b] - ba[b]);
    if (d > bandMax) { bandMax = d; bandAt = b; }
  }
  worst = Math.max(worst, envMax, bandMax);
  const bad = envMax > TOL || bandMax > TOL;
  console.log(`${(bad ? '✗ ' : '  ') + name.padEnd(24)} ${(lag / SR * 1000).toFixed(1).padStart(5)}ms `
    + `${off.toFixed(2).padStart(6)} ${envMax.toFixed(2).padStart(6)}@${String(envAt * 50).padStart(4)}ms `
    + `${String(envBad).padStart(3)}/${String(idx.length).padStart(3)} `
    + `${bandMax.toFixed(2).padStart(6)} (${bandAt < 0 ? '同' : CENTERS[bandAt]})`);
  report.push({
    file: name, lagMs: lag / SR * 1000, durDelta: (B.length - A.length) / SR, levelOffset: off,
    envMax, envAtMs: envAt * 50, envBadWindows: envBad, envWindows: idx.length,
    bandMax, bandAt: bandAt < 0 ? null : CENTERS[bandAt], bandsA: ba, bandsB: bb,
  });
}
console.log(`\n最大偏差 ${worst.toFixed(2)}dB（阈值 ${TOL}）`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
// 超差就非零退出：可以直接串在跑完配方后面当守门
if (worst > TOL) process.exitCode = 1;
