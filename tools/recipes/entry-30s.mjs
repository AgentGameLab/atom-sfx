#!/usr/bin/env node
/**
 * 配方：入游 30 秒 · 风底 + 兽声两声（草样）
 *
 *   node tools/recipes/entry-30s.mjs <输出目录> [Sonniss根目录]
 *
 * 脚本：xiaqiuqiu.com/d/qimen-entry-audio-rtlln6za（小梦 2026-09-08 v1）。这里只做
 * 脚本里「风」和「兽」两个声部；人声六句、他自己的三样声音（草鞋 / 棍 / 呼吸）不在
 * 本配方——那三样脚本要求干、近、不处理，小天自己录最准。
 *
 * ⚠️ 声源是 Sonniss（禁 raw 再分发，不入库）；产物只嵌进成片。
 *
 * ── 风：稳风底 + 两个阵头 + 山口哨音 ──────────────────────
 *   底   Eye Of The Storm（3 分钟设计风，1s RMS 波动 ±1dB，暗：频心 390）——全程，
 *        加一点 2.5k 以上的气，不然像在屋里
 *   阵头 Chimney Wind 05 里两段自然的起落（12–18s 那段 −36→−22→−29；29–35s 那段），
 *        掐掉它那根 2385Hz 的烟囱恒哨，摆到 0:10 / 0:23 前——脚本说阵头是节拍器，
 *        送走 V1 和 V4
 *   （不要 designed whoosh：首版压在阵头峰上当「牙」，小天听出「刷一下」——真风
 *        没有动作，删了。吞字是混音阶段用电平自动化对到词上，不在素材里。）
 *   哨音 Chimney 那根 2385 反过来只留它（bandpass），0:24 起极轻淡入——门缝哨音，
 *        脚本说「那也是风」
 *   0:26–0:30 无阵头，可截 loop。30s 无淡出。
 *
 * ── 兽：像鹿又像狼，都不是 ──────────────────────────────────
 *   鹿那一半 Large Herbivore Roar 01（大型食草兽低吼，频心 358）
 *   狼那一半 Werewolf Growl 06（中频低吼，频心 840）
 *   两条**用不同方向的 asetrate 变调再 atempo 复原时长**——asetrate 连共振峰一起搬，
 *   正是脚本要的「共振峰偏移」，两条搬的方向相反就谁都认不出。
 *   第一声 0:05：1.0s 一下，远（低通 3.5k、高通 150），一次回声 750ms −10dB
 *   第二声 0:20：两下 1.9s，第二下比第一下低 3 半音，近一档（低通 4.5k），回声 700ms
 *   回声只给兽不给人（脚本）：aecho 一条 delay，decay 0.3 ≈ −10dB，第二次回声 −20 在风下听不见
 *
 * ── 响度（草样口径）──────────────────────────────────────
 *   风底 −22 · 兽一 −20 · 兽二 −18；草样合成 −20。母带口径（−15 LKFS）等成片时按投放口填。
 *   草样合成里兽比风：第一声 −6dB、第二声 −2dB——脚本「远场低于风 0–4dB」是给人声的，
 *   兽是「空间的大小由兽说出来」，可以再远一点。
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
const SONNISS = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2026';
if (!OUT) { console.error('用法：node tools/recipes/entry-30s.mjs <输出目录> [Sonniss根]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('entry-30s');
const S = (rel, alias) => K.conv(join(SONNISS, rel), alias);
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
// 变调但不变长：asetrate 搬音高+共振峰，atempo 把时长拉回来
const shift = (n) => `asetrate=${semi(n)},aresample=48000,atempo=${Math.pow(2, -n / 12).toFixed(5)}`;

const eye = S('344 Audio - Extreme Winds Vol. 1/WINDDsgn_EXT, Eye Of The Storm_344 Audio_Extreme Winds Vol 1.wav', 'eye');
const chim = S('InMotionAudio - Chimney Wind/WINDInt_ChimneyWind05_InMotionAudio_ChimneyWind.wav', 'chim');
const herb = S('344 Audio - Dinosaurs Vol. 2/ANMLRept_Large Herbivore Roar 01_344 Audio_Dinosaurs Vol 2.wav', 'herb');
const wolf = S('Epic Stock Media - Halloween Game - Haunted House and Horror Audio Scare Kit/CREABeast_Creature Werewolf Growl Menacing Monstrous 06_ESM_HALG.wav', 'wolf');

const NO_WHISTLE = 'bandreject=f=2385:width_type=q:w=6';

// ═══ 风底 30s ═══════════════════════════════════════════════════
// ⚠ 首版底 0 / 阵头 −1 出来 1s RMS 全程 −20～−22 一条直线：br 把每层归一到同一有效
// RMS，阵头跟底一样响就没有起落；再过总线压缩更平。改：底 −8 当地板，阵头 +2
// 当峰（峰比地板高约 10dB），总线不压（comp anull）——阵性靠动态，不能压。
const wind = K.mix([
  // 底：全程，加气
  K.br(eye, 'atrim=30:60,asetpts=N/SR/TB,highpass=f=60,treble=g=5:f=2500', 'w_bed', { db: -8 }),
  // 阵头一：峰落在 ~0:10。Chimney 12–18s 那段起落，掐哨
  K.br(chim, `atrim=12:18,asetpts=N/SR/TB,${NO_WHISTLE},highpass=f=80,afade=t=in:st=0:d=0.8,afade=t=out:st=4.2:d=1.8,adelay=6500`, 'w_gust1', { db: 2 }),
  // 阵头二：峰落在 0:23，0:25 收干（0:24 起只剩稳风）。首版 19.5s 起就在涨，
  // 压住了 0:20 的兽二——兽先叫，风再来送走 V4，顺序不能反。
  K.br(chim, `atrim=13.5:17.5,asetpts=N/SR/TB,${NO_WHISTLE},highpass=f=80,afade=t=in:st=0:d=0.6,afade=t=out:st=2.4:d=1.6,adelay=21000`, 'w_gust2', { db: 2 }),
  // （首版在两个阵头峰上各压过一下 designed whoosh 当「咬字的牙」——小天听审：
  //   0:10 / 0:24 有「刷一下」奇怪的声音，就是它。设计风的 whoosh 有起有收像一个
  //   动作，真风没有动作。删。阵头只留烟囱风自然的起落；吞字靠电平自动化对到词上，
  //   那是混音阶段的事，不在素材里。）
  // 门缝哨音：0:24 起淡入，极轻
  K.br(chim, 'atrim=40:47,asetpts=N/SR/TB,bandpass=f=2385:width_type=q:w=12,afade=t=in:st=0:d=3,adelay=24000', 'w_whistle', { db: -22 }),
], 'atrim=0:30', 'wind');
K.ship(K.level(wind, 'wind', { comp: 'anull' }), OUT, 'entry-wind-30s.ogg', '风底 30s：Eye 底 + Chimney 两阵头 + 哨音', -22);

// ═══ 兽一 0:05：一下，远 ═══════════════════════════════════════
const beast1 = K.mix([
  K.br(herb, `atrim=5.0:6.0,asetpts=N/SR/TB,${shift(2)},afade=t=in:st=0:d=0.03,afade=t=out:st=0.70:d=0.30`, 'b1_herb', { db: 0 }),
  K.br(wolf, `atrim=0.5:1.5,asetpts=N/SR/TB,${shift(-3)},lowpass=f=2500,afade=t=in:st=0:d=0.05,afade=t=out:st=0.65:d=0.35`, 'b1_wolf', { db: -7 }),
], 'apad=pad_dur=1.8,highpass=f=150,lowpass=f=3500,aecho=1:1:750:0.3,atrim=0:2.6,afade=t=out:st=2.3:d=0.3', 'beast1');   // apad：给回声留尾巴，不然 amix 在 1s 就结束
K.ship(K.level(beast1, 'beast1'), OUT, 'entry-beast-1.ogg', '兽一：食草兽 +2 / 狼 −3，远，回声 750ms', -20);

// ═══ 兽二 0:20：两下，第二下更低，近一档 ═══════════════════════
const beast2 = K.mix([
  K.br(herb, `atrim=5.0:5.9,asetpts=N/SR/TB,${shift(1)},afade=t=in:st=0:d=0.03,afade=t=out:st=0.62:d=0.28`, 'b2_herbA', { db: 0 }),
  K.br(herb, `atrim=6.8:7.8,asetpts=N/SR/TB,${shift(-3)},afade=t=in:st=0:d=0.03,afade=t=out:st=0.70:d=0.30,adelay=950`, 'b2_herbB', { db: -1 }),
  K.br(wolf, `atrim=1.0:2.9,asetpts=N/SR/TB,${shift(-4)},lowpass=f=3000,afade=t=in:st=0:d=0.05,afade=t=out:st=1.5:d=0.4`, 'b2_wolf', { db: -8 }),
], 'apad=pad_dur=1.6,highpass=f=120,lowpass=f=4500,aecho=1:1:700:0.28,atrim=0:3.4,afade=t=out:st=3.0:d=0.4', 'beast2');
K.ship(K.level(beast2, 'beast2'), OUT, 'entry-beast-2.ogg', '兽二：两下，第二下 −3 半音，近一档，回声 700ms', -18);

// ═══ 他的脚步与棍：从成片视频原声里抠（小天 0908：「录脚步有点难，视频原声里就带」）═══
// D.mp4（30.08s，AAC 44.1k 立体声）的原声 0–16s 是一条 −41dB 的宽带底 + 脚步 + 棍：
//   脚步 15 下，间隔 1.07–1.14s（0.43 1.51 2.65 3.72 4.84 5.93 7.07 8.14 9.26 10.35
//        11.49 12.56 13.68 14.77 15.91），频心 830–1300，土路的闷
//   棍   6 下，每次落在某一步之后 0.35s（1.86 6.28 8.49 10.70 12.91 15.12），
//        频心 2000–2800、>2k 只低 3–5dB，是硬物点地的亮——脚本「每两步点一下」它自己就有
//   16s 之后没有脚步；20–23s 与 24.3–29.8s 是视频自己生成的两段低频轰鸣（另存出来给小天
//   听是什么，本配方不用）
// 抠法：afftdn 以底为噪声轮廓削 30dB，再 agate 峰值检测只放行瞬态——10ms 中位电平从
// −41.6 掉到 −66，脚步峰值 −26 不动。**时间轴原样保留，天然对画面。**
const VIDEO = process.argv[4] ?? 'E:/Download/D.mp4';
const stepsRaw = join(K.TMP, 's_video_audio.wav');
K.ff(['-i', VIDEO, '-vn', '-t', '16.8', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', stepsRaw]);
const steps = join(OUT, 'entry-steps-from-video.wav');
K.ff(['-i', stepsRaw, '-af', 'afftdn=nr=30:nf=-50:tn=1,agate=threshold=0.035:ratio=8:attack=0.5:release=90:detection=peak:knee=1',
  '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', steps]);
console.log('  entry-steps-from-video.wav   16.8s  视频原声抠出的脚步 15 + 棍 6，只作对画面的时间参考，不进成片');
// （小天 0908 再定：成片直接把我们的轨叠在视频原声上，脚步 / 棍 / 呼吸都用原声的，
//   本配方只做风、人声、兽。上面这条抠出来的脚步轨留着当对时参考。）

// ═══ 叠加轨 30s：风 + 兽一 @5s + 兽二 @20s（人声另一轨，录到再合）═══════
const overlay = K.mix([
  K.br(wind, 'anull', 'd_wind', { db: 0 }),
  K.br(beast1, 'adelay=5000', 'd_b1', { db: -6 }),
  K.br(beast2, 'adelay=20000', 'd_b2', { db: -2 }),
], 'atrim=0:30,afade=t=out:st=28.4:d=1.6', 'overlay');
K.ship(K.level(overlay, 'overlay', { comp: 'anull' }), OUT, 'entry-wind-beast-30s.ogg', '叠加轨：风 + 兽 0:05 / 0:20（叠在视频原声上），尾 1.6s 淡出', -20);

// ═══ 六句人声（小天 0909 自录 V1–V4，D:/Music/音效录制/）═══════════════
// 每个文件是一个声线的所有句子，clause 之间有真实停顿；小天用 marker 夹出要被风吞的字，
// 跟网页 class="gone" 一一对应（0906 核过：V1 7.1–8.3「可不能」· V2 3.0–4.2「这些日子」
// 6.3–7.0「就有那」12.3–13.3「这地儿啊」· V3 3.3–4.5「坡下那家的」6.2–7.2「前日」·
// V4 7.7–10.3「也是背这么个」）。
//
// ⚠ 录音比脚本的格子长 2–3 倍（V1 第一句 10.7s，脚本给 4s）。做了三件事仍塞不进 0:17：
//   ① clause 之间的长停顿剪到 0.4s（V1 那两处 1.2/1.8s）；② 最慢的几句 atempo ≤1.18；
//   ③ 人声窗口放宽到 0:01–0:23，V4 最后那半句正好被 0:23 的阵头吞掉——脚本本来就写
//   「说到一半被风吞掉」，这里吞的就是那几个字。第三句（关键句）不变速、不吞、近场。
//   人声在 0:17 前退光这条没守住，要么接受 0:23，要么删句——这是导演的事，不在配方里定。
//
// 处理照脚本：近场（1/2/3）高于风 6–8dB，远场（4/5/6）低于风 0–4dB、低通 3–4k、高通 200，
// 不加室内混响；吞字 = 那几个字 −10dB + 低通 900 + 一小口风对到字上；回声只给兽。
// 声像：V1 右前、V2 左前；0:12 后全部落到后半球（远场三句本来就在后面）。
const VOICE = process.argv[5] ?? 'D:/Music/音效录制';
const V = (n) => K.conv(join(VOICE, `${n}.wav`), `v${n}`);
const v1 = V('V1'), v2 = V('V2'), v3 = V('V3'), v4 = V('V4');
const tempo = (r) => (r === 1 ? '' : `atempo=${r},`);
// 吞字：在句内时间轴（已 atempo）上把 A–B 那几个字压下去。
// 首版是 enable=between 的开关：−10dB 瞬间进出 + 低通瞬间切——小天听审「太生硬，
// 不该是直接硬吞」。改成余弦坡：字前 0.3s 开始滑下去，字后 0.35s 滑回来，中心 −8.4dB
// （0.38）；滤波不再切（音色一跳就是剪辑痕）。真正把字盖掉的是对到字上的那口风。
const gone = (spans) => 'volume=volume=\'' + spans.map(([a, b]) =>
  `(1-0.62*(0.5-0.5*cos(PI*min(clip((t-${(a - 0.3).toFixed(2)})/0.3,0,1),clip((${(b + 0.35).toFixed(2)}-t)/0.3,0,1)))))`).join('*') + '\':eval=frame';
// clause 拼接：从同一文件截几段，段间留 gap 秒。
// ⚠ 二版之前两处硬伤（小天「吞得太生硬」的另一半来源）：① 段是按能量门贴着字切的，
//   拼回去中间是数字静音，字尾 50ms 一刀断——语音后面接绝对静音听着就是剪的；
//   ② V1 第一句我把「可不能｜在外头」在 marker 处切成两段再插 0.4s 空——那是连着说的，
//   中间根本没有停顿，硬插的空就是「硬吞」。
// 现在：每段两头各留 0.12s 本底（房间声跟着字走），淡入淡出 0.08s，段间 gap 也短了；
// 只在**真有停顿**的地方切，marker 不当切点。
const clauses = (src, parts, gap, alias) => {
  const segs = parts.map(([a, b], i) => K.br(src, `atrim=${a}:${b},asetpts=N/SR/TB,afade=t=in:st=0:d=0.08,afade=t=out:st=${(b - a - 0.08).toFixed(2)}:d=0.08,adelay=${Math.round(parts.slice(0, i).reduce((s, [x, y]) => s + (y - x) + gap, 0) * 1000)}`, `${alias}_c${i}`, { db: 0 }));
  return K.mix(segs, '', alias);
};
const near = 'highpass=f=80';
const far = (lp) => `highpass=f=200,lowpass=f=${lp}`;
// 四个声线都是小天一个人录的（0909「几个男声加点效果，尤其老人，音色有点变化」）。
// 变化靠三样：asetrate 连共振峰一起搬（往下搬人就变大变老——这里**不要**保共振峰的
// 变调，那会还是同一个人）、tremolo 给老嗓子一点抖、asoftclip 给一点沙。都很轻，
// 目的是「听出是三个人」，不是变声器。V3 妇人没动（小天只说了男声）。
const fx = {
  V1: `${shift(-2)},tremolo=f=5.2:d=0.12,asoftclip=type=tanh:threshold=0.72:output=1,lowpass=f=5500`,   // 老汉：矮两个半音、微抖、一点沙
  V2: `${shift(0.8)},acompressor=threshold=-22dB:ratio=3:attack=8:release=90`,                            // 中年男：略高一点、压着嗓子
  V4: `${shift(-3)},tremolo=f=6:d=0.22,asoftclip=type=tanh:threshold=0.65:output=1,lowpass=f=3200`,      // 更老、性别不辨：矮三个半音、抖得明显、更闷
};

// 第一句 V1 近·右前 @0:00.8：三段（「年轻人，」「天快黑了，」「可不能在外头待着啊。」——
// 后两个 clause 是连着说的，不切），段间 0.25s，atempo 1.1；「可不能」在句内 4.42–5.48
// 段两头各留 0.2s 本底、gap 0：两段的本底交叠淡接，停顿 ≈0.4s 全是房间声，没有数字静音的洞
const l1 = clauses(v1, [[0.21, 2.37], [3.14, 5.54], [6.93, 11.33]], 0, 'l1raw');
const line1 = K.br(l1, `${fx.V1},${tempo(1.1)}${near},${gone([[4.33, 5.39]])},adelay=800`, 'line1', { db: 6 });
// 第二句 V2 近·左 @0:07.2：整段 1.08–7.60，atempo 1.08；「这些日子」1.78–2.89、「就有那」4.83–5.48
const line2 = K.br(v2, `atrim=1.08:7.60,asetpts=N/SR/TB,${fx.V2},${tempo(1.08)}${near},${gone([[1.78, 2.89], [4.83, 5.48]])},afade=t=in:st=0:d=0.02,adelay=7200`, 'line2', { db: 6 });
// 第三句 V1 近·对 V2 @0:13.4：「……什么？」停一拍「你也听见了？」——不变速不吞，最清楚
const l3 = clauses(v1, [[13.23, 15.32], [15.59, 18.42]], 0, 'l3raw');   // 「停一拍」≈0.5s 本底
// 首版 +8、不滤波、全片最响——小天：「得小一点、远一点、淡一点」。它是关键句但不是
// 冲着他说的，是 V1 转头问 V2；改 +1、高通 150 低通 4.8k（退半步，字还全在）。
const line3 = K.br(l3, `${fx.V1},highpass=f=150,lowpass=f=4800,adelay=13400`, 'line3', { db: 1 });
// 第四句 V3 远·后左 @0:13.0：整段 0.02–12.32，atempo 1.18；「坡下那家的」2.78–3.80、「前日」5.24–6.08
const line4 = K.br(v3, `atrim=0.02:12.32,asetpts=N/SR/TB,${tempo(1.18)}${far(3400)},${gone([[2.78, 3.80], [5.24, 6.08]])},afade=t=in:st=0:d=0.02,adelay=13000`, 'line4', { db: -5 });
// 第五句 V2 远·后左 @0:16.0：整段 8.77–15.58，atempo 1.12；「这地儿啊」3.15–4.04
const line5 = K.br(v2, `atrim=8.77:15.58,asetpts=N/SR/TB,${fx.V2},${tempo(1.12)}${far(3200)},${gone([[3.15, 4.04]])},afade=t=in:st=0:d=0.02,adelay=16000`, 'line5', { db: -5 });
// 第六句 V4 最远·正后 @0:17.6：前半 0.19–6.2 + 1.0s 停 + 后半 7.36–12.45，atempo 1.1；
// 「……」那口气：原 2.2s 停顿从中间剪掉 0.7s，两边各留本底，剩 ≈1.5s，gap 0 无洞；
// 「也是背这么个」在句内 (6.53+0.40)/1.1 ≈ 6.30–8.66；0:22.5 起淡出——被 0:23 阵头吞掉，不说完
const l6 = clauses(v4, [[0.07, 6.60], [7.30, 12.57]], 0, 'l6raw');
const line6 = K.br(l6, `${fx.V4},${tempo(1.1)}${far(2800)},${gone([[6.30, 8.66]])},afade=t=out:st=4.9:d=1.6,adelay=17600`, 'line6', { db: -7 });

// 吞字对到字上的那口风：Chimney 12.6–14.6 那 2s 自然的涨（−36→−22），字前 0.45s 起，
// 涨到顶正好压在字上，字后 0.7s 落回去。+1（底是 −8）：比底高 9dB，比阵头（+2）小一档——
// 是一口风不是一阵。首版 1.4s / −4 / 提前 0.2s 起：太小太急，字听着像被剪掉的。
const goneAbs = [5.13, 8.98, 12.03, 15.78, 18.24, 19.15];
const puffs = goneAbs.map((t, i) => K.br(chim, `atrim=12.6:14.6,asetpts=N/SR/TB,${NO_WHISTLE},highpass=f=120,afade=t=in:st=0:d=0.5,afade=t=out:st=1.3:d=0.7,adelay=${Math.round((t - 0.45) * 1000)}`, `puff${i}`, { db: 1 }));

// 人声 stem（单声道，给小天单独调）
const voices = K.mix([line1, line2, line3, line4, line5, line6], 'atrim=0:30', 'voices');
K.ship(K.level(voices, 'voices', { comp: 'anull' }), OUT, 'entry-voices-30s.ogg', '人声 stem：六句已对位、已吞字', -18);

// 整条：风底(+小口风) + 兽 + 人声，立体声。这一步不走 K.mix（它是单声道），直接 ffmpeg 摆声像
const windP = K.mix([K.br(wind, 'anull', 'fw', { db: 0 }), ...puffs], 'atrim=0:30', 'windpuff');
const stereo = (L, R) => `pan=stereo|c0=${L}*c0|c1=${R}*c0`;
const fullWav = join(OUT, 'entry-full-v1-30s.wav');
const fullOgg = join(OUT, 'entry-full-v1-30s.ogg');
const ins = [
  [windP, 0, stereo(0.8, 0.8)],
  [beast1, 5000, stereo(0.75, 0.75)], [beast2, 20000, stereo(0.78, 0.78)],
  [line1, 0, stereo(0.45, 0.9)], [line2, 0, stereo(0.9, 0.45)], [line3, 0, stereo(0.55, 0.85)],
  [line4, 0, stereo(0.8, 0.5)], [line5, 0, stereo(0.8, 0.5)], [line6, 0, stereo(0.7, 0.7)],
];
// 各 stem 的相对电平：兽照叠加轨的 −6/−2；人声首版全 0 出来近场比风地板高 11–13dB
// （脚本 6–8）、远场比地板还高 2dB（脚本低 0–4）——近场 −4、远场 −5
// 二版 −5 出来远场仍高地板 4dB → −9 / −9 / −10（实测后落到地板下 1dB 左右）
const gainDb = [0, -6, -2, -4, -4, -7, -9, -9, -10];   // 第三句再退 −7（原 −3）
const chain = ins.map(([, d, p], i) => `[${i}:a]${d ? `adelay=${d}|${d},` : ''}volume=${gainDb[i]}dB,${p}[s${i}]`).join(';')
  // 尾 1.6s 淡出（小天：「现在是戛然而止」）。视频原声自己 29s 起也在收；风 stem 单独那条不淡——
  // 脚本说 0:26 起要截 loop，loop 素材不能带淡出。
  + `;${ins.map((_, i) => `[s${i}]`).join('')}amix=inputs=${ins.length}:normalize=0,atrim=0:30,afade=t=out:st=28.4:d=1.6,alimiter=level=disabled:limit=0.85[o]`;
K.ff([...ins.flatMap(([f]) => ['-i', f]), '-filter_complex', chain, '-map', '[o]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', fullWav]);
K.ff(['-i', fullWav, '-c:a', 'libvorbis', '-q:a', '6', fullOgg]);
console.log('  entry-full-v1-30s.wav/.ogg   30s 立体声整条：风 + 兽 + 六句（叠原声用）');

console.log('\n入游 30s 写到 ' + OUT);
