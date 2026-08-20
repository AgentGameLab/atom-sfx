#!/usr/bin/env node
/**
 * 配方：棋门遁甲三种普通攻击的挥击音（attack-thrust / slash / blunt）
 *
 *   node tools/recipes/attack-swing.mjs <输出目录>
 *
 * 底座是 tools/ffkit.mjs。**跑完不用再跑 normalize-loudness** —— 响度收敛已经
 * 在 `ship()` 里，老版那条「渲一遍 → 编码 → 再解码压一遍 → 再编码」的两段式
 * 没了（顺带省掉一次 vorbis 往返：blunt 那三条老版是在 -37 LUFS 上编码完再补
 * 14dB 增益，编码噪声跟着一起抬）。
 *
 * -23 不是 -14：起手是**过程音**，要比命中轻一档。照搬命中音的 -14 会做出
 * RMS -15~-17 的挥击声，比整条命中链（piece-impact + hit-melee ≈ -18.6）还响
 * 4dB，听感是"发力在挥、落点没劲"。-23 落在 hit-melee(-26.3) 同档。
 *
 * ⚠️ **thrust 三条的目标写 -19.3 不是 -23，两个数是同一档**。它们只有 0.35s，
 *    ebur128 测不出，`ship()` 退到「有效 RMS+3」那把尺子 —— 同一条音效上这把
 *    尺子比 LUFS 读数高 3~3.3dB（slash 实测 LUFS -22.85 / 有效RMS+3 -19.90）。
 *    写 -23 会把 thrust 做得比 slash/blunt 轻 3.8dB，一族里就散了。
 *
 * 配方 = 一次交付的具体参数，不是通用工具。留着是为了可复现和照抄结构，
 * 换一批武器就复制一份改 BATCH，不要试图把它参数化成 CLI。
 *
 * 三个不能改回去的地方：
 *   1. 所有 whoosh 素材都 areverse —— 库里的口吹峰在 19-35%（"呼——"是渐弱），
 *      而挥击的物理是渐强（手臂加速，接触瞬间最快）。不倒放会听成收招。
 *   2. amix 之后必须 asetpts=N/SR/TB —— amix 保留 adelay 的 PTS 偏移，后面的
 *      atrim 按绝对时间戳裁，不重置就把开头连同内容一起切掉（实测峰被削 140ms）。
 *      （现在这句在 ffkit 的 `mix()` 里，配方不用自己写。）
 *   3. 层间配比走 `db` 不写 volume：`br()` 先把每条支路归一到统一有效 RMS，
 *      `db` 才真的是「这层比主层轻几 dB」。下面的 db 是照交付版逐支路实测换算的
 *      （`FFKIT_CAL=1`），配比跟听审过的那版一致 —— 顺便暴露了一件事：三个变体
 *      用的是同一组 gain 常数，但三条口吹 take 的实际电平差最多 3.4dB，
 *      **同一个常数在三条上其实是三个配比**。
 *
 * ── 压缩器：老版的压缩量是「捡来的」，迁移只能逐条钉住 ──────
 * 老版响度归一在 normalize-loudness 里，那一步按 crest 自动选压缩比，而且
 * 压缩器看到的是**合成产物编码后**的电平 —— 九条散在 -6.3 到 -22.7 dBFS。
 * 同一个 threshold=-26 在 blunt-2 上只压 2dB，在 thrust 上压 13dB。
 * ffkit 统一喂到 FEED_PEAK(-6)，所以每条要把阈值挪回它当时的相对位置：
 * 表里的 `rawPeak` 就是那条链上压缩器实际看到的输入峰值，`ratio` 是当时
 * 自动选中的那个值。
 *
 * **这九个数是「保交付版原样」用的，不是设计参数。** 真要重做这一族，该定的是
 * 一组统一的压缩档位再重新听审 —— 而不是继续维护这张表。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit, FEED_PEAK } from '../ffkit.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/attack-swing.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('attack-swing');
const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'atoms');
const A = (f, alias) => K.conv(join(ATOMS, `${f}.wav`), alias);
/** 老链上压缩器看到的输入峰值 → 喂到 -6 之后等价的阈值 */
const comp = (rawPeak, ratio) =>
  `acompressor=threshold=${(-26 + (FEED_PEAK - rawPeak)).toFixed(1)}dB:ratio=${ratio}:attack=3:release=140`;

// 时间锚：animateAttack windupEnd 168ms / impactAt 380ms。挥击的峰对齐到
// 340ms —— 命中前 40ms，刃/锤通过最近点的瞬间，命中音接在后面不打架。
function render(name, alias, layers, { fadeOutAt, total, shift, rawPeak, ratio, lufs }) {
  const parts = layers.map((L, i) => {
    const c = [];
    if (L.rev) c.push('areverse');           // 挥击是渐强，口吹素材是渐弱 —— 必须倒放
    if (L.trimMs) c.push(`atrim=0:${(L.trimMs / 1000).toFixed(3)},asetpts=N/SR/TB`);
    if (L.tempo && L.tempo !== 1) c.push(`atempo=${L.tempo}`);
    if (L.hp) c.push(`highpass=f=${L.hp}`);
    if (L.lp) c.push(`lowpass=f=${L.lp}`);
    const d = L.delayMs + shift;
    if (d) c.push(`adelay=${d}`);
    return K.br(A(L.file, `${alias}${i}`), c.join(',') || 'anull', `${alias}_${i}`, { db: L.db });
  });
  const fo = (fadeOutAt + shift) / 1000, tt = (total + shift) / 1000;
  K.ship(K.level(K.mix(parts,
    `afade=t=out:st=${fo.toFixed(3)}:d=${(tt - fo).toFixed(3)},atrim=0:${tt.toFixed(3)}`, alias),
    alias, { comp: comp(rawPeak, ratio) }), OUT, `${name}.ogg`, name, lufs);
}

const BATCH = {
  // 戳刺：最短最亮，尖峰后骤停。w_sharp 高通掉身体，只留锐气 + 一点刃刮
  // thrust 的峰提前到 280ms（其余两种是 340ms）：戳刺是直线突刺，武器速度在
  // 动作早期就到顶并保持，破空峰早于挥砍的弧线末端。三种共用一个峰位反而不对
  'attack-thrust': { fadeOutAt: 360, total: 410, lufs: -19.3, variants: [
    { shift: -60, rawPeak: -6.29, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_sharp__01', rev: 1, tempo: 1.25, db: 0, delayMs: 130, hp: 300 },
      { file: 'blade_wood__scrape__spd2__01', rev: 1, tempo: 1.3, db: 11.3, delayMs: 150, hp: 2500 } ] },
    { shift: -60, rawPeak: -8.04, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_sharp__02', rev: 1, tempo: 1.25, db: 0, delayMs: 130, hp: 300 },
      { file: 'blade_wood__scrape__spd2__02', rev: 1, tempo: 1.3, db: 9.0, delayMs: 150, hp: 2500 } ] },
    { shift: -40, rawPeak: -11.09, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_sharp__01', rev: 1, tempo: 1.3, db: 0, delayMs: 130, hp: 300 },
      { file: 'blade_wood__scrape__spd2__03', rev: 1, tempo: 1.3, db: 6.2, delayMs: 150, hp: 2500 } ] },
  ] },
  // 挥砍：三层。w_light 扫过 + w_heavy 垫中频身体 + blade_wood 一点刃感
  'attack-slash': { fadeOutAt: 380, total: 450, lufs: -23, variants: [
    { shift: 30, rawPeak: -12.35, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_light__01', rev: 1, tempo: 1.0, db: 0, delayMs: 40, hp: 250 },
      { file: 'breath_whoosh__mouth__w_heavy__01', rev: 1, tempo: 1.15, db: -13.8, delayMs: 20 },
      { file: 'blade_wood__scrape__spd2__01', rev: 1, tempo: 1.1, db: 2.0, delayMs: 90, hp: 2000 } ] },
    { shift: 20, rawPeak: -13.70, ratio: 2, layers: [
      { file: 'breath_whoosh__mouth__w_light__02', rev: 1, tempo: 1.0, db: 0, delayMs: 40, hp: 250 },
      { file: 'breath_whoosh__mouth__w_heavy__02', rev: 1, tempo: 1.15, db: -13.7, delayMs: 20 },
      { file: 'blade_wood__scrape__spd2__02', rev: 1, tempo: 1.1, db: 1.4, delayMs: 90, hp: 2000 } ] },
    { shift: 40, rawPeak: -10.72, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_light__03', rev: 1, tempo: 1.0, db: 0, delayMs: 40, hp: 250 },
      { file: 'breath_whoosh__mouth__w_heavy__03', rev: 1, tempo: 1.15, db: -16.6, delayMs: 20 },
      { file: 'blade_wood__scrape__spd2__03', rev: 1, tempo: 1.1, db: -6.1, delayMs: 90, hp: 2000 } ] },
  ] },
  // 钝击：最慢最低。w_heavy 低通掉刃感 + air_whoosh 只取 <500Hz 的风压当重量。
  // ⚠️ **但 air_whoosh 这层在交付版里实际上是静音**：`areverse` 之后 `atrim=0:0.5`
  //    取到的是原录音的**尾巴**那半秒，那儿本来就没声 —— 实测这层峰值只有
  //    -74.7 / -72.6 / -110.2 dBFS，比主层低 60dB 以上（同一批素材不倒放整条低通
  //    是 -5.4dB，差 70dB）。所以「低频风压给重量」这个设计在成品里没兑现，
  //    blunt 三条其实是单层。db 那三个夸张的负数就是这件事的实测值。
  //    迁移**保原样**（听审通过的是这一版）；要补重量得重挑素材段落再听审，
  //    别顺手改 atrim —— 那等于悄悄换掉一个已过审的音效。
  'attack-blunt': { fadeOutAt: 390, total: 480, lufs: -23, variants: [
    { shift: 0, rawPeak: -20.58, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_heavy__01', rev: 1, tempo: 1.05, db: 0, delayMs: 0, lp: 4000 },
      { file: 'air_whoosh__burst__01', rev: 1, tempo: 1.0, db: -49.7, delayMs: 0, lp: 500, trimMs: 500 } ] },
    { shift: 20, rawPeak: -22.73, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_heavy__02', rev: 1, tempo: 1.05, db: 0, delayMs: 0, lp: 4000 },
      { file: 'air_whoosh__burst__02', rev: 1, tempo: 1.0, db: -48.4, delayMs: 0, lp: 500, trimMs: 500 } ] },
    { shift: 60, rawPeak: -19.33, ratio: 3, layers: [
      { file: 'breath_whoosh__mouth__w_heavy__03', rev: 1, tempo: 1.05, db: 0, delayMs: 0, lp: 4000 },
      { file: 'air_whoosh__burst__03', rev: 1, tempo: 1.0, db: -84.5, delayMs: 0, lp: 500, trimMs: 500 } ] },
  ] },
};

for (const [defId, cfg] of Object.entries(BATCH)) {
  cfg.variants.forEach((v, i) => {
    const name = i ? `${defId}-${i + 1}` : defId;
    render(name, `${defId.slice(7)}${i + 1}`, v.layers, {
      fadeOutAt: cfg.fadeOutAt, total: cfg.total, shift: v.shift,
      rawPeak: v.rawPeak, ratio: v.ratio, lufs: cfg.lufs,
    });
  });
}
