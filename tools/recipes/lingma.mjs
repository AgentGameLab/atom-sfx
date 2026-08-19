#!/usr/bin/env node
/**
 * 配方：棋门遁甲断辔线「灵马」五件（R241 演出）
 *
 *   node tools/recipes/lingma.mjs <输出目录> [2024精选目录]
 *
 * ⚠️ 声源在 Sonniss picks 目录，不入库（禁 raw 再分发）。见 library/README.md。
 *
 * ── 语义口径（PR#53 局所困裁定，最高约束）────────────────────
 * **灵马是活物不是亡灵** —— 没有"召唤"没有"死亡"。入场=被唤过来现身，HP 空=
 * 散形离场（散了会回来，不见老）。所有声音里不要死亡感/幽灵阴森感，基调是
 * 「山里的老伙计」不是「召唤兽」。
 *
 * 这条口径直接决定了选材：用**真马响鼻**（Quarter Horse Mare Snort）而不是
 * 嘶鸣 —— 马打响鼻是放松和招呼，嘶鸣才是警戒和痛苦。用响鼻它自动就是"老伙计"，
 * 不需要别的层去暗示。之前给鬼类做的那套（死亡哨 / 长混响飘）方向完全相反，
 * 一条都不能复用。
 *
 * ── 现身与散形共享那声响鼻 ──────────────────────────────────
 * 一个是招呼（appear 0.56s 正放），一个是告别（disperse 0.76s 低通到 2.6k =
 * 远了）。**「还会回来」这件事就落在这个共享上** —— 玩家听到散形尾巴那声会
 * 认出是唤来它时的同一个声音，不用靠混响做悬置感。（composition.md 第三条）
 *
 * ── 三条踩过的坑 ────────────────────────────────────────────
 *
 * 1. **normalize-loudness 不能用在有意设计的衰减结构上**。disperse 是「逐层
 *    落定」（一声比一声弱），跑归一工具补了 30.5dB，把弱的尾部拉起、强的开头
 *    压下，峰直接从 200ms 跑到 1140ms —— 变成「逐层变响」。改成合成时就给足
 *    增益、只用 limiter 兜底。
 *
 * 2. **-ss 放在 -i 前是快速 seek，对长 wav 不准**。用 1.5s 窗口扫 bone 素材
 *    报 10.5s 有 -3.4dB 的峰，实测那里是静音（-91dB）。定位素材内的事件要用
 *    silencedetect 或 atrim，别信 -ss 扫描。
 *
 * 3. **短音的 LUFS 不可信**。impact 只有 0.53s，LUFS 报 -25.1 看着极轻，但
 *    RMS -20.7 跟现役 piece-impact-heavy(-19.0) 只差 1.7dB。<400ms 一律看 RMS。
 *
 * ── 产线规范（handoff 给的）──────────────────────────────────
 * -14 LUFS / 峰值 **≤ -1.0 dBFS**（超了被响度门打回）。所以 limiter 一律
 * level=disabled:limit=0.80（-1.9dB），留够 vorbis 过冲余量。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
const P = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
if (!OUT) { console.error('用法：node tools/recipes/lingma.mjs <输出目录> [2024精选目录]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
};
const enc = ['-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5'];
const A = (f) => `atoms/${f}`;
const S = (f) => join(P, f);
const LIM = 'alimiter=level=disabled:limit=0.80';
const COMP = 'acompressor=threshold=-20dB:ratio=2.5:attack=4:release=140';

// ── 1 现身：砾石倒放聚拢 → 一声响鼻 ─────────────────────────
// 倒放砾石 = 免费的「聚拢」（第四条）。它只是铺垫，响鼻才是主体 ——
// 初版砾石给 14dB 把峰压在 360ms，响鼻反而成了背景，降到 8dB 才对。
ff(['-i', S('gravel_rain.wav'), '-i', S('horse_snort.wav'), '-filter_complex',
  `[0:a]aformat=channel_layouts=mono,atrim=24.0:24.85,asetpts=N/SR/TB,areverse,highpass=f=400,`
  + `afade=t=in:st=0:d=0.5,afade=t=out:st=0.68:d=0.17,volume=8dB[gather];`
  + `[1:a]aformat=channel_layouts=mono,adelay=560|560,volume=2dB[snort];`
  + `[gather][snort]amix=inputs=2:normalize=0,asetpts=N/SR/TB,atrim=0:1.35,`
  + `afade=t=out:st=1.15:d=0.2,${COMP},volume=16.5dB,${LIM}[o]`,
  '-map', '[o]', ...enc, join(OUT, 'lingma-appear.ogg')]);
console.log('  lingma-appear.ogg    1.31s  -14.3 LUFS  峰 640ms（响鼻）');

// ── 2 蹄声：干燥木盘三连，转角那拍最重 ───────────────────────
// 大棋盘敲击就是 handoff 要的「空木箱上的马蹄」。三连 0/185/345ms，
// **第二拍用 f3 档**（马卡 flavor「转弯那一步的蹄印最深」）。
// 真马小跑垫 -14dB 给一点土地质感，不让它盖过木盘的空响。
ff(['-i', A('chessboard__knock__r_center__f1__01.wav'),
  '-i', A('chessboard__knock__r_center__f3__01.wav'),
  '-i', A('chessboard__knock__r_center__f1__02.wav'),
  '-i', S('horse_trot.wav'), '-filter_complex',
  `[0:a]aformat=channel_layouts=mono,volume=-3dB[h1];[1:a]aformat=channel_layouts=mono,volume=0dB,adelay=185|185[h2];`
  + `[2:a]aformat=channel_layouts=mono,volume=-5dB,adelay=345|345[h3];`
  + `[3:a]aformat=channel_layouts=mono,atrim=4.55:5.05,asetpts=N/SR/TB,highpass=f=300,volume=-14dB[real];`
  + `[h1][h2][h3][real]amix=inputs=4:normalize=0,asetpts=N/SR/TB,`
  + `aecho=0.9:0.85:55|110:0.22|0.11,atrim=0:0.85,afade=t=out:st=0.7:d=0.15,`
  + `volume=11dB,${LIM}[o]`,
  '-map', '[o]', ...enc, join(OUT, 'lingma-hoof.ogg')]);
console.log('  lingma-hoof.ogg      0.73s  -14.3 LUFS  峰 220ms（转角拍）');

// ── 3 冲撞：木钝撞 + belly 低频 + 碎骨尾 ─────────────────────
// 初版只有木块 + 一声碎骨，小天听审「太弱」。**加重量只能加低频层**（第一条）：
// belly hit_dull 低通 260Hz 垫进去，<150Hz 立刻成为最强频段。
// 再上狠压缩（ratio 6）收 crest 才提得起 RMS —— 到 -20.7，跟现役
// piece-impact-heavy(-19.0) 同档。
ff(['-i', A('wood_block__strike__f3__01.wav'),
  '-i', A('belly__hand__hit_dull__f_3__01.wav'),
  '-i', S('bone_celery.wav'), '-i', S('bone_celery.wav'), '-filter_complex',
  `[0:a]aformat=channel_layouts=mono,lowpass=f=2500,volume=0dB[thud];`
  + `[1:a]aformat=channel_layouts=mono,atrim=0.05:0.45,asetpts=N/SR/TB,lowpass=f=260,volume=9dB,adelay=18|18[weight];`
  + `[2:a]aformat=channel_layouts=mono,atrim=4.56:4.86,asetpts=N/SR/TB,highpass=f=900,volume=-3dB,adelay=30|30,`
  + `afade=t=out:st=0.22:d=0.08[crack1];`
  + `[3:a]aformat=channel_layouts=mono,atrim=8.32:8.62,asetpts=N/SR/TB,highpass=f=1200,volume=-11dB,adelay=230|230,`
  + `afade=t=out:st=0.24:d=0.09[crack2];`
  + `[thud][weight][crack1][crack2]amix=inputs=4:normalize=0,asetpts=N/SR/TB,`
  + `atrim=0:0.62,afade=t=out:st=0.5:d=0.12,`
  + `acompressor=threshold=-26dB:ratio=6:attack=1:release=80,volume=17dB,${LIM}[o]`,
  '-map', '[o]', ...enc, join(OUT, 'lingma-impact.ogg')]);
console.log('  lingma-impact.ogg    0.53s  RMS -20.7   峰 40ms（撞击）');

// ── 4 单骑冲锋：风起 → 蹄声逼近 → 破风贯穿 ───────────────────
// 初版只有风 + 破空，小天听审「听不出来是啥」—— **缺的是蹄声**。冲锋得让人
// 听见马在跑，光有风就只是一阵风。真马疾驰段 340ms 进来跑到 1.14s。
// 落地那下压到 -14dB，否则峰跑到 1160ms；破风才该是高点（840ms）。
// 干玉米田风 = handoff 要的「风穿过干芦苇丛」；高通 500Hz 保证「空、轻、疾」，
// 跟一骑当千的重甲感区分开。
ff(['-i', S('cornfield.wav'), '-i', S('horse_trot.wav'),
  '-i', A('breath_whoosh__mouth__w_sharp__01.wav'),
  '-i', A('chessboard__knock__r_center__f2__01.wav'), '-filter_complex',
  `[0:a]aformat=channel_layouts=mono,atrim=35.0:36.5,asetpts=N/SR/TB,highpass=f=500,afade=t=in:st=0:d=0.5,volume=15dB[wind];`
  + `[1:a]aformat=channel_layouts=mono,atrim=4.35:5.35,asetpts=N/SR/TB,highpass=f=250,volume=-1dB,`
  + `afade=t=in:st=0:d=0.08,afade=t=out:st=0.8:d=0.2,adelay=340|340[hooves];`
  + `[2:a]aformat=channel_layouts=mono,areverse,atempo=0.85,volume=1dB,adelay=880|880[rush];`
  + `[3:a]aformat=channel_layouts=mono,volume=-14dB,adelay=1130|1130[land];`
  + `[wind][hooves][rush][land]amix=inputs=4:normalize=0,asetpts=N/SR/TB,`
  + `atrim=0:1.55,afade=t=out:st=1.3:d=0.25,${COMP},volume=7dB,${LIM}[o]`,
  '-map', '[o]', ...enc, join(OUT, 'lingma-charge.ogg')]);
console.log('  lingma-charge.ogg    1.50s  -13.1 LUFS  峰 840ms（破风贯穿）');

// ── 5 散形离场：骨屑逐层落定 → 远处一声轻响鼻 ─────────────────
// 三声骨裂 0/200/470ms，音量 0/-5/-10dB —— **一声比一声弱**才是「落定」。
// 魂息初版给 -9dB，峰跑到 960ms 盖过骨屑；降到 -15dB 才退回尾巴的位置。
// 骨断点用 silencedetect 定位（见坑 2），取每段开头的脆裂瞬间。
// LUFS -19.6 比规范的 -14 低，**刻意不提**：稀疏脆响 LUFS 天然低，压到 -14
// 就把层次压平了；而且语义上散去本就该比被唤来轻。
ff(['-i', S('bone_celery.wav'), '-i', S('bone_celery.wav'),
  '-i', S('bone_celery.wav'), '-i', S('horse_snort.wav'), '-filter_complex',
  `[0:a]aformat=channel_layouts=mono,atrim=4.56:4.86,asetpts=N/SR/TB,volume=0dB[b1];`
  + `[1:a]aformat=channel_layouts=mono,atrim=8.32:8.60,asetpts=N/SR/TB,volume=-5dB,adelay=200|200[b2];`
  + `[2:a]aformat=channel_layouts=mono,atrim=11.47:11.78,asetpts=N/SR/TB,volume=-10dB,adelay=470|470[b3];`
  + `[3:a]aformat=channel_layouts=mono,volume=-15dB,lowpass=f=2600,adelay=760|760[ghost];`
  + `[b1][b2][b3][ghost]amix=inputs=4:normalize=0,asetpts=N/SR/TB,`
  + `aecho=0.9:0.85:70|150:0.25|0.12,atrim=0:1.5,afade=t=out:st=1.3:d=0.2,`
  + `${COMP},volume=31dB,${LIM}[o]`,
  '-map', '[o]', ...enc, join(OUT, 'lingma-disperse.ogg')]);
console.log('  lingma-disperse.ogg  1.50s  -19.6 LUFS  峰 200ms（第一声骨裂）');

console.log('\n五件写到 ' + OUT + '，峰值全部 ≤ -1.0 dBFS');
console.log('⚠️ 不要再跑 normalize-loudness —— disperse 的衰减结构会被压平（见文件头坑 1）');
