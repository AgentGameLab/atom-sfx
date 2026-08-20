#!/usr/bin/env node
/**
 * 配方：棋门遁甲断辔线「灵马」五件（R241 演出）
 *
 *   node tools/recipes/lingma.mjs <输出目录> [2024精选目录]
 *
 * ⚠️ 声源在 Sonniss picks 目录，不入库（禁 raw 再分发）。见 library/README.md。
 * 底座是 tools/ffkit.mjs —— 采样率归一 / 支路落盘验 NaN / 电平测量驱动都在那儿。
 *
 * ⚠️ **这条线的声源没有一个是 48k**：马响鼻和小跑是 192kHz，玉米地风、骨、
 *    砾石、地嗡是 96kHz，砾石还是**四声道**。老版直接喂进 filter_complex，
 *    整条链跑在协商出来的高采样率上，靠输出的 `-ar 48000` 兜底。现在全部先过
 *    `conv()` 转 48k 单声道 —— 本配方没用 asetrate 所以老版侥幸没出事，但同一
 *    个坑在劫线上是真炸了（docs/composition.md 十二）。
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
 *    增益、只用 limiter 兜底。迁到 ffkit 之后这件事由 `ship()` 接手：它只搜一个
 *    整体增益，不动内部结构。
 *
 * 2. **-ss 放在 -i 前是快速 seek，对长 wav 不准**。用 1.5s 窗口扫 bone 素材
 *    报 10.5s 有 -3.4dB 的峰，实测那里是静音（-91dB）。定位素材内的事件要用
 *    silencedetect 或 atrim，别信 -ss 扫描。
 *
 * 3. **短音的 LUFS 不可信**。impact 只有 0.53s，LUFS 报 -25.1 看着极轻，但
 *    RMS -20.7 跟现役 piece-impact-heavy(-19.0) 只差 1.7dB。<400ms 一律看 RMS。
 *
 * ── 层间配比走 `db`，不写 volume ────────────────────────────
 * `br()` 把每条支路先归一到统一有效 RMS，`db` 才是真的「比主层轻几 dB」。
 * 下面这些 db 是照迁移前那版**逐支路实测**换算出来的（`FFKIT_CAL=1` 跑一遍，
 * 见 ffkit 里那段注释），所以配比跟听审通过的那版一模一样 —— 只是从此是测量
 * 语义，不再是"素材原始电平 + 手填 volume"的赌博。
 *
 * ── 压缩器的阈值跟着 FEED_PEAK 挪过 ─────────────────────────
 * 老版压缩器长在**混完的原始电平**上，`level()` 会先把峰值对齐到 FEED_PEAK
 * (-6)，同一个 threshold 就等于压得狠得多。所以下面每条自带压缩器的阈值都按
 * 「老链上压缩器实际看到的输入峰值」换算过（差多少补多少），压缩量与迁移前
 * 一致。**这是迁移时最容易漏的一步**，漏了的听感是衰减尾整个变形。
 *
 * ── 产线规范（handoff 给的）──────────────────────────────────
 * -14 LUFS / 峰值 **≤ -1.0 dBFS**（超了被响度门打回）。ffkit 的 LIM 就是
 * `level=disabled:limit=0.80`（-1.9dB），留够 vorbis 过冲余量。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
const P = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
if (!OUT) { console.error('用法：node tools/recipes/lingma.mjs <输出目录> [2024精选目录]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('lingma');
const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'atoms');
const A = (f, alias) => K.conv(join(ATOMS, f + '.wav'), alias);
const S = (f, alias) => K.conv(join(P, f + '.wav'), alias);

const gravel = S('gravel_rain', 'gravel');   // 96k 四声道
const snort = S('horse_snort', 'snort');     // 192k
const trot = S('horse_trot', 'trot');        // 192k 立体声
const bone = S('bone_celery', 'bone');       // 96k 立体声
const corn = S('cornfield', 'corn');         // 96k 立体声
const hoofA = A('chessboard__knock__r_center__f1__01', 'hoof_a');
const hoofB = A('chessboard__knock__r_center__f3__01', 'hoof_b');
const hoofC = A('chessboard__knock__r_center__f1__02', 'hoof_c');
const board = A('chessboard__knock__r_center__f2__01', 'board');
const woodBlock = A('wood_block__strike__f3__01', 'wood');
const belly = A('belly__hand__hit_dull__f_3__01', 'belly');
const sharp = A('breath_whoosh__mouth__w_sharp__01', 'sharp');

// ── 1 现身：砾石倒放聚拢 → 一声响鼻 ─────────────────────────
// 倒放砾石 = 免费的「聚拢」（第四条）。它只是铺垫，响鼻才是主体 ——
// 初版砾石压过响鼻把峰钉在 360ms，退到比响鼻轻 4.6dB 才对。
K.ship(K.level(K.mix([
  K.br(gravel, 'atrim=24.0:24.85,asetpts=N/SR/TB,areverse,highpass=f=400,'
    + 'afade=t=in:st=0:d=0.5,afade=t=out:st=0.68:d=0.17', 'a_gather', { db: -2.1 }),
  K.br(snort, 'adelay=560', 'a_snort', { db: 0 }),
], 'atrim=0:1.35,afade=t=out:st=1.15:d=0.2', 'appear'), 'appear',
  // 老链上这条压缩器看到的输入峰值是 -10.7dBFS，ffkit 喂 -6 —— 阈值从 -20 挪到 -15.3
  { comp: 'acompressor=threshold=-15.3dB:ratio=2.5:attack=4:release=140' }),
  OUT, 'lingma-appear.ogg', '砾石聚拢 + 响鼻（峰 640ms）', -14.4);

// ── 2 蹄声：干燥木盘三连，转角那拍最重 ───────────────────────
// 大棋盘敲击就是 handoff 要的「空木箱上的马蹄」。三连 0/185/345ms，
// **第二拍用 f3 档**（马卡 flavor「转弯那一步的蹄印最深」）。
// 真马小跑垫在下面给一点土地质感，不让它盖过木盘的空响。
K.ship(K.level(K.mix([
  K.br(hoofA, 'anull', 'h_1', { db: -5.3 }),
  K.br(hoofB, 'adelay=185', 'h_2', { db: 0 }),
  K.br(hoofC, 'adelay=345', 'h_3', { db: -8.1 }),
  K.br(trot, 'atrim=4.55:5.05,asetpts=N/SR/TB,highpass=f=300', 'h_real', { db: -36.2 }),
], 'aecho=0.9:0.85:55|110:0.22|0.11,atrim=0:0.85,afade=t=out:st=0.7:d=0.15', 'hoof'), 'hoof',
  // 老版这条整条没有压缩器（只有 volume + limiter），迁移不给它加
  { comp: 'anull' }),
  // depth 12：交付版是 `volume=11dB` 直接顶进 limiter 换来的响度，实测削掉
  // 10.8dB，超过 ffkit 默认的 8dB 上限。这里保交付版原样并把深度显式写出来。
  OUT, 'lingma-hoof.ogg', '木盘三连 0/185/345（峰 220ms 转角拍）', -14.3, { depth: 12 });

// ── 3 冲撞：木钝撞 + belly 低频 + 碎骨尾 ─────────────────────
// 初版只有木块 + 一声碎骨，小天听审「太弱」。**加重量只能加低频层**（第一条）：
// belly hit_dull 低通 260Hz 垫进去，<150Hz 立刻成为最强频段。
// 再上狠压缩（ratio 6）收 crest 才提得起 RMS —— 到 -20.7，跟现役
// piece-impact-heavy(-19.0) 同档。
K.ship(K.level(K.mix([
  K.br(woodBlock, 'lowpass=f=2500', 'i_thud', { db: 0 }),
  K.br(belly, 'atrim=0.05:0.45,asetpts=N/SR/TB,lowpass=f=260,adelay=18', 'i_weight', { db: 0.1 }),
  K.br(bone, 'atrim=4.56:4.86,asetpts=N/SR/TB,highpass=f=900,adelay=30,'
    + 'afade=t=out:st=0.22:d=0.08', 'i_crack1', { db: -22.9 }),
  K.br(bone, 'atrim=8.32:8.62,asetpts=N/SR/TB,highpass=f=1200,adelay=230,'
    + 'afade=t=out:st=0.24:d=0.09', 'i_crack2', { db: -36.1 }),
], 'atrim=0:0.62,afade=t=out:st=0.5:d=0.12', 'impact'), 'impact',
  // 老链输入峰值 -3.3dBFS → 阈值 -26 挪到 -28.7
  { comp: 'acompressor=threshold=-28.7dB:ratio=6:attack=1:release=80' }),
  OUT, 'lingma-impact.ogg', '木撞 + 低频重量 + 碎骨（峰 40ms）', -25.1);

// ── 4 单骑冲锋：风起 → 蹄声逼近 → 破风贯穿 ───────────────────
// 初版只有风 + 破空，小天听审「听不出来是啥」—— **缺的是蹄声**。冲锋得让人
// 听见马在跑，光有风就只是一阵风。真马疾驰段 340ms 进来跑到 1.14s。
// 落地那下压得很低，否则峰跑到 1160ms；破风才该是高点（840ms）。
// 干玉米田风 = handoff 要的「风穿过干芦苇丛」；高通 500Hz 保证「空、轻、疾」，
// 跟一骑当千的重甲感区分开。
K.ship(K.level(K.mix([
  K.br(corn, 'atrim=35.0:36.5,asetpts=N/SR/TB,highpass=f=500,'
    + 'afade=t=in:st=0:d=0.5', 'c_wind', { db: 0 }),
  K.br(trot, 'atrim=4.35:5.35,asetpts=N/SR/TB,highpass=f=250,'
    + 'afade=t=in:st=0:d=0.08,afade=t=out:st=0.8:d=0.2,adelay=340', 'c_hooves', { db: -23.0 }),
  K.br(sharp, 'areverse,atempo=0.85,adelay=880', 'c_rush', { db: -21.7 }),
  K.br(board, 'adelay=1130', 'c_land', { db: -14.8 }),
], 'atrim=0:1.55,afade=t=out:st=1.3:d=0.25', 'charge'), 'charge',
  // 老链输入峰值 +10.1dBFS（风那层 volume=15dB 推上去的）→ 阈值 -20 挪到 -36.1
  { comp: 'acompressor=threshold=-36.1dB:ratio=2.5:attack=4:release=140' }),
  OUT, 'lingma-charge.ogg', '风 → 蹄声逼近 → 破风贯穿（峰 840ms）', -13.1);

// ── 5 散形离场：骨屑逐层落定 → 远处一声轻响鼻 ─────────────────
// 三声骨裂 0/200/470ms，**一声比一声弱**才是「落定」。
// 魂息初版太响，峰跑到 960ms 盖过骨屑；再降 6dB 才退回尾巴的位置。
// 骨断点用 silencedetect 定位（见坑 2），取每段开头的脆裂瞬间。
// LUFS -19.7 比规范的 -14 低，**刻意不提**：稀疏脆响 LUFS 天然低，压到 -14
// 就把层次压平了；而且语义上散去本就该比被唤来轻。
K.ship(K.level(K.mix([
  K.br(bone, 'atrim=4.56:4.86,asetpts=N/SR/TB', 'd_b1', { db: 0 }),
  K.br(bone, 'atrim=8.32:8.60,asetpts=N/SR/TB,adelay=200', 'd_b2', { db: -10.5 }),
  K.br(bone, 'atrim=11.47:11.78,asetpts=N/SR/TB,adelay=470', 'd_b3', { db: 5.9 }),
  K.br(snort, 'lowpass=f=2600,adelay=760', 'd_ghost', { db: -9.6 }),
], 'aecho=0.9:0.85:70|150:0.25|0.12,atrim=0:1.5,afade=t=out:st=1.3:d=0.2', 'disperse'), 'disperse',
  // 老链输入峰值 -17.7dBFS（这条几乎没压到）→ 阈值 -20 挪到 -8.4。照搬 -20 的实测
  // 后果：attack=4ms 放过瞬态、把瞬态之后全按下去，crest 反而涨了 4dB，ship 怎么
  // 补都够不到目标 —— 「压了反而更轻」这种反直觉现象就是阈值没跟着挪
  { comp: 'acompressor=threshold=-8.4dB:ratio=2.5:attack=4:release=140' }),
  // depth 15：全库最深的一条 —— 交付版 `volume=31dB` 顶进 limiter，实测削掉
  // 13.9dB。稀疏脆响本来就是这么换响度的，但**这条要是哪天重做，先看能不能
  // 靠抬身体层解决**，别默认照抄这个深度。
  OUT, 'lingma-disperse.ogg', '骨屑逐层落定 + 远处响鼻（峰 200ms）', -19.7, { depth: 15 });

console.log('\n五件写到 ' + OUT + '，峰值全部 ≤ -1.0 dBFS');
