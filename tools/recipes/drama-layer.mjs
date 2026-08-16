#!/usr/bin/env node
/**
 * 配方：棋门遁甲的戏剧层（锣 / 钹 / 筝 / 举盾落定鼓）
 *
 *   node tools/recipes/drama-layer.mjs <输出目录>
 *
 * 戏剧层 = 不对应任何物理事件的那一层，给的是"这一下很重要"的标记和文化质感。
 * 它跟物理层（atoms/ 那套）的判据是反的，别拿物理层的规矩套：
 *   - 可以带余韵和房间 —— 它在叙事空间里，不在场景的物理空间里
 *   - 素材来自外部 CC0 采样库（library/vcsl/），不是自录
 *
 * 四档映射（小天 2026-08-16 听审定）：
 *   light/medium  筝     丝弦    有音高、短
 *   heavy         钹     薄金属  炸开、无明确音高
 *   lethal        锣     厚金属  轰鸣、长余韵
 * 材质递进对应伤害递进。锣只给 lethal —— 它是"终结"的语义，用在普通命中会通胀。
 *
 * ── 两条踩过的坑 ──
 *
 * 1. 要不要时间错开，取决于**频段撞不撞**，不是一刀切
 *      筝在 300-600Hz 跟木头撞车（只差 3dB），必须延后 100ms 让木头的瞬态先出来
 *      钹在 >5k，跟木头不撞，就**必须对齐**——两个瞬态挨得近才融合成"一下"，
 *      错开反而听成两下。（实测：钹加 100ms 延迟后小天当场听出是两下）
 *
 * 2. 有音高的乐器必须先查 BGM 的调
 *      本作 BGM 是 D 调（battle/boss）和 G 调（battle-2/3）。Dan Tranh 原始调弦是
 *      B 大调五声（B C# D# F# G#），跟这两个调**一个音都不重合**。
 *      移调后取 D 大调五声（D E F# A B）—— 在 D 调是本调，在 G 调也全落在音阶内。
 *      移动量最多 1 个半音，asetrate 对音色的改变可以忽略。
 *      查调的工具：Goertzel 扫 12 半音求 chroma，见 git 历史里的 chroma.mjs。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync } from 'node:fs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/drama-layer.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const L = (f) => `library/vcsl/${f}`;
const A = (f) => `atoms/${f}`;
const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
};
const enc = ['-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5'];
const MONO = 'pan=mono|c0=0.5*c0+0.5*c1';
// 戏剧层统一的"房间"。物理层禁止这么做，这里是刻意的
const ROOM = 'aecho=0.9:0.75:60|130|220:0.30|0.18|0.10';
const ROOM_SHORT = 'aecho=0.9:0.75:60|130:0.25|0.14';

// ── 致命一击：锣 ──────────────────────────────────────────
// atrim 从 0.025 起 = 把峰从 60ms 提到 20ms，跟 piece-impact 的 5ms 瞬态融合。
// 2.2s 截断：原采样 27s，衰减到 2s 时已 -12dB，fade 收尾听不出被切。
ff(['-i', L('gong_fff.wav'), '-af',
  `atrim=0.025:2.225,asetpts=N/SR/TB,${MONO},afade=t=out:st=1.6:d=0.6`,
  ...enc, `${OUT}/lethal-gong.ogg`]);

// ── 重击：钹 ──────────────────────────────────────────────
// 不加 adelay（见坑 2）。highshelf 削 4dB 防刺。两档做变体池，
// 用同一目标响度而不是同一增益 —— 它们是候选不是力度轴。
for (const [src, gain, name] of [
  ['cymbal_mf.wav', 12.8, 'heavy-cymbal'],
  ['cymbal_mp.wav', 17.2, 'heavy-cymbal-2'],
]) {
  ff(['-i', L(src), '-af',
    `atrim=0:1.25,asetpts=N/SR/TB,${MONO},highshelf=g=-4:f=6000,`
    + `afade=t=out:st=0.75:d=0.5,${ROOM_SHORT},volume=${gain}dB,alimiter=limit=0.94`,
    ...enc, `${OUT}/${name}.ogg`]);
}

// ── 普通命中：筝 ──────────────────────────────────────────
// 半音数是移调量：D#→E、G#→A 各 +1，其余原样。
// adelay=100 给木头让路（见坑 1）；300-600Hz 只让了 1.6dB —— 不能再多，B4 基频就在那。
// 玩家打人用协和音（A B G#），挨打用不协和（D+E 大二度 / D / F#）—— 小天定的分组：
// 三全音 G# 给了 attack 而不是 hurt，因为它在金属乐里是"侵略性"不是"恐惧"。
const semi = (n) => (44100 * Math.pow(2, n / 12)).toFixed(3);
const zheng = (src, n, gain, name) =>
  ff(['-i', L(src), '-af',
    `asetrate=${semi(n)},aresample=48000,atrim=0:0.7,asetpts=N/SR/TB,`
    + `afade=t=out:st=0.45:d=0.25,volume=${gain}dB,${ROOM},highshelf=g=-2:f=4000,`
    + `adelay=100|100,asetpts=N/SR/TB,alimiter=limit=0.94`,
    ...enc, `${OUT}/${name}.ogg`]);
zheng('zheng_G#3_f.wav', 1, 9.5, 'attack-A');   // G#4 +1 → A4
zheng('zheng_B3_f.wav',  0, 9.5, 'attack-B');
zheng('zheng_G#3_f.wav', 0, 9.5, 'attack-Gs');  // 三全音，不移调
zheng('zheng_C#3_f.wav', 0, 9.5, 'hurt-D');     // 文件名 C#3，实测就是 D4
zheng('zheng_F#3_f.wav', 0, 9.5, 'hurt-Fs');
// hurt-DE：D 和 E 同时响 = 大二度，最刺耳的音程之一。单音编码不了"难听"，得靠音程
ff(['-i', L('zheng_C#3_f.wav'), '-i', L('zheng_D#3_f.wav'), '-filter_complex',
  `[0:a]atrim=0:0.7,asetpts=N/SR/TB,afade=t=out:st=0.45:d=0.25[a];`
  + `[1:a]asetrate=${semi(1)},aresample=48000,atrim=0:0.7,asetpts=N/SR/TB,afade=t=out:st=0.45:d=0.25[b];`
  + `[a][b]amix=inputs=2:normalize=0,asetpts=N/SR/TB,volume=7.8dB,${ROOM},`
  + `highshelf=g=-2:f=4000,adelay=100|100,asetpts=N/SR/TB,alimiter=limit=0.94[o]`,
  '-map', '[o]', ...enc, `${OUT}/hurt-DE.ogg`]);

// ── 举盾：聚拢 + 落定 ──────────────────────────────────────
// 两段式（composition.md 第四条）：倒放的金属给渐强（聚拢），鼓给成型（落定）。
// 只有渐强没有收尾 = "还在充能"，有了收尾才是"已经立住"。
// 前奏那 16dB 是听审调出来的：一开始给 2dB，前奏比收尾低 22.9dB 基本听不见；
// 现役老版两段只差 2.1dB。现在差 7.4dB —— 有层次又听得见。
// 金属正放垫 -8dB 在鼓下面：纯鼓听着像打鼓不像举盾，盾是金属的，那点泛音是身份。
// 必须两步（先出 wav 再降增益编码），不能压成一条链：limiter 在不同电平上削的量
// 不一样，一条链跑出来 peak 会顶到 0.1dB 而两步是 -1.6dB。整族同一增益，不各自归一。
for (const [drum, name] of [['drum_bass.wav', 'block-raise'], ['drum_frame.wav', 'block-raise-2']]) {
  const tmp = `${OUT}/${name}.__raw.wav`;
  ff(['-i', A('metal_board2__piece_drop__r_center__01.wav'), '-i', L(drum),
    '-i', A('metal_board2__piece_drop__r_center__02.wav'), '-filter_complex',
    `[0:a]areverse,atrim=0:0.28,asetpts=N/SR/TB,afade=t=in:st=0:d=0.16,volume=16dB,adelay=0|0[a];`
    + `[1:a]atrim=0:0.9,asetpts=N/SR/TB,${MONO},afade=t=out:st=0.5:d=0.4,volume=14dB,adelay=260|260[b];`
    + `[2:a]volume=-8dB,adelay=262|262[c];`
    + `[a][b][c]amix=inputs=3:normalize=0,asetpts=N/SR/TB,atrim=0:1.1,alimiter=limit=0.94[o]`,
    '-map', '[o]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', tmp]);
  ff(['-i', tmp, '-af', 'volume=-1.9dB', ...enc, `${OUT}/${name}.ogg`]);
  unlinkSync(tmp);
}

console.log(`写出 12 个到 ${OUT}`);
console.log('  lethal-gong / heavy-cymbal ×2 / attack-A·B·Gs / hurt-D·DE·Fs / block-raise ×2');
console.log('\n响度已在配方内定死，不要再跑 normalize-loudness —— 各档的相对关系是听审定的：');
console.log('  锣 -21.9（比 piece-impact-lethal 轻 3.6dB）/ 钹 -24.7 / 筝 -27~-30 / 举盾 -18.9（对齐现役）');
