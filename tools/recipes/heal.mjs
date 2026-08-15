#!/usr/bin/env node
/**
 * 配方：棋门遁甲治疗音（heal，3 变体）
 *
 *   node tools/recipes/heal.mjs <输出目录>
 *   node tools/normalize-loudness.mjs <输出目录> --lufs -19.5
 *
 * 旧版是 Suno 玉磬：0.26s、<250Hz 只有 -58.8、倾斜 +32.9 —— 一记极亮的"叮"，
 * 没有低频也没有过程。治疗在语义上是**恢复**，是个过程不是一个点，单发 ping
 * 撑不住这个意思。
 *
 * 新版 0.71s / 倾斜 +21，比旧版暖 11dB、低频多 10dB。结构是"点 + 过程"：
 * 瓷盘给"生效了"的那一下，水流给"还在恢复"。
 *
 * 一个迭代教训：中间试过把 grill_rack 提到 -8dB 来强化过程感，倾斜立刻回涨
 * 到 25.7 —— 它自己倾斜 +33.6，提它就是在往"亮"里拉，跟"暖"直接打架。
 * 换成水做过程主体后过程还在、暖也保住了。而且金属刮擦跟治疗本就没有语义
 * 关联，当初选它只是图那条现成的渐强包络。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const A = (f) => `atoms/${f}.wav`;
const ff = (a) => { const r = spawnSync('ffmpeg', ['-v','error','-y',...a], { maxBuffer: 1<<26 }); if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop()); };
function render(name, layers, { fadeOutAt, total }) {
  const ins = [], filts = [];
  layers.forEach((L, i) => {
    ins.push('-i', A(L.file));
    const c = [];
    if (L.rev) c.push('areverse');
    if (L.trimMs) c.push(`atrim=0:${(L.trimMs/1000).toFixed(3)}`);
    if (L.tempo && L.tempo !== 1) c.push(`atempo=${L.tempo}`);
    if (L.hp) c.push(`highpass=f=${L.hp}`);
    if (L.lp) c.push(`lowpass=f=${L.lp}`);
    c.push(`volume=${L.gain}dB`);
    if (L.fadeInMs) c.push(`afade=t=in:st=0:d=${(L.fadeInMs/1000).toFixed(3)}`);
    c.push(`adelay=${L.delayMs}|${L.delayMs}`);
    filts.push(`[${i}:a]${c.join(',')}[l${i}]`);
  });
  filts.push(`${layers.map((_,i)=>`[l${i}]`).join('')}amix=inputs=${layers.length}:normalize=0,asetpts=N/SR/TB[mx]`);
  filts.push(`[mx]afade=t=out:st=${(fadeOutAt/1000).toFixed(3)}:d=${((total-fadeOutAt)/1000).toFixed(3)},atrim=0:${(total/1000).toFixed(3)},alimiter=limit=0.9[out]`);
  ff([...ins,'-filter_complex',filts.join(';'),'-map','[out]','-ar','48000','-ac','1','-c:a','libvorbis','-q:a','5',`${OUT}/${name}.ogg`]);
  console.log(`  ${name}.ogg`);
}
// 结构：点（生效了）+ 渐强的尾（在恢复）。跟旧版单发 ping 的差别就在第二段
// 水层锁定 02：它的 250-2k 比 01 强 11.1dB，01 太闷。两个 water 变体是
// Suno 生的，族内差得离谱（方法论第八条），不能当轴用，只能挑好的那个
const V = [
  ['f2','01','01','02'],
  ['f3','02','02','02'],
  ['f2','02','01','02'],
];
V.forEach(([cf, gv, rv, wv], i) => {
  render(i ? `heal-${i+1}` : 'heal', [
    // 点：瓷盘。倾斜 +20.6，比 glass(+33) 温和 —— "暖"主要靠它
    { file: `ceramic_plate__tap__${cf}__01`, gain: 0, delayMs: 0 },
    // 泛音：玻璃杯只取 >2k，给一点清脆的叮，不带它的身体
    { file: `glass_cup__metal_spoon__p_edge__f_2__${gv}`, gain: -10, delayMs: 15, hp: 2000 },
    // 点缀：烤网只取 >2k 的闪烁。它倾斜 +33.6，给多了整体就往"亮"跑，
    // 而金属刮擦跟"治疗"没有语义关联 —— 只借它的渐强包络，不要它的身体
    { file: `grill_rack__metal_slide__spd1__${rv}`, gain: -13, delayMs: 60, hp: 2000 },
    // 过程：水做主。水润本来就是治疗的语义，且它不亮（倾斜 17.7）不拖高整体
    { file: `water_trickle__flow__${wv}`, gain: -12, delayMs: 40, lp: 4000, trimMs: 660, fadeInMs: 90 },
  ], { fadeOutAt: 600, total: 750 });
});
