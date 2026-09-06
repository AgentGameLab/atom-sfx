#!/usr/bin/env node
/**
 * 材质扫描 —— 一条音效「像不像纸木」的三个可测读数
 *
 *   node tools/material-scan.mjs <目录或文件...> [--json] [--ring 150]
 *
 * 判据出处：qimen-dunjia/docs/design/sound-design-paper-wood-0906.md §4。
 * 这里只出数字，不出结论——结论要小天听。
 *
 * 每条给：
 *   dur      有效时长（秒）
 *   atk      起音：包络从峰值 −20dB 爬到峰值的时间（ms）
 *   d20/d40  余韵：峰值后包络掉到 −20 / −40dB 的时间（ms）
 *   cen      频谱重心（Hz）
 *   bands    五段相对能量（dB，相对全谱）：<250 / 250–1k / 1k–4k / 4–8k / >8k
 *   ring     金属感：峰值后 150ms 起，500Hz–10kHz 内同一根窄峰持续多久（ms）
 *   ringHz   那根峰在哪
 *   tonal    尾巴里 8 根最强窄峰占 500Hz–10kHz 总能量的比例（0–1，越高越「叮」）
 *   room     300–800ms 窗 RMS 相对直达峰值（dB）——声场 gate 的「干不干」
 *
 * 窄峰定义：4096 点 hann 谱，50ms 一帧；某 bin 高于 ±40 bin 中位数 ≥15dB、
 * 且不低于该帧最大值 −25dB、且是局部极大 → 记一根峰；同一 bin（±2）连续
 * 出现 N 帧 → ring = N × 50ms。木/纸/竹的尾巴是宽带噪声，ring 一般 ≤ 100ms；
 * 钟/磬/铃/金属板一敲就是 400ms 起步。
 *
 * ⚠️ 这个读数只回答「有没有金属余韵」，不回答「是什么材质」——两块木头对敲
 * 也可能有一根 800Hz 的短峰（木块本身的模态）。ring ≤ 150 是必要条件不是充分条件。
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const ringIdx = args.indexOf('--ring');
const RING_LIMIT = ringIdx >= 0 ? Number(args[ringIdx + 1]) : 150;
const inputs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--ring'));
if (!inputs.length) { console.error('用法：node tools/material-scan.mjs <目录或文件...> [--json] [--ring 150]'); process.exit(1); }

const SR = 48000, N = 4096, HOP = 2400;
const decode = (f) => {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength >> 2);
};
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const win = new Float64Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
function powerSpec(x, s) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (x[s + i] ?? 0) * win[i];
  fft(re, im);
  const p = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return p;
}
const dB = (v) => 10 * Math.log10(v + 1e-20);
const BANDS = [[0, 250], [250, 1000], [1000, 4000], [4000, 8000], [8000, 24000]];
const LO = Math.round(500 * N / SR), HI = Math.round(10000 * N / SR);

function analyze(x) {
  const n = x.length;
  let peak = 0, peakAt = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); if (a > peak) { peak = a; peakAt = i; } }
  // 10ms RMS 包络
  const H = 480, frames = Math.floor(n / H), env = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < H; i++) { const v = x[f * H + i]; s += v * v; } env[f] = Math.sqrt(s / H); }
  let ep = 0, epF = 0; for (let f = 0; f < frames; f++) if (env[f] > ep) { ep = env[f]; epF = f; }
  const t20 = ep * 10 ** (-20 / 20), t40 = ep * 10 ** (-40 / 20);
  let last20 = epF, last40 = epF, first20 = 0;
  for (let f = epF; f < frames; f++) { if (env[f] > t20) last20 = f; if (env[f] > t40) last40 = f; }
  for (let f = 0; f <= epF; f++) if (env[f] > t20) { first20 = f; break; }
  // 全局五段
  const acc = new Float64Array(N / 2); let cnt = 0;
  for (let s = 0; s + N <= n; s += N / 2) { const p = powerSpec(x, s); for (let i = 0; i < N / 2; i++) acc[i] += p[i]; cnt++; }
  if (!cnt) { const p = powerSpec(x, 0); for (let i = 0; i < N / 2; i++) acc[i] += p[i]; }
  let tot = 0, cenN = 0; for (let i = 1; i < N / 2; i++) { tot += acc[i]; cenN += acc[i] * i * SR / N; }
  const bands = BANDS.map(([lo, hi]) => { let s = 0; for (let i = 1; i < N / 2; i++) { const f = i * SR / N; if (f >= lo && f < hi) s += acc[i]; } return +dB(s / tot).toFixed(1); });
  // 尾巴：峰后 150ms 起逐帧找窄峰
  const tailFrames = [];
  for (let s = peakAt + Math.round(0.15 * SR); s + N <= n; s += HOP) tailFrames.push(powerSpec(x, s));
  let ring = 0, ringBin = 0, tonal = null;
  if (tailFrames.length) {
    let prev = new Map(), tn = 0;
    for (const p of tailFrames) {
      const l = new Float64Array(N / 2); let fmax = -1e9;
      for (let i = LO; i < HI; i++) { l[i] = dB(p[i]); if (l[i] > fmax) fmax = l[i]; }
      const cur = new Map();
      for (let i = LO; i < HI; i++) {
        if (l[i] < fmax - 25 || l[i] < l[i - 1] || l[i] < l[i + 1]) continue;
        const a = []; for (let k = Math.max(LO, i - 40); k < Math.min(HI, i + 40); k++) a.push(l[k]);
        a.sort((u, v) => u - v);
        if (l[i] - a[a.length >> 1] < 15) continue;
        let run = 1; for (let d = -2; d <= 2; d++) if (prev.has(i + d)) run = Math.max(run, prev.get(i + d) + 1);
        cur.set(i, run); if (run > ring) { ring = run; ringBin = i; }
      }
      prev = cur;
      const lin = []; let ts = 0; for (let i = LO; i < HI; i++) { lin.push(p[i]); ts += p[i]; }
      lin.sort((u, v) => v - u); let top = 0; for (let i = 0; i < 8; i++) top += lin[i] ?? 0;
      tn += ts > 0 ? top / ts : 0;
    }
    tonal = +(tn / tailFrames.length).toFixed(2);
  }
  // 房间：300–800ms 窗 RMS 相对直达峰值
  let room = null;
  const r0 = peakAt + Math.round(0.3 * SR), r1 = Math.min(n, peakAt + Math.round(0.8 * SR));
  if (r1 - r0 > SR * 0.1) { let e = 0; for (let i = r0; i < r1; i++) e += x[i] * x[i]; room = +(20 * Math.log10(Math.sqrt(e / (r1 - r0)) / (peak + 1e-9) + 1e-9)).toFixed(1); }
  return {
    dur: +(n / SR).toFixed(2), peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1),
    atk: (epF - first20) * 10, d20: (last20 - epF) * 10, d40: (last40 - epF) * 10,
    cen: Math.round(cenN / tot), bands, ring: ring * 50, ringHz: Math.round(ringBin * SR / N), tonal, room,
  };
}

const files = [];
for (const p of inputs) {
  if (statSync(p).isDirectory()) files.push(...readdirSync(p).filter(f => /\.(ogg|wav|mp3|flac)$/i.test(f)).sort().map(f => join(p, f)));
  else files.push(p);
}
const out = {};
for (const f of files) { try { out[basename(f)] = analyze(decode(f)); } catch (e) { out[basename(f)] = { err: String(e.message).slice(0, 80) }; } }

if (JSON_OUT) { process.stdout.write(JSON.stringify(out, null, 1)); process.exit(0); }
const pad = (v, w) => String(v ?? '-').padStart(w);
console.log('file'.padEnd(26) + pad('dur', 5) + pad('atk', 5) + pad('d20', 6) + pad('d40', 6) + pad('cen', 6) + '  <250 250-1k 1k-4k 4-8k  >8k' + pad('ring', 6) + pad('Hz', 6) + pad('tonal', 6) + pad('room', 6) + '  ');
let flagged = 0;
for (const [f, v] of Object.entries(out)) {
  if (v.err) { console.log(f.padEnd(26) + '  ERR ' + v.err); continue; }
  const flag = v.ring > RING_LIMIT ? ' ⚠ ring' : '';
  if (flag) flagged++;
  console.log(f.padEnd(26) + pad(v.dur.toFixed(2), 5) + pad(v.atk, 5) + pad(v.d20, 6) + pad(v.d40, 6) + pad(v.cen, 6) + ' ' + v.bands.map(b => pad(b.toFixed(0), 5)).join(' ') + pad(v.ring, 6) + pad(v.ringHz, 6) + pad(v.tonal == null ? '-' : v.tonal.toFixed(2), 6) + pad(v.room == null ? '-' : v.room.toFixed(0), 6) + flag);
}
console.log(`\n${files.length} 条，ring > ${RING_LIMIT}ms 的 ${flagged} 条（只是提示，结论要听）`);
