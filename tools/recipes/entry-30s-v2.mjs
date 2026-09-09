#!/usr/bin/env node
/**
 * 配方：入游 30 秒 · v2（0909 A梦 听审：「咋做成恐怖片去了」「恐怖片 80% 是声音」）
 *
 *   node tools/recipes/entry-30s-v2.mjs <输出目录> [Sonniss根] [D.mp4] [人声目录] [Commons根]
 *
 * 脚本仍是 xiaqiuqiu.com/d/qimen-entry-audio-rtlln6za（小梦 0908 v1）。v1 偏离脚本的地方
 * 这版逐条改回去，另外把 v1 没做的空间做出来：
 *
 *   ① 兽不再用 Halloween 套件里的狼人吼——那条素材本身就是恐怖片的。改用公有领域的
 *      麋鹿（NPS 录音）：bugle 那声哨往下搬 6–9 个半音、bellow 往下搬 3–6，两条方向不同的
 *      共振峰偏移叠在一起，「像鹿又像狼，都不是」。兽比 v1 再退 3dB（−9 / −5）。
 *   ② 六句人声按脚本「干、真、不处理」：去掉 v1 的 tremolo / softclip / lowpass 音色处理
 *      （0909 小天要「老人加点效果」，我加的抖音就是鬼声）。只留 asetrate 变调把一个人
 *      分成三个人——那是身份不是效果。
 *   ③ 空间：v1 实测整条塌成单声道（风 side −120dB，远场人声 corr 1.00）。这版：
 *      · 风：L / R 用 Eye 两段不相关的素材各一条 + 中间一条粘合，阵头用 12ms Haas 从一侧进
 *      · 兽：直达在正前，山谷回声拆成左右两条不同延迟（700 / 830ms）——空间由兽说出来
 *      · 远场人声：落到后半球 = 电平降 + 高频削 + 9–11ms Haas 展宽（脚本原话）；不加回声
 *   ④ 时间轴对实际画面重标：D.mp4 里 20.0s 手已到门环（原声 20.31 抓环，21.33 / 22.36 两下
 *      敲门）。脚本写的 0:24 是分镜时间，这条片是 0:20。所以兽二 18.2、阵头二峰 20.4、
 *      人声 21.2 前全部退光，敲门前只剩风和他自己。
 *   ⑤ 他自己：原声里的脚步 + 棍从头到 20.0 都有（16s 后是轻的，v1 抠成了「没有」）——
 *      抠出来放正中不处理，16s 起按 2dB/s 抬回来当「上坡变重」。呼吸仍留给小天录（stem 位）。
 *   ⑥ 两个版本：A = 不要台词（A梦 0909 提议）；B = 六句照脚本规矩做。只听不看，各选各的。
 *   ⑦ 呼吸（小天 0909 11:41 录，35s 连续一条，18 口，周期 ≈1.9s，峰 −35…−46 dBFS）：不演，只做
 *      脚本那条「全片唯一往上走的线」的电平包络——0–8 几乎听不见，8–12 浮出，12–19 往上，19–21
 *      到门最重，21–30 慢慢放平但不消失。正中、干；只削一点本底（afftdn 轻）。阵头二从 +2 退到 0：
 *      脚本「风的阵头可以盖住人声，不能盖住他的呼吸」。小天听审「呼吸太抢了」：基准 +21 → +15。
 *   ⑧ V1 / V2 换小天 0909 11:53 重录（rerecord-v1/v2：「之前的录法有点故弄玄虚，这版更接近正常说话」）。
 *      正常语速、自带停顿，不再剪 clause 不再 atempo；吞字位置用 faster-whisper 词时间戳 + 能量段核出来。
 *   ⑨ 人声越来越远（小天 0909）：主角在往前走，同一句话从开口到说完也该越来越远。每句拆两路：
 *      近路（原声、前侧）按句内进度 1→0.15 淡掉，远路（高通 200 低通 2400、后侧 + Haas）0→0.8 淡入，
 *      整体再随进度压 −5dB——说到句尾时人已在身后、变闷、变小。远场三句只做电平随进度 −6dB。
 *   ⑩ 囊中木牌（小天 0909 / 脚本「每一步之后半拍，几片薄木隔着布磕一下，闷而碎」）：牌压桌 f1 原子
 *      前 160ms，掐掉 2070 桌面共振、低通 2600、±0.7 半音抖动，每步 +0.42s，最后一步后荡两下（第二下 −6）。
 *   ⑪ 人声换小天 0909 12:45 的四条缩混（D:/Music/视频配音/intro录制_缩混v1–4 = V1–V4，各含该声线全部句子，
 *      片段之间数字静音）。双单声道、干、无混响；四个声线他自己已经分开（F0 中位 165 / 101 / 176 / 95），
 *      所以不再变调不再压缩，一律 anull。V3 从 12.3s 缩到 7.1s、V4 从 11.5s 缩到 5.3s，倍速全部取消，六句原速塞进 20s。
 *   ⑫ 小天 0909 13:2x 四条：呼吸换 呼吸v2（26s，20 口，周期 1.25s，比 v1 轻 3dB，「之前太重」）；风整体 −4；
 *      人声要山谷的空间感——六句先汇成人声总线，湿声 = 每声道两下离散反射（左 190/390、右 250/470ms，−13/−18dB，
 *      高通 250 低通 1600，各过一个短抽头扩散器糊掉，不反馈）；第一版 7 抽头反馈梳被小天听成「脑海里幻想的声音」；
 *      本机 ffmpeg 的 afir 连单脉冲 IR 都卷出零，合成 IR 那条路走不通。他自己的声音不进这条总线（脚本）。
 *      抓环（原声 20.31）之后：兽 20.45 起 80ms 收干（含回声），风 20.45 起 0.6s 余弦降到 −8dB 留一点，呼吸照旧慢慢
 *      放平，木牌荡回来那下（20.80）和门的原声（敲门 / 推门）都留着——小天 13:4x：「还是要留一点风，呼吸也还在」，
 *      第一版抓环后全静是表述问题。门 stem 也另出（entry-door-v2.wav）。
 *
 * ⚠️ 声源：Sonniss 风 / 食草兽（禁 raw 再分发）；麋鹿两条 = Wikimedia Commons 公有领域
 *   （American Elk Bugling: NPS Jim Pisarowicz, PD；Elkbellow: PD）。CC BY-SA 的那几条鹿
 *   （大英图书馆梅花鹿 / 赤鹿、麂）下了但**不用**——SA 会传染到成片。
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';
const ATOMS = fileURLToPath(new URL('../../atoms/', import.meta.url));

const OUT = process.argv[2];
const SONNISS = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2026';
const VIDEO = process.argv[4] ?? 'E:/Download/D.mp4';
const VOICE = process.argv[5] ?? 'D:/Music/视频配音';   // 0909 12:45 四条缩混（intro录制_缩混v1–4）
const COMMONS = process.argv[6] ?? fileURLToPath(new URL('../../library/commons-pd/', import.meta.url));   // 两条 PD 麋鹿进仓了（library/README.md §commons-pd）
const BREATH = process.argv[7] ?? 'D:/Music/音效录制/呼吸v2.wav';   // v2（13:21）；v1 = 音效-呼吸.wav
if (!OUT) { console.error('用法：node tools/recipes/entry-30s-v2.mjs <输出目录> [Sonniss根] [D.mp4] [人声目录] [Commons根] [呼吸.wav]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('entry-30s-v2');
const S = (rel, alias) => K.conv(join(SONNISS, rel), alias);
const C = (rel, alias) => K.conv(join(COMMONS, rel), alias);
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
const shift = (n) => `asetrate=${semi(n)},aresample=48000,atempo=${Math.pow(2, -n / 12).toFixed(5)}`;

const eye = S('344 Audio - Extreme Winds Vol. 1/WINDDsgn_EXT, Eye Of The Storm_344 Audio_Extreme Winds Vol 1.wav', 'eye');
const chim = S('InMotionAudio - Chimney Wind/WINDInt_ChimneyWind05_InMotionAudio_ChimneyWind.wav', 'chim');
const herb = S('344 Audio - Dinosaurs Vol. 2/ANMLRept_Large Herbivore Roar 01_344 Audio_Dinosaurs Vol 2.wav', 'herb');
const bugle = C('American_Elk_Bugling.ogg', 'bugle');   // 11kHz 单声道，哨音 1–2.4k 上扬，1.0–3.6s 可用
const bellow = C('Elkbellow.ogg', 'bellow');            // 基频 ~300，泛音到 4k，0.3–2.9s
const NO_WHISTLE = 'bandreject=f=2385:width_type=q:w=6';
const BED = 'highpass=f=60,treble=g=5:f=2500';

// ═══ 风：三条不相关的底（L / R / 中）+ 两个阵头 + 哨音 ═══════════════
// Eye 是 3 分钟设计风，但它是 30s 一圈的 loop（自相关：偏移 30/60/90/120 处 0.64，其余 ≈0）——
// 首次拿 30–60 / 90–120 / 150–180 三段以为不相关，实测 corr 0.65，整条风还是单声道。
// 偏移必须避开 30 的倍数：L 30–60 / R 45–75 / 中 67–97，三段互不相关（各 ≈0.00）。中间一段粘合（−3）。立体声阶段再摆。阵头二峰 20.4：手到门环那一下把身后最后半句吹走，21.2 前收干，
// 不压 21.33 的敲门。（v1 阵头二在 21 起、峰 22.4——正好糊在两下敲门上。）
const windL = K.br(eye, `atrim=30:60,asetpts=N/SR/TB,${BED}`, 'w_L', { db: -8 });
const windR = K.br(eye, `atrim=45:75,asetpts=N/SR/TB,${BED}`, 'w_R', { db: -8 });
const windC = K.br(eye, `atrim=67:97,asetpts=N/SR/TB,${BED}`, 'w_C', { db: -8 });
const gust1 = K.br(chim, `atrim=12:18,asetpts=N/SR/TB,${NO_WHISTLE},highpass=f=80,afade=t=in:st=0:d=0.8,afade=t=out:st=4.2:d=1.8,adelay=6500`, 'w_gust1', { db: 2 });
const gust2 = K.br(chim, `atrim=13.5:17.5,asetpts=N/SR/TB,${NO_WHISTLE},highpass=f=80,afade=t=in:st=0:d=0.6,afade=t=out:st=1.9:d=1.4,adelay=18200`, 'w_gust2', { db: 0 });
const whistle = K.br(chim, 'atrim=40:47,asetpts=N/SR/TB,bandpass=f=2385:width_type=q:w=12,afade=t=in:st=0:d=3,adelay=22500', 'w_whistle', { db: -22 });

// ═══ 兽：麋鹿 bugle（哨）+ 麋鹿 bellow（喉）+ 食草兽（胸），三条各搬各的 ═══════
// 干声在这里做，回声不在这里——回声是空间，留到立体声阶段拆左右。
// 兽一 0:05：一下，1.1s，远（高通 150 低通 3000）
const beast1 = K.mix([
  K.br(bellow, `atrim=0.4:1.6,asetpts=N/SR/TB,${shift(-4)},afade=t=in:st=0:d=0.04,afade=t=out:st=0.8:d=0.4`, 'b1_bellow', { db: 0 }),
  K.br(bugle, `atrim=1.2:2.4,asetpts=N/SR/TB,${shift(-7)},highpass=f=400,afade=t=in:st=0:d=0.08,afade=t=out:st=0.75:d=0.45`, 'b1_bugle', { db: -5 }),
  K.br(herb, `atrim=5.0:6.0,asetpts=N/SR/TB,${shift(2)},lowpass=f=900,afade=t=in:st=0:d=0.03,afade=t=out:st=0.7:d=0.3`, 'b1_herb', { db: -7 }),
], 'apad=pad_dur=0.6,highpass=f=150,lowpass=f=3000,atrim=0:1.8', 'beast1');
K.ship(K.level(beast1, 'beast1'), OUT, 'entry-beast-1-v2.ogg', '兽一：麋鹿 bellow −4 + bugle −7 + 食草兽胸，1.1s，远，干声（回声在整条里）', -20);
// 兽二 0:18.2：两下，第二下低三个半音、更短；近一档（低通 4000）
const beast2 = K.mix([
  K.br(bellow, `atrim=0.3:1.3,asetpts=N/SR/TB,${shift(-3)},afade=t=in:st=0:d=0.04,afade=t=out:st=0.65:d=0.35`, 'b2_bellowA', { db: 0 }),
  K.br(bugle, `atrim=1.4:2.4,asetpts=N/SR/TB,${shift(-6)},highpass=f=400,afade=t=in:st=0:d=0.08,afade=t=out:st=0.6:d=0.4`, 'b2_bugleA', { db: -5 }),
  K.br(bellow, `atrim=1.2:2.1,asetpts=N/SR/TB,${shift(-6)},afade=t=in:st=0:d=0.04,afade=t=out:st=0.55:d=0.35,adelay=1000`, 'b2_bellowB', { db: -1 }),
  K.br(bugle, `atrim=2.3:3.2,asetpts=N/SR/TB,${shift(-9)},highpass=f=350,afade=t=in:st=0:d=0.08,afade=t=out:st=0.5:d=0.4,adelay=1000`, 'b2_bugleB', { db: -6 }),
  K.br(herb, `atrim=6.8:7.8,asetpts=N/SR/TB,${shift(-1)},lowpass=f=900,afade=t=in:st=0:d=0.03,afade=t=out:st=0.6:d=0.4,adelay=1000`, 'b2_herb', { db: -7 }),
], 'apad=pad_dur=0.6,highpass=f=120,lowpass=f=4000,atrim=0:2.6', 'beast2');
K.ship(K.level(beast2, 'beast2'), OUT, 'entry-beast-2-v2.ogg', '兽二：两下，第二下 −3 半音，近一档，干声', -18);

// ═══ 他自己：原声里的脚步 / 棍 / 抓环 / 敲门 / 推门 ═══════════════════════
// afftdn 削底 30dB + agate 峰值门只放瞬态（v1 同法）。v1 只抠了 0–16.8s，说 16s 后没脚步——
// 门后 30s 全跑一遍：17.32 / 18.18 / 19.29 / 19.97 还有四步（−27 … −23，比前面轻 5–8dB），
// 20.31 抓环 −13.7，21.33 / 22.36 敲门 −3.8 / −2.8，24.66 / 25.43 / 26.11 推门。
// 脚步 0–20.2：16s 起 2dB/s 抬回来（上坡步子变重）；门 20.2–30：原样，正中。
const gated = join(K.TMP, 'd_gated.wav');
K.ff(['-i', VIDEO, '-vn', '-ac', '1', '-ar', '48000', '-af',
  'afftdn=nr=30:nf=-50:tn=1,agate=threshold=0.035:ratio=8:attack=0.5:release=90:detection=peak:knee=1', '-c:a', 'pcm_f32le', gated]);
const steps = join(OUT, 'entry-steps-v2.wav');
K.ff(['-i', gated, '-af', "atrim=0:20.2,volume=volume='if(lt(t,16),1,pow(10,(2*(min(t,20)-16))/20))':eval=frame,apad=whole_dur=30", '-c:a', 'pcm_f32le', steps]);
const door = join(K.TMP, 'd_door.wav');
K.ff(['-i', gated, '-af', 'volume=0:enable=\'lt(t,20.2)\'', '-c:a', 'pcm_f32le', door]);
K.ff(['-i', door, '-c:a', 'pcm_f32le', join(OUT, 'entry-door-v2.wav')]);
console.log('  entry-door-v2.wav           30s  原声抠出的抓环 20.31 / 敲门 21.33 22.36 / 推门 24.7–26.1（整条里也有，−5dB；不要就把 door 那行的 volume 拉到底）');
console.log('  entry-steps-v2.wav          30s  原声抠出的脚步 + 棍到 20.0（16s 起抬 8dB），正中干声');
// 呼吸：小天的连续一条，取 0–30；录音里有 140–150Hz 的房间低鸣（比本底高 37dB），高通 180 去掉——
// 呼吸本身在 300Hz 以上，这不是处理人声是去房间；本底 −57 再轻削；包络 dB 分段线性，之后整体 +21 摆到「比风近」
const BREATH_ENV = "if(lt(t,8),-16,if(lt(t,12),-16+8*(t-8)/4,if(lt(t,19),-8+8*(t-12)/7,if(lt(t,21),2*(t-19)/2,2-5*(t-21)/9))))";
const breathRaw = K.conv(BREATH, 'breath');
const breath = join(OUT, 'entry-breath-v2.wav');
K.ff(['-i', breathRaw, '-af', `atrim=0:26,asetpts=N/SR/TB,apad=whole_dur=30,highpass=f=180,afftdn=nr=10:nf=-62,volume=volume='pow(10,(15+(${BREATH_ENV}))/20)':eval=frame,alimiter=level=disabled:limit=0.9`, '-c:a', 'pcm_f32le', breath]);
console.log('  entry-breath-v2.wav         30s  呼吸：小天原录 + 往上走的包络（0–8 −16dB … 19–21 +2dB … 30 −3dB），基准 +15，正中干声');

// ═══ 囊中木牌：每步之后半拍，几片薄木隔着布磕一下 ═══════════════════════
// 步子时间是原声里抠出来的（见上），最后一步 19.97 之后囊荡过去又荡回来：20.42 一下、20.80 轻的一下
const STEPS_T = [0.43, 1.51, 2.65, 3.72, 4.84, 5.93, 7.07, 8.14, 9.26, 10.35, 11.49, 12.56, 13.68, 14.77, 15.91, 17.32, 18.18, 19.29, 19.97];
const tagSrc = ['f1__01', 'f1__02', 'f1__03'].map((n, i) => K.conv(join(ATOMS, `wood_tag__press__${n}.wav`), `tag${i}`));
const TAG_NOTCH = 'bandreject=f=2070:width_type=q:w=6';
const tagEvents = [...STEPS_T.map((t, i) => [t + 0.42 + (((i * 7) % 5) - 2) * 0.02, 0]), [20.42, 0], [20.80, -6]];
const tags = K.mix(tagEvents.map(([t, g], i) => K.br(tagSrc[i % 3],
  `atrim=0:0.16,asetpts=N/SR/TB,${TAG_NOTCH},${shift((((i * 5) % 3) - 1) * 0.7)},lowpass=f=2600,afade=t=out:st=0.10:d=0.06,adelay=${Math.round(t * 1000)}`,
  `tag_${i}`, { db: g })), 'atrim=0:30', 'tags');
K.ff(['-i', tags, '-c:a', 'pcm_f32le', join(OUT, 'entry-tags-v2.wav')]);
console.log('  entry-tags-v2.wav           30s  囊中木牌：每步 +0.42s 一磕，最后荡两下，正中');

// ═══ 六句人声（B 版）：干、真；只留变调分人 ═══════════════════════════════
const V = (n) => K.conv(join(VOICE, `${n}.wav`), `v${n}`);
const v1 = V('intro录制_缩混v1'), v2 = V('intro录制_缩混v2'), v3 = V('intro录制_缩混v3'), v4 = V('intro录制_缩混v4');
const tempo = (r) => (r === 1 ? '' : `atempo=${r},`);
const gone = (spans) => 'volume=volume=\'' + spans.map(([a, b]) =>
  `(1-0.62*(0.5-0.5*cos(PI*min(clip((t-${(a - 0.3).toFixed(2)})/0.3,0,1),clip((${(b + 0.35).toFixed(2)}-t)/0.3,0,1)))))`).join('*') + '\':eval=frame';
const clauses = (src, parts, gap, alias) => {
  const segs = parts.map(([a, b], i) => K.br(src, `atrim=${a}:${b},asetpts=N/SR/TB,afade=t=in:st=0:d=0.08,afade=t=out:st=${(b - a - 0.08).toFixed(2)}:d=0.08,adelay=${Math.round(parts.slice(0, i).reduce((s, [x, y]) => s + (y - x) + gap, 0) * 1000)}`, `${alias}_c${i}`, { db: 0 }));
  return K.mix(segs, '', alias);
};
const near = 'highpass=f=80';
const far = (lp) => `highpass=f=200,lowpass=f=${lp}`;
// 一个人录四个声线：只用 asetrate 搬（连共振峰一起搬，人就变了），不加抖、不加沙、不压。
// V2 保留一点压缩——那是「压着嗓子」的动态，不是音色。
const fx = { V1: 'anull', V2: 'anull', V4: 'anull' };   // 缩混已分声线，不再动
// 小天 0909：所有话放在前 15s，最后一句 20 前收尾，之后只有主角一个人。
// l1 0.8–7.05 · l2 7.1–12.9 · l3 13.1–15.45 ｜ 身后：l4 10.5–17.6 · l6 13.6–18.85 · l5 15.2–19.85（末字 19.62）；阵头二峰 19.7 送走最后几个字
// ——20.0 手到门环，脚本「到了门口，人没了」对到这条片的 0:20 上。
// 缩混 v1：片段 A 0–8.03「哎（1.00）年轻人（1.77）天快黑了（3.39）可不能在外头待着啊（4.98–6.87）」｜片段 B 12.51–15.81「什么（12.78）你也听见了（13.88–14.72）」
// 「可不能」4.98–5.60 → 句内（起点 0.85）4.13–4.75
const line1 = K.br(v1, `atrim=0.85:7.10,asetpts=N/SR/TB,${near},${gone([[4.13, 4.75]])},afade=t=in:st=0:d=0.05,afade=t=out:st=6.0:d=0.2,adelay=800`, 'line1', { db: 6 });
// 缩混 v2：片段 A 0–5.81「哎（0.04）听见没（0.97）这些日子（2.00–2.84）一到夜里（3.24）就有那（4.48–4.88）叫唤（5.34）」
//          片段 B 11.86–17.22「哎，别看了，别看了（12.33–13.61）这地儿（14.38–15.02）是待不下去了（15.40–16.62）」
const line2 = K.br(v2, `atrim=0:5.81,asetpts=N/SR/TB,highpass=f=160,${gone([[2.00, 2.84], [4.48, 4.88]])},afade=t=in:st=0:d=0.03,afade=t=out:st=5.6:d=0.2,adelay=7100`, 'line2', { db: 6 });
const line3 = K.br(v1, `atrim=12.60:14.95,asetpts=N/SR/TB,highpass=f=150,lowpass=f=4800,afade=t=in:st=0:d=0.03,afade=t=out:st=2.15:d=0.2,adelay=13100`, 'line3', { db: 1 });
// 缩混 v3：0.18「那黑气是吃人的」（1.82）2.50「坡下那家的」3.14「丫头」3.58 ｜ 4.04「前日」4.48「去河边打水」5.44「人就没了」7.04
// 「坡下那家的」2.50–3.14 → 句内（起点 0.05）2.45–3.09；「前日」4.04–4.48 → 3.99–4.43
const line4 = K.br(v3, `atrim=0.05:7.15,asetpts=N/SR/TB,${far(3400)},${gone([[2.45, 3.09], [3.99, 4.43]])},afade=t=in:st=0:d=0.03,afade=t=out:st=6.9:d=0.2,adelay=10500`, 'line4', { db: -5 });
// 「这地儿」14.38–15.02 → 句内（起点 12.20）2.18–2.82
const line5 = K.br(v2, `atrim=12.20:16.85,asetpts=N/SR/TB,${far(3200)},${gone([[2.18, 2.82]])},afade=t=in:st=0:d=0.03,afade=t=out:st=4.45:d=0.2,adelay=15200`, 'line5', { db: -5 });
// 缩混 v4：0.70「我爷爷那辈儿」1.73 ｜ 2.24「也有个上去的」3.23 ｜ 3.88「也是背这么个」5.02「行囊」5.62
// 「也是背这么个」3.88–5.02 → 句内（起点 0.55）3.33–4.47；「行囊」18.07–18.55 落在 18.18 那步的木牌（18.60）上
const line6 = K.br(v4, `atrim=0.55:5.80,asetpts=N/SR/TB,${far(2800)},${gone([[3.33, 4.47]])},afade=t=in:st=0:d=0.03,afade=t=out:st=5.05:d=0.2,adelay=13600`, 'line6', { db: -7 });
// 吞字那口风（同 v1 手法），时间随远场三句前移
// 各吞字词头的绝对时间：l1 可 4.93 · l2 这些 9.10 / 就有那 11.58 · l4 坡下 12.95 / 前日 14.49 · l6 也是背 16.93 ≈ l5 这地儿 17.38（合一口 17.1）
const goneAbs = [4.93, 9.10, 11.58, 12.95, 14.49, 17.1];
const puffs = goneAbs.map((t, i) => K.br(chim, `atrim=12.6:14.6,asetpts=N/SR/TB,${NO_WHISTLE},highpass=f=120,afade=t=in:st=0:d=0.5,afade=t=out:st=1.3:d=0.7,adelay=${Math.round((t - 0.45) * 1000)}`, `puff${i}`, { db: 1 }));
const voices = K.mix([line1, line2, line3, line4, line5, line6], 'atrim=0:30', 'voices');
K.ship(K.level(voices, 'voices', { comp: 'anull' }), OUT, 'entry-voices-v2.ogg', '人声 stem（B 版）：干声、已对位、已吞字、21.2 前退光', -18);
const windCP = K.mix([K.br(windC, 'anull', 'fwc', { db: 0 }), ...puffs], 'atrim=0:30', 'windCpuff');

// ═══ 山谷：人声总线的湿声 ═══════════════════════════════════════════
// 第一版用 7 抽头反馈梳（85ms 起、每抽头自反馈），小天听审「像脑海里幻想的声音」——反馈梳 = 规律的颤动回声 +
// 湿声铺满整个立体声场没有方向，这就是「在脑子里」的听感。改成真山谷的做法：
//   · 每声道只有两下离散反射，来得晚（左 190/390ms、右 250/470ms），不反馈，不重复
//   · 暗：高通 250、低通 1600（山壁弹回来的只剩中低段）；每下 −13 / −18dB
//   · 每下不是干净的拷贝，过一个短抽头扩散器（6–37ms、衰减 ≤0.22，两轮后 −14dB，只糊不响）——干净的延迟拷贝就是「效果器」
//   · 有方向：左反射偏左、右反射偏右，跟身后的人声错开，而不是一团铺满
// 本机 ffmpeg 的 afir 卷积出零（单脉冲 IR 也零），合成 IR 那条路走不通。
const DIFFUSE = 'aecho=1:1:6|11|17|26|37:0.22|0.2|0.17|0.15|0.12';
const valley = (inLabel, out) => `[${inLabel}]asplit=2[${out}l][${out}r];`
  + `[${out}l]pan=mono|c0=0.7*c0+0.3*c1,highpass=f=250,lowpass=f=1600,asplit=2[${out}l1][${out}l2];[${out}l1]adelay=190,volume=-13dB[${out}L1];[${out}l2]adelay=390,volume=-18dB[${out}L2];`
  + `[${out}L1][${out}L2]amix=inputs=2:normalize=0,${DIFFUSE},pan=stereo|c0=0.9*c0|c1=0.35*c0[${out}L];`
  + `[${out}r]pan=mono|c0=0.3*c0+0.7*c1,highpass=f=250,lowpass=f=1600,asplit=2[${out}r1][${out}r2];[${out}r1]adelay=250,volume=-13dB[${out}R1];[${out}r2]adelay=470,volume=-18dB[${out}R2];`
  + `[${out}R1][${out}R2]amix=inputs=2:normalize=0,${DIFFUSE},pan=stereo|c0=0.35*c0|c1=0.9*c0[${out}R];`
  + `[${out}L][${out}R]amix=inputs=2:normalize=0,volume=0dB[${out}]`;

// ═══ 立体声整条 ═══════════════════════════════════════════════════════
// 声像用 pan 直摆；后半球 = 电平降 + 高频削 + Haas（同一条延迟 9–11ms 摆到另一侧，先到的
// 那一侧定位、晚到的那条把它拉宽——脚本「略展宽」）。兽的回声拆两条：左 700ms −10、右 830ms −12，
// 各自低通——山谷不是一面墙。
const st = (L, R) => `pan=stereo|c0=${L}*c0|c1=${R}*c0`;
const haas = (tag, ms, aL, aR, bL, bR) => `asplit[${tag}a][${tag}b];[${tag}a]${st(aL, aR)}[${tag}A];[${tag}b]adelay=${ms},${st(bL, bR)}[${tag}B]`;
// 越走越远：W = 句内进度 0→1。近路前侧 1→0.15，远路（高通 200 低通 2400）后侧 0→0.8 + Haas，整体再 ×(1−0.45W)
const W = (s, d, w0 = 0) => w0 ? `(${w0}+${(1 - w0).toFixed(2)}*clip((t-${s})/${d},0,1))` : `clip((t-${s})/${d},0,1)`;
// w0：开口时已经走出去的份额（0 = 贴耳开口）。小天 0909：V2 开口太近太大 → l2 用 0.35，一开口就已在半远处
const walkNear = (tag, s, d, fL, fR, rL, rR, ms, gain, w0 = 0) => `volume=${gain}dB,asplit[${tag}n][${tag}f];`
  + `[${tag}n]volume=volume='(1-0.85*${W(s, d, w0)})*(1-0.45*${W(s, d, w0)})':eval=frame,${st(fL, fR)}[${tag}N];`
  + `[${tag}f]highpass=f=200,lowpass=f=2400,volume=volume='0.8*${W(s, d, w0)}*(1-0.45*${W(s, d, w0)})':eval=frame,asplit[${tag}f1][${tag}f2];`
  + `[${tag}f1]${st(rL, rR)}[${tag}F1];[${tag}f2]adelay=${ms},${st(rR * 0.5, rL * 0.5)}[${tag}F2]`;
// 抓环之后风退到 −8dB 留一点（20.45 起 0.6s 余弦），阵头二那时已收完，门缝哨音（22.5 起）不参与
const DUCK = "volume=volume='if(lt(t,20.45),1,if(lt(t,21.05),1-0.6*(0.5-0.5*cos(PI*(t-20.45)/0.6)),0.4))':eval=frame";
const BEAST_CUT = 'afade=t=out:st=20.45:d=0.08';
const walkFar = (tag, s, d, ms, aL, aR, bL, bR, gain) => `volume=${gain}dB,volume=volume='(1-0.5*${W(s, d)})':eval=frame,${haas(tag, ms, aL, aR, bL, bR)}`;
function build(variant) {
  // [file, delayMs, filterChain→label list]
  const ins = [
    // 风整体 −4（小天 0909「风声太大了」）：底 / 阵头 / 哨音一起退，人声、他自己、兽不动
    [windL, `volume=-4dB,${DUCK},${st(0.95, 0)}[o0]`],
    [windR, `volume=-4dB,${DUCK},${st(0, 0.95)}[o1]`],
    [windCP, `volume=-7dB,${DUCK},${st(0.6, 0.6)}[o2]`],
    [gust1, `volume=-4dB,${DUCK},${haas('g1', 12, 0, 0.9, 0.7, 0)}`, ['g1A', 'g1B']],          // 阵头一从右边进
    [gust2, `volume=-4dB,${DUCK},${haas('g2', 12, 0.9, 0, 0, 0.7)}`, ['g2A', 'g2B']],          // 阵头二从左边进
    [whistle, `volume=-4dB,${st(0.5, 0.8)}[o5]`],
    [beast1, `adelay=5000,volume=-9dB,asplit=3[b1d][b1x][b1y];[b1d]${st(0.7, 0.7)}[b1D];[b1x]adelay=700,volume=-10dB,lowpass=f=2500,${st(0.85, 0.3)}[b1X];[b1y]adelay=830,volume=-12dB,lowpass=f=2200,${st(0.3, 0.85)}[b1Y]`, ['b1D', 'b1X', 'b1Y']],
    [beast2, `adelay=18200,volume=-5dB,asplit=3[b2d][b2x][b2y];[b2d]${BEAST_CUT},${st(0.72, 0.72)}[b2D];[b2x]adelay=700,volume=-10dB,lowpass=f=2800,${BEAST_CUT},${st(0.85, 0.3)}[b2X];[b2y]adelay=830,volume=-12dB,lowpass=f=2400,${BEAST_CUT},${st(0.3, 0.85)}[b2Y]`, ['b2D', 'b2X', 'b2Y']],   // 抓环后连回声一起收
    [steps, `volume=8dB,${st(0.72, 0.72)}[o8]`],
    [door, `volume=-5dB,${st(0.66, 0.78)}[o9]`],
    // 呼吸：小天 0909 13:5x「呼吸声去掉」——stem 照出（entry-breath-v2.wav），整条里不放
    [tags, `volume=-6dB,${st(0.7, 0.7)}[o17]`],
  ];
  if (variant === 'B') ins.push(
    [line1, walkNear('v1', 0.8, 6.25, 0.45, 0.9, 0.35, 0.85, 9, -1), ['v1N', 'v1F1', 'v1F2']],    // V1 右前 → 右后
    [line2, walkNear('v2', 7.1, 5.8, 0.9, 0.45, 0.85, 0.35, 9, -3, 0.25), ['v2N', 'v2F1', 'v2F2']],   // V2 左前 → 左后；开口太近太大：−3dB、w0 0.25（−5/0.35 量出来句头低风 5.7，过了）
    [line3, walkNear('v3', 13.1, 2.35, 0.55, 0.85, 0.4, 0.8, 9, -3), ['v3N', 'v3F1', 'v3F2']],    // V1 转向 V2，已在身后
    [line4, walkFar('v4', 10.5, 7.1, 9, 0.85, 0.4, 0.2, 0.6, -2), ['v4A', 'v4B']],    // 远·后左
    [line5, walkFar('v5', 15.2, 4.65, 8, 0.85, 0.4, 0.2, 0.6, -2), ['v5A', 'v5B']],   // 远·后左
    [line6, walkFar('v6', 13.6, 5.25, 11, 0.7, 0.5, 0.5, 0.7, -3), ['v6A', 'v6B']],    // 最远·正后
  );
  const labels = [], vlabels = [];
  const N_NV = ins.length - (variant === 'B' ? 6 : 0);   // 前 N_NV 条不是人声
  const chain = ins.map(([, f, outs], i) => {
    const m = f.match(/\[o\d+\]$/);
    const dst = i < N_NV ? labels : vlabels;
    if (m) dst.push(m[0]); else dst.push(...outs.map((l) => `[${l}]`));
    return `[${i}:a]${f}`;
  }).join(';')
    // 人声总线 → 山谷湿声（aecho 梳，左右各一套）→ 干 + 湿 一起进总和；他自己的声音不进这条
    + (vlabels.length ? `;${vlabels.join('')}amix=inputs=${vlabels.length}:normalize=0,asplit[vdry][vsend];${valley('vsend', 'vwet2')}` : '')
    // 尾 1.6s 淡出（视频 29s 起也在收）
    + `;${labels.join('')}${vlabels.length ? '[vdry][vwet2]' : ''}amix=inputs=${labels.length + (vlabels.length ? 2 : 0)}:normalize=0,atrim=0:30,afade=t=out:st=28.4:d=1.6,alimiter=level=disabled:limit=0.85[o]`;
  const raw = join(K.TMP, `full_${variant}.wav`);
  K.ff([...ins.flatMap(([f]) => ['-i', f]), '-filter_complex', chain, '-map', '[o]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', raw]);
  // 整条按 −18 LUFS 出（脚本：送审口径 −15 LKFS 等投放口定；−18 留 3dB 给母带）——只量到切点，后面的静音不算
  const lufs = +(spawnSync('ffmpeg', ['-i', raw, '-af', 'atrim=0:20.45,ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0]);
  const name = variant === 'A' ? 'entry-full-v2A-nolines-30s' : 'entry-full-v2B-lines-30s';
  const wav = join(OUT, `${name}.wav`);
  K.ff(['-i', raw, '-af', `volume=${(-18 - lufs).toFixed(2)}dB,alimiter=level=disabled:limit=0.89`, '-c:a', 'pcm_s24le', wav]);
  K.ff(['-i', wav, '-c:a', 'libvorbis', '-q:a', '6', join(OUT, `${name}.ogg`)]);
  console.log(`  ${name}.wav/.ogg   30s 立体声整条（原 ${lufs.toFixed(1)} → −18 LUFS）`);
  return wav;
}
const fullA = build('A');
const fullB = build('B');

// 风 stem（立体声，无淡出，给小天单独调 / 截 loop）
const windStem = join(OUT, 'entry-wind-v2-stereo.wav');
K.ff(['-i', windL, '-i', windR, '-i', windCP, '-i', gust1, '-i', gust2, '-i', whistle, '-filter_complex',
  `[0:a]${st(0.95, 0)}[a];[1:a]${st(0, 0.95)}[b];[2:a]volume=-3dB,${st(0.6, 0.6)}[c];[3:a]${haas('g1', 12, 0, 0.9, 0.7, 0)};[4:a]${haas('g2', 12, 0.9, 0, 0, 0.7)};[5:a]${st(0.5, 0.8)}[w];[a][b][c][g1A][g1B][g2A][g2B][w]amix=inputs=8:normalize=0,atrim=0:30[o]`,
  '-map', '[o]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', windStem]);
console.log('  entry-wind-v2-stereo.wav     风 stem 立体声（L/R 不相关 + 阵头 Haas），无淡出');
console.log('\n入游 30s v2 写到 ' + OUT + '\n  A = 不要台词（风 + 兽 + 他自己 + 门）· B = 六句照脚本（干声、后半球、21.2 前退光）');
export { fullA, fullB };
