#!/usr/bin/env node
/**
 * 配方：棋门遁甲点兵线七件
 *
 *   node tools/recipes/dianbing.mjs <输出目录> [2024精选] [沙精选]
 *
 * 需求源 = mem 10228（DIANBING-0819-REPORT §六）。底座是 tools/ffkit.mjs ——
 * 采样率归一 / 支路落盘验 NaN / 电平测量驱动都在那儿，别在这里手写 filter_complex。
 *
 * ⚠️ 沙类素材全是 96kHz（十条无一例外），**必须走 `conv()`**。
 *    见 docs/composition.md 十二 —— 劫线就栽在这上面。
 *
 * ── 时间轴跟着特效走，不是拍脑袋 ────────────────────────────
 * 音效不该自己定时长。两个特效的定档值是唯一源：
 *
 *   shabing-coalesce-tuning.json   launch 300 → flight 430 → settle 210 = 940ms
 *   zuyin-pillar-tuning.json       duration 620，rise 150，亮度峰在 46% = 285ms
 *
 * 起兵因此是 **0-300 涌 / 300-730 飞 / 730 压实**，光柱是 **swell 到 285ms
 * 再落**。光柱这条尤其容易做错：石板落子是 t=0 就到顶的衰减包络，可光柱是
 * **渐亮**的 —— 直接拿落子声当光柱，声音在视觉最暗的时候最响。
 *
 * ── 沙在飞行段几乎不发声 ────────────────────────────────────
 * 颗粒噪声来自**接触**。沙离开地面到落定之间是空中飞行，物理上该近乎无声。
 * 所以起兵的中段（300-730ms）是刻意做薄的高频残响，不是把沙响一路铺满 ——
 * 铺满会读成「一直在倒沙」而不是「涌起来又落下去」。
 *
 * ── 整排感 = 小于 40ms 的错开 ───────────────────────────────
 * 令行推进要「多足齐踏一步」。同一个脚步声复制几份错开：
 *   0ms      → 一个人（叠出来只是变响）
 *   8-34ms   → 一排人齐步（听成一个厚事件）
 *   >60ms    → 数得出几个人，散了
 * 再各自微调音高，避免复制感。这跟连击的顿帧衰减是同一类判断：
 * **多少时间差之内大脑把它们并成一个事件。**
 *
 * ── 层间配比走 `db`，不写 volume ────────────────────────────
 * `br()` 把每条支路先归一到统一参考 RMS，`db` 才是真的「比主层轻几 dB」。
 * 直接在 filter 里写 volume 等于在拿各素材的原始电平赌博 —— 沙层的有效 RMS
 * 比脚步低 36dB，写 -9 跟写 -30 听起来没区别。
 *
 * ── 响度分档（composition.md 十）────────────────────────────
 * 光柱和卡回堆是**衬底和提示**不是事件，target 压到 -19 / -18。尤其光柱跟
 * 起兵同时响，它比沙响低 5dB 才叫「衬」。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
const P = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
const SD = process.argv[4] ?? 'E:/SoundLibrary/sonniss-gdc-sand-picks';
if (!OUT) { console.error('用法：node tools/recipes/dianbing.mjs <输出目录> [2024精选] [沙精选]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('dianbing');
const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'atoms');
const A = (f, alias) => K.conv(join(ATOMS, `${f}.wav`), alias);
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
/** 变调且不变速 */
const pitch = (n) => `asetrate=${semi(n)},aresample=48000,atempo=${Math.pow(2, -n / 12).toFixed(5)}`;

// ── 声源（全部先归一到 48k 单声道）─────────────────────────────
const sandFall = K.conv(join(SD, 'sand_fall.wav'), 'sand_fall');
const sandTrickle = K.conv(join(SD, 'sand_trickle.wav'), 'sand_trickle');
const sugar = K.conv(join(SD, 'sugar_pour.wav'), 'sugar');
const barley = K.conv(join(SD, 'barley_open.wav'), 'barley');
const collapse = K.conv(join(SD, 'dirt_collapse.wav'), 'collapse');
const soil = K.conv(join(SD, 'soil_debris.wav'), 'soil');
const step1 = K.conv(join(SD, 'dirt_step1.wav'), 'step1');
const step2 = K.conv(join(SD, 'dirt_step2.wav'), 'step2');
const axeFlesh = K.conv(join(P, 'axe_flesh.wav'), 'axe_flesh');
const shield = K.conv(join(P, 'shield_block.wav'), 'shield');
const stone = A('stone_slab__piece_drop__damp_dry__f2__01', 'stone');
const stoneRing = A('stone_slab__piece_drop__damp_dry__f3__01', 'stone_ring');
const seal = A('seal__press__f1__01', 'seal');
const sealSoft = A('seal__press__f2__01', 'seal_soft');
const sharp = A('breath_whoosh__mouth__w_sharp__01', 'sharp');
const rod = A('long_rod__twang__len_mid__f_2__01', 'rod');
const cork = A('cork__stab__f3__01', 'cork');
const card = A('playing_card__draw__v1__03', 'card');
const leather = A('leather__hand_rub__tex_rough__f4__01', 'leather');

// ═══ 4 点兵起兵 ════════════════════════════════════════════════
// 0-300 涌（密集接触噪）→ 300-730 飞（薄高频）→ 730 压实。
// sand_fall 的 0-0.4s 是最密的一段，倒放给「越涌越猛」的上升包络。
K.ship(K.level(K.mix([
  // 上升包络要**显式**给：光靠 areverse 拿到的斜率不够
  K.br(sandFall, `atrim=0.02:0.42,asetpts=N/SR/TB,areverse,afade=t=in:st=0:d=0.28:curve=exp`,
    'r_surge', { db: 0, dense: true }),
  // 涌起的粗颗粒层：珍珠麦补中频体，纯细沙撑不起「一整个人」的体量
  K.br(barley, `atrim=0.9:1.32,asetpts=N/SR/TB,areverse,${pitch(-3)},lowpass=f=3000,`
    + `afade=t=in:st=0:d=0.14`, 'r_body', { db: -6 }),
  // 飞行段：只留细高频残响。沙在空中不接触任何东西（见文件头），但也不能
  // 挖成真空 —— 挖空会读成「沙响停了，然后咚」，中间那一下断得太干净
  K.br(sugar, `atrim=0.05:0.48,asetpts=N/SR/TB,highpass=f=3000,`
    + `afade=t=in:st=0:d=0.08,afade=t=out:st=0.28:d=0.15,adelay=300`, 'r_air', { db: -13 }),
  // 730ms 压实：土砾低频给「实」，石板给「落在印面上」
  K.br(soil, `atrim=0:0.22,asetpts=N/SR/TB,lowpass=f=220,afade=t=out:st=0.10:d=0.12,adelay=730`,
    'r_pack', { db: -1 }),
  K.br(stone, `atrim=0:0.34,asetpts=N/SR/TB,lowpass=f=900,adelay=735`, 'r_seat', { db: -8 }),
  // 落定后的余沙，收在 940（settle 结束）之后一点
  K.br(sandFall, `atrim=1.35:1.75,asetpts=N/SR/TB,highpass=f=1200,`
    + `afade=t=out:st=0.22:d=0.18,adelay=760`, 'r_dust', { db: -11, dense: true }),
], 'atrim=0:1.05,afade=t=out:st=0.92:d=0.13', 'rally'), 'rally'),
  OUT, 'dianbing-rally.ogg', '起兵（涌 300 / 飞 430 / 压实 730）', -15);

// ═══ 5 印格光柱 ════════════════════════════════════════════════
// **渐亮**不是落子。石板共鸣倒放做 swell，峰对齐亮度峰 285ms，620ms 收。
K.ship(K.level(K.mix([
  // 倒放石板 = 无起点的渐强。低通 400 只留共鸣，不要落子的木质咔
  K.br(stone, `atrim=0.02:0.30,asetpts=N/SR/TB,areverse,lowpass=f=400,${pitch(-5)},`
    + `afade=t=in:st=0:d=0.05`, 'p_swell', { db: 0 }),
  // 285ms 的印身份：seal 一记，很轻，只是「这是印不是别的柱子」
  K.br(seal, `atrim=0:0.26,asetpts=N/SR/TB,lowpass=f=2200,adelay=278`, 'p_seal', { db: -9 }),
  // 285 之后的余韵，落到 620
  K.br(stoneRing, `atrim=0:0.34,asetpts=N/SR/TB,lowpass=f=700,${pitch(-7)},`
    + `afade=t=out:st=0.16:d=0.18,adelay=290`, 'p_tail', { db: -5 }),
], 'atrim=0:0.62,afade=t=out:st=0.50:d=0.12', 'pillar'), 'pillar'),
  OUT, 'dianbing-pillar.ogg', '印格光柱（swell 到 285ms · 衬底档）', -19);

// ═══ 6 扎枪反击 ════════════════════════════════════════════════
// 需求明写「单发干脆不带回响（高频事件）」→ 整条零 aecho、零 reverb。
K.ship(K.level(K.mix([
  K.br(sharp, `areverse,atempo=1.35,highpass=f=600,afade=t=in:st=0:d=0.06`, 's_thrust', { db: -3 }),
  // 杆身：突刺时杆在抖，短促一点点就够，多了变成拨弦
  K.br(rod, `atrim=0:0.16,asetpts=N/SR/TB,highpass=f=900,${pitch(4)},`
    + `afade=t=out:st=0.07:d=0.08,adelay=175`, 's_shaft', { db: -13 }),
  K.br(axeFlesh, `atrim=2.45:2.72,asetpts=N/SR/TB,adelay=200`, 's_flesh', { db: 0 }),
  K.br(cork, `atrim=0:0.22,asetpts=N/SR/TB,adelay=205`, 's_stab', { db: -6 }),
], 'atrim=0:0.48,afade=t=out:st=0.37:d=0.11', 'spear'), 'spear'),
  OUT, 'dianbing-spear.ogg', '扎枪反击（零回响）');

// ═══ 7 令行推进 ════════════════════════════════════════════════
// 整排感 = 6 份脚步错开 8-34ms 并各自微调音高（见文件头）。
// 六份之间只差 0-6dB —— 差太多就不是「齐踏」是「一个人加回声」。
K.ship(K.level(K.mix([
  ...[[step1, 0, 0, 0], [step2, 8, 2, -2], [step1, 15, -2, -3],
      [step2, 22, 3, -4], [step1, 29, -4, -5], [step2, 34, 1, -6]]
    .map(([src, ms, n, db], i) =>
      K.br(src, `atrim=0:0.20,asetpts=N/SR/TB,${pitch(n)},`
        + `afade=t=out:st=0.09:d=0.11,adelay=${ms}`, `v_step${i}`, { db })),
  // 整排的重量：土砾低频。单个脚步再多份也只是「脆」，闷是低频给的
  K.br(soil, `atrim=0:0.18,asetpts=N/SR/TB,lowpass=f=180,afade=t=out:st=0.08:d=0.10,adelay=10`,
    'v_weight', { db: -3 }),
  // 碾压尾：沙在脚下被碾开，180ms 后起，拖到 600
  K.br(sandTrickle, `atrim=17.0:17.60,asetpts=N/SR/TB,highpass=f=700,`
    + `afade=t=in:st=0:d=0.08,afade=t=out:st=0.32:d=0.26,adelay=180`, 'v_grind', { db: -7, dense: true }),
], 'atrim=0:0.80,afade=t=out:st=0.66:d=0.14', 'advance'), 'advance'),
  OUT, 'dianbing-advance.ogg', '令行推进（6 足错开 8-34ms）', -15);

// ═══ 8 令行推挤命中 ════════════════════════════════════════════
// 盾撞 + 被推者踉跄。踉跄用**沙拖步**不是皮革 —— 被推的是沙兵，脚下该是沙。
K.ship(K.level(K.mix([
  K.br(shield, `atrim=2.60:2.92,asetpts=N/SR/TB,afade=t=out:st=0.18:d=0.14`, 'h_shield', { db: 0 }),
  K.br(sandTrickle, `atrim=6.8:7.45,asetpts=N/SR/TB,highpass=f=400,${pitch(-2)},`
    + `afade=t=in:st=0:d=0.05,afade=t=out:st=0.38:d=0.26,adelay=180`, 'h_drag', { db: -6, dense: true }),
  K.br(leather, `atrim=0.6:1.05,asetpts=N/SR/TB,highpass=f=200,`
    + `afade=t=out:st=0.28:d=0.17,adelay=195`, 'h_gear', { db: -14 }),
], 'atrim=0:0.85,afade=t=out:st=0.70:d=0.15', 'shove'), 'shove'),
  OUT, 'dianbing-shove.ogg', '推挤命中（盾撞 + 沙拖步）');

// ═══ 9 沙兵阵亡 ════════════════════════════════════════════════
// 干燥流沙溃散 → 尾音落回一记印面轻响（「死一个也刻一道」）。
// 溃散要**体量**：纯沙粒声只有表面没有身体，dirt_collapse 补那个体积。
K.ship(K.level(K.mix([
  // 不要 exp 收尾 —— 沙躯是**散开**不是被掐掉，衰减要一直有东西
  K.br(sandFall, `atrim=0.02:0.52,asetpts=N/SR/TB,afade=t=out:st=0.22:d=0.28`, 'd_sand', { db: 0, dense: true }),
  K.br(collapse, `atrim=0.25:0.85,asetpts=N/SR/TB,lowpass=f=1400,${pitch(-4)},`
    + `afade=t=out:st=0.26:d=0.22,adelay=30`, 'd_body', { db: -3 }),
  // 散完的余沙：**接着**主沙往后铺到 560，别让中段空掉
  K.br(sandTrickle, `atrim=9.0:9.36,asetpts=N/SR/TB,highpass=f=1500,`
    + `afade=t=in:st=0:d=0.06,afade=t=out:st=0.14:d=0.22,adelay=240`, 'd_scatter', { db: -6, dense: true }),
  // 620ms 那一记印面轻响 —— 全条最后一个可辨事件，前面已衰到位才听得见
  K.br(sealSoft, `atrim=0:0.30,asetpts=N/SR/TB,lowpass=f=2600,adelay=620`, 'd_mark', { db: -2 }),
], 'atrim=0:0.92,afade=t=out:st=0.80:d=0.12', 'fall'), 'fall'),
  OUT, 'dianbing-fall.ogg', '沙兵阵亡（溃散 + 620ms 刻印）', -15);

// ═══ 10 兵死卡回堆 ═════════════════════════════════════════════
// 提示「兵籍未灭」，不是打牌动作 → 比 card-play 更轻更薄。
// 单瞬态没有内部结构可毁，允许 squash。
K.ship(K.level(K.mix([
  K.br(card, `atrim=0:0.40,asetpts=N/SR/TB,highpass=f=350,${pitch(2)},`
    + `afade=t=out:st=0.26:d=0.13`, 'c_flip', { db: 0, dense: true }),
], '', 'card'), 'card', { squash: 2 }),
  OUT, 'dianbing-card-return.ogg', '卡回堆（提示档，不抢戏）', -18);

console.log('\n七条写到 ' + OUT);
