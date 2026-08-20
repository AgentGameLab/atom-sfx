#!/usr/bin/env node
/**
 * 配方：棋门遁甲敌人起手叫声（十一个发声原型）
 *
 *   node tools/recipes/enemy-cry.mjs <输出目录> [Sonniss根目录] [2024精选]
 *   默认 Sonniss 根 = E:/SoundLibrary/sonniss-gdc-2026
 *
 * ⚠️ **声源素材不在本仓**。Sonniss GDC 的条款禁止 raw 再分发（只能作为成品游戏
 * 的一部分），所以不能像 library/vcsl/（CC0）那样入库。获取见 library/README.md。
 *
 * 底座是 tools/ffkit.mjs —— 采样率归一 / 中间产物验 NaN / 电平测量驱动都在那儿。
 *
 * ── 核心手法：卷积解耦「谁在叫」和「它是什么做的」──
 *
 * 声源给包络和音高（生物怎么叫），IR 给共振和质感（它是什么材质）。这样 20 条
 * 生物声源 × 7 种材质 IR × 变调 就能覆盖 34 个敌人，不必给每个敌人找专属录音。
 *
 * **卷积还是叠加，取决于材质在单位身上的位置**（小天听审两次的结果，不是一刀切）：
 *   材质是**身体** → 卷积。整个声音要从那个材质里发出来（奔彘=木头做的野猪）
 *   材质是**表面** → 叠加。材质在旁边响（铁翎=铁羽，羽毛是表面；铜额卒=金属额头）
 *
 * ── 三个坑 ──
 *
 * 1. `afir` 的 IR 有 **24000 系数硬上限**。0.5s @48kHz = 24000 正好卡死，报
 *    "Too big number of coefficients"。所有当 IR 用的素材先截到 0.3s 以内。
 *
 * 2. 卷积会大幅摊薄能量（实测掉 13-14dB），而且不同 IR 掉的量不同。**必须逐条
 *    补增益对齐**，不能套用同一个值 —— 这跟力度轴那条（同族同增益）不冲突：
 *    这里十一条是十一个不同原型，不是一个族。迁到 ffkit 之后这件事由 `ship()`
 *    接手（测量驱动），不再手填 volume。
 *
 * 3. **IR 那条不能过 `br()`**。`br()` 会把支路归一到统一有效 RMS，而 IR 的电平
 *    决定 `afir` 里 wet 支路的增益 —— 归一等于改 dry/wet 比，直接改音色。
 *    所以 IR 走 `irOf()` 只截长度不动电平。（声源那边归一无所谓：dry 和 wet
 *    一起缩放，比例不变。）
 *
 * ── 响度目标为什么是十一个数 ─────────────────────────────
 * 老配方的口径是「有效 RMS 全部压到 -22」（前摇预警档：比命中链轻，但要压过
 * 挥击音听得见）。十一个原型的频谱差得远 —— 同一个 RMS 对应的 LUFS 从 -18.1
 * 到 -21.7，差 3.6dB。`ship()` 只认 LUFS，所以下面逐条写死，值是照交付版
 * **实测反推**的。要改档位就整批重测，别单改一条。
 *
 * ── 设定约束 ──
 * 敌人是木/金属/石的造物不是血肉，**受击不叫、攻击起手才叫**。叫声的功能是
 * 听觉预警（跟威胁格预告同一个功能，走耳朵），所以必须落在前摇、且各原型间
 * 一耳朵能分辨。**无机类（夔鼓/磊卒/天柱/天任）不配叫声**，让材质本身说话。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit, WAV } from '../ffkit.mjs';

const OUT = process.argv[2];
const SONNISS = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2026';
// 2024 精选（七条按缺口单文件下的，47MB，不是整包）。来源见该目录的 SOURCE.md
const PICKS = process.argv[4] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
if (!OUT) { console.error('用法：node tools/recipes/enemy-cry.mjs <输出目录> [Sonniss根]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('enemy-cry');
const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'atoms');
const A = (f, alias) => K.conv(join(ATOMS, f), alias);

/** 声源：整条先归一到 48k 单声道，再按秒截叫声段 + 首尾淡入淡出 */
function cut(src, alias, ss, dur, fadeOutAt, fadeD = 0.22) {
  const p = join(K.TMP, `c_${alias}.wav`);
  K.ff(['-i', src, '-af', `atrim=${ss}:${(ss + dur).toFixed(3)},asetpts=N/SR/TB,`
    + `afade=t=in:st=0:d=0.02,afade=t=out:st=${fadeOutAt}:d=${fadeD}`, ...WAV, p]);
  if (K.inspect(p).bad) throw new Error(`声源 ${alias} 里有 NaN`);
  return p;
}
/** IR：只截长度，**不动电平**（见坑 3）。0.3s 以内是 afir 的硬上限（坑 1） */
function irOf(atom, alias, dur = 0.28) {
  const p = join(K.TMP, `ir_${alias}.wav`);
  K.ff(['-i', join(ATOMS, atom), '-af', `atrim=0:${dur},asetpts=N/SR/TB`, ...WAV, p]);
  return p;
}
/** 卷积。afir 要两路输入，套不进单输入的 br()，所以自己落盘 + 验 NaN */
function conv(src, ir, alias, { dry = 2, wet = 8, maxir = 0.35 } = {}) {
  const p = join(K.TMP, `x_${alias}.wav`);
  K.ff(['-i', src, '-i', ir, '-filter_complex',
    `[0:a][1:a]afir=dry=${dry}:wet=${wet}:maxir=${maxir},asetpts=N/SR/TB[o]`, '-map', '[o]', ...WAV, p]);
  if (K.inspect(p).bad) throw new Error(`卷积 ${alias} 出了 NaN`);
  return p;
}
/** 这批全部没有压缩器（老版只有 volume + limiter），迁移不给它们加 */
const flat = { comp: 'anull' };

// ── 卷积型：材质是身体 ────────────────────────────────────
const PROTO = [
  // 兽：狼人低吼 ⊛ 小木块。苍狼/罴卒/貔貅/䝙跃 —— 个体靠换 IR 和变调区分
  { name: 'cry-beast', lufs: -19.7, note: '狼人低吼 ⊛ 小木块',
    src: ['Epic Stock Media - Halloween Game - Haunted House and Horror Audio Scare Kit/CREABeast_Creature Werewolf Growl Menacing Monstrous 06_ESM_HALG.wav', 'werewolf', 0.48, 1.10, 0.85],
    ir: ['wood_block__strike__f3__01.wav', 'wood3'] },
  // 虫：虫类颤动攻击 ⊛ 木块中档。蛊雏/坟羊
  { name: 'cry-insect', lufs: -21.7, note: '虫类颤动 ⊛ 木块中档',
    src: ['SoundBits - Vox Bestiae - Source Elements/CREAInsc_Insectoid Creature Tremble Attack Long 1_SNDBTS_VB-SE.wav', 'insect', 0, 0.95, 0.70],
    ir: ['wood_block__strike__f2__01.wav', 'wood2'] },
  // 水：水生咕噜 ⊛ 石板。溺卒/天蓬
  { name: 'cry-water', lufs: -21.0, note: '水生咕噜 ⊛ 石板',
    src: ['SoundBits - Vox Bestiae - Source Elements/CREAAqua_Aquatic Creature Gurgling 2_SNDBTS_VB-SE.wav', 'aqua', 1.20, 1.10, 0.85],
    ir: ['stone_slab__piece_drop__damp_dry__f2__01.wav', 'stone'] },
  // 大型兽：草食恐龙吼 ⊛ 小木块。奔彘（小天点名，冲刺锁线那一拍）
  { name: 'cry-boar', lufs: -21.4, note: '草食恐龙吼 ⊛ 小木块',
    src: ['344 Audio - Dinosaurs Vol. 2/ANMLRept_Large Herbivore Roar 01_344 Audio_Dinosaurs Vol 2.wav', 'roar', 7.4, 1.10, 0.85],
    ir: ['wood_block__strike__f3__01.wav', 'wood3'] },
  // 陵俑：陶俑 —— 跟铜额卒同一条声源，但**陶是身体所以卷积**（铜额卒只有额头是
  // 金属，是表面所以叠加）。这对是判据最干净的正反例。
  // 实测低频砍 16dB、重心上移到 1.2-2.4k：薄、脆、没有金属的厚度。
  { name: 'cry-clay', lufs: -19.0, note: '兽人蓄力 ⊛ 瓷盘（陶是身体）',
    src: ['Epic Stock Media - Humanoid Creatures Vol 4 - Monstrous and Undead Creature Vocalization Sound Sets/CREAHmn_Designed Orc Male Attack Long Heavy Hit Charged Up 03_ESM_HC4.wav', 'orc_clay', 0.30, 1.15, 0.90],
    ir: ['ceramic_plate__tap__f2__01.wav', 'ceramic_f2'] },
];
for (const p of PROTO) {
  const s = cut(join(SONNISS, p.src[0]), p.src[1], p.src[2], p.src[3], p.src[4]);
  K.ship(K.level(conv(s, irOf(...p.ir), p.src[1]), p.src[1], flat), OUT, `${p.name}.ogg`, p.note, p.lufs);
}

// ── 叠加型：材质是表面不是身体 ────────────────────────────
// db 是照交付版逐支路实测换算的（FFKIT_CAL=1），配比跟听审那版一致。
const LAYERED = [
  // 铁翎：迅猛龙尖啸 + 金属刮擦。铁羽是表面，所以金属在旁边响不是卷进去
  { name: 'cry-tieling', lufs: -21.4, note: '迅猛龙尖啸 + 金属刮擦（羽是表面）', layDb: 3.6, layDelay: 40,
    src: ['344 Audio - Dinosaurs Vol. 1/ANMLRept_Raptor Flair_344 Audio_Dinosaurs.wav', 'raptor', 0.05, 1.00, 0.75],
    lay: 'metal_screech__scrape__01.wav', layTrim: [0.3, 1.0], layFade: 0.45 },
  // 人形：兽人蓄力攻击 + 金属板。铜额卒/砮魂（陵俑走 cry-clay，陶要卷积不能叠加）
  { name: 'cry-humanoid', lufs: -21.7, note: '兽人蓄力 + 金属板（额是表面）', layDb: -13.4, layDelay: 30,
    src: ['Epic Stock Media - Humanoid Creatures Vol 4 - Monstrous and Undead Creature Vocalization Sound Sets/CREAHmn_Designed Orc Male Attack Long Heavy Hit Charged Up 03_ESM_HC4.wav', 'orc', 0.30, 1.15, 0.90],
    lay: 'metal_board2__piece_drop__r_center__01.wav', layTrim: null, layFade: null },
];
for (const p of LAYERED) {
  const s = cut(join(SONNISS, p.src[0]), p.src[1], p.src[2], p.src[3], p.src[4]);
  const layChain = [
    p.layTrim ? `atrim=${p.layTrim[0]}:${p.layTrim[1]},asetpts=N/SR/TB` : null,
    p.layFade ? `afade=t=out:st=${p.layFade}:d=0.25` : null,
    `adelay=${p.layDelay}`,
  ].filter(Boolean).join(',');
  K.ship(K.level(K.mix([
    K.br(s, 'anull', `${p.src[1]}_v`, { db: 0 }),
    K.br(A(p.lay, `${p.src[1]}_l`), layChain, `${p.src[1]}_m`, { db: p.layDb }),
  ], '', p.src[1]), p.src[1], flat), OUT, `${p.name}.ogg`, p.note, p.lufs);
}

// ── 禽类：真猛禽录音（Red Kite 红鸢）──────────────────────
// Raptor Flair 是爬行类的替代品，红鸢是真猛禽，对得多。峰在原素材 93% 处（最后才叫）。
// 天禽是 boss：同一条录音降 4 个半音就变成更大的鸟 —— 跟锣换力度档同一个道理，
// 不要靠加增益制造"更大只"。
{
  const kite = cut(join(PICKS, 'redkite.wav'), 'kite', 18.55, 1.0, 0.72, 0.25);
  K.ship(K.level(conv(kite, irOf('ceramic_plate__tap__f2__01.wav', 'ceramic'), 'bird',
    { dry: 3, wet: 7, maxir: 0.3 }), 'bird', flat),
    OUT, 'cry-bird.ogg', '毕方 · 猛禽 ⊛ 瓷盘', -18.1);
  // 降 4 个半音**不补 atempo**：变慢也是"更大只"的一部分（1.0s → 1.26s）
  const lowered = join(K.TMP, 'c_kite_low.wav');
  K.ff(['-i', kite, '-af', `asetrate=${(48000 * Math.pow(2, -4 / 12)).toFixed(2)},aresample=48000`, ...WAV, lowered]);
  K.ship(K.level(conv(lowered, irOf('wood_block__strike__f3__01.wav', 'wood3b'), 'bird_boss',
    { dry: 3, wet: 7, maxir: 0.3 }), 'bird_boss', flat),
    OUT, 'cry-bird-boss.ogg', '天禽·禽王 · 降 4 半音 ⊛ 木块', -18.7);
}

// ── 鬼类前摇短版 ─────────────────────────────────────────
// cry-ghost 那条 3.17s 只能当出场音，这条 1.26s、峰在 280ms，有明确起手点能当预警。
// 声源换成 Haunted Metal 的金属哀号（比死亡哨更"结构性"，适合造物而非亡魂）。
{
  const wail = cut(join(PICKS, 'hm2_wail.wav'), 'wail', 12.9, 1.0, 0.70, 0.25);
  K.ship(K.level(K.br(wail, 'aecho=0.85:0.8:120|260:0.35|0.2,highshelf=g=3:f=3500', 'g_short', { db: 0 }),
    'ghost_short', flat), OUT, 'cry-ghost-short.ogg', '鬼类前摇 · 金属哀号', -20.7);
}

// 鬼：阿兹特克死亡哨 + 倒放前导 + 长混响。魍魉/磷火/虚子
// 小天听审：不卷积（卷了就闷）、要长混响给空间、要倒放前导给"从远处飘来"。
// ⚠️ 3.17s 且峰在 1180ms，**适合出场音或持续状态，不适合攻击前摇预警** ——
// 前摇要让玩家知道"现在"，这条起手没有明确时间点。要前摇得另切短版。
{
  const whistle = cut(join(SONNISS, 'InMotionAudio - The Death Whistle/CREAEthr_Aztec Death Whistle Distortion_02_IMA_Death Whistle Samples.wav'),
    'whistle', 0.48, 0.95, 0.70);
  const LONG = 'aecho=0.8:0.85:300|650|1100|1700:0.5|0.38|0.28|0.20';
  K.ship(K.level(K.mix([
    K.br(whistle, 'areverse,atrim=0:0.55,asetpts=N/SR/TB,afade=t=in:st=0:d=0.5', 'gh_pre', { db: -9.9 }),
    K.br(whistle, 'adelay=520', 'gh_main', { db: 0 }),
  ], `${LONG},highshelf=g=4:f=3500`, 'ghost'), 'ghost', flat),
    OUT, 'cry-ghost.ogg', '长混响 + 倒放前导', -19.0);
}

console.log('\n十一个原型写到 ' + OUT + '，有效 RMS 全部 ≈ -22（前摇预警档）');
console.log('铺到具体敌人：同原型内换 IR 材质 + 变调区分个体（罴卒用 chessboard 更闷更大只）');
