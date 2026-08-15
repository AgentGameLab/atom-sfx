#!/usr/bin/env node
/**
 * 配方：棋门遁甲三种普通攻击的挥击音（attack-thrust / slash / blunt）
 *
 *   node tools/recipes/attack-swing.mjs <输出目录>
 *   node tools/normalize-loudness.mjs <输出目录> --lufs -14   ← 跑完必须归一
 *
 * 配方 = 一次交付的具体参数，不是通用工具。留着是为了可复现和照抄结构，
 * 换一批武器就复制一份改 BATCH，不要试图把它参数化成 CLI。
 *
 * 两个不能改回去的地方：
 *   1. 所有 whoosh 素材都 areverse —— 库里的口吹峰在 19-35%（"呼——"是渐弱），
 *      而挥击的物理是渐强（手臂加速，接触瞬间最快）。不倒放会听成收招。
 *   2. amix 之后必须 asetpts=N/SR/TB —— amix 保留 adelay 的 PTS 偏移，后面的
 *      atrim 按绝对时间戳裁，不重置就把开头连同内容一起切掉（实测峰被削 140ms）。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/attack-swing.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const A = (f) => `atoms/${f}.wav`;
const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v','error','-y',...args], { maxBuffer: 1<<26 });
  if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
};
// 时间锚：animateAttack windupEnd 168ms / impactAt 380ms。挥击的峰对齐到
// 340ms —— 命中前 40ms，刃/锤通过最近点的瞬间，命中音接在后面不打架。
function render(name, layers, { fadeOutAt, total, shift = 0 }) {
  const ins = [], filts = [];
  layers.forEach((L, i) => {
    ins.push('-i', A(L.file));
    const c = [];
    if (L.rev) c.push('areverse');           // 挥击是渐强，口吹素材是渐弱 —— 必须倒放
    if (L.trimMs) c.push(`atrim=0:${(L.trimMs/1000).toFixed(3)}`);
    if (L.tempo && L.tempo !== 1) c.push(`atempo=${L.tempo}`);
    if (L.hp) c.push(`highpass=f=${L.hp}`);
    if (L.lp) c.push(`lowpass=f=${L.lp}`);
    c.push(`volume=${L.gain}dB`);
    c.push(`adelay=${L.delayMs + shift}|${L.delayMs + shift}`);
    filts.push(`[${i}:a]${c.join(',')}[l${i}]`);
  });
  const mixIn = layers.map((_, i) => `[l${i}]`).join('');
  // asetpts 必须有：amix 保留 adelay 的 PTS 偏移，后面的 atrim 按绝对时间戳裁，
  // 不重置就会把开头连同内容一起切掉（实测 thrust 峰被削到 200ms）
  filts.push(`${mixIn}amix=inputs=${layers.length}:normalize=0,asetpts=N/SR/TB[mx]`);
  const fo = fadeOutAt + shift, tt = total + shift;
  filts.push(`[mx]afade=t=out:st=${(fo/1000).toFixed(3)}:d=${((tt-fo)/1000).toFixed(3)},atrim=0:${(tt/1000).toFixed(3)},alimiter=limit=0.9[out]`);
  ff([...ins,'-filter_complex',filts.join(';'),'-map','[out]','-ar','48000','-ac','1','-c:a','libvorbis','-q:a','5',`${OUT}/${name}.ogg`]);
}

const BATCH = {
  // 戳刺：最短最亮，尖峰后骤停。w_sharp 高通掉身体，只留锐气 + 一点刃刮
  'attack-thrust': { fadeOutAt: 360, total: 410, variants: [
    { shift: 0,  layers: [
      { file: 'breath_whoosh__mouth__w_sharp__01', rev: 1, tempo: 1.25, gain: 0, delayMs: 130, hp: 300 },
      { file: 'blade_wood__scrape__spd2__01', rev: 1, tempo: 1.3, gain: -7, delayMs: 150, hp: 2500 } ] },
    { shift: 0,  layers: [
      { file: 'breath_whoosh__mouth__w_sharp__02', rev: 1, tempo: 1.25, gain: 0, delayMs: 130, hp: 300 },
      { file: 'blade_wood__scrape__spd2__02', rev: 1, tempo: 1.3, gain: -7, delayMs: 150, hp: 2500 } ] },
    { shift: 20, layers: [
      { file: 'breath_whoosh__mouth__w_sharp__01', rev: 1, tempo: 1.3, gain: 0, delayMs: 130, hp: 300 },
      { file: 'blade_wood__scrape__spd2__03', rev: 1, tempo: 1.3, gain: -7, delayMs: 150, hp: 2500 } ] },
  ] },
  // 挥砍：三层。w_light 扫过 + w_heavy 垫中频身体 + blade_wood 一点刃感
  'attack-slash': { fadeOutAt: 380, total: 450, variants: [
    { shift: 30, layers: [
      { file: 'breath_whoosh__mouth__w_light__01', rev: 1, tempo: 1.0, gain: 0, delayMs: 40, hp: 250 },
      { file: 'breath_whoosh__mouth__w_heavy__01', rev: 1, tempo: 1.15, gain: -9, delayMs: 20 },
      { file: 'blade_wood__scrape__spd2__01', rev: 1, tempo: 1.1, gain: -13, delayMs: 90, hp: 2000 } ] },
    { shift: 20, layers: [
      { file: 'breath_whoosh__mouth__w_light__02', rev: 1, tempo: 1.0, gain: 0, delayMs: 40, hp: 250 },
      { file: 'breath_whoosh__mouth__w_heavy__02', rev: 1, tempo: 1.15, gain: -9, delayMs: 20 },
      { file: 'blade_wood__scrape__spd2__02', rev: 1, tempo: 1.1, gain: -13, delayMs: 90, hp: 2000 } ] },
    { shift: 40, layers: [
      { file: 'breath_whoosh__mouth__w_light__03', rev: 1, tempo: 1.0, gain: 0, delayMs: 40, hp: 250 },
      { file: 'breath_whoosh__mouth__w_heavy__03', rev: 1, tempo: 1.15, gain: -9, delayMs: 20 },
      { file: 'blade_wood__scrape__spd2__03', rev: 1, tempo: 1.1, gain: -13, delayMs: 90, hp: 2000 } ] },
  ] },
  // 钝击：最慢最低。w_heavy 低通掉刃感 + air_whoosh 只取 <500Hz 的风压当重量
  'attack-blunt': { fadeOutAt: 390, total: 480, variants: [
    { shift: 0,  layers: [
      { file: 'breath_whoosh__mouth__w_heavy__01', rev: 1, tempo: 1.05, gain: 0, delayMs: 0, lp: 4000 },
      { file: 'air_whoosh__burst__01', rev: 1, tempo: 1.0, gain: -4, delayMs: 0, lp: 500, trimMs: 500 } ] },
    { shift: 20, layers: [
      { file: 'breath_whoosh__mouth__w_heavy__02', rev: 1, tempo: 1.05, gain: 0, delayMs: 0, lp: 4000 },
      { file: 'air_whoosh__burst__02', rev: 1, tempo: 1.0, gain: -4, delayMs: 0, lp: 500, trimMs: 500 } ] },
    { shift: 60, layers: [
      { file: 'breath_whoosh__mouth__w_heavy__03', rev: 1, tempo: 1.05, gain: 0, delayMs: 0, lp: 4000 },
      { file: 'air_whoosh__burst__03', rev: 1, tempo: 1.0, gain: -4, delayMs: 0, lp: 500, trimMs: 500 } ] },
  ] },
};

for (const [defId, cfg] of Object.entries(BATCH)) {
  cfg.variants.forEach((v, i) => {
    const name = i ? `${defId}-${i + 1}` : defId;
    render(name, v.layers, { fadeOutAt: cfg.fadeOutAt, total: cfg.total, shift: v.shift });
    console.log(`  ${name}.ogg`);
  });
}
