#!/usr/bin/env node
/**
 * 配方：木制卡牌五件（draw / play / shuffle / upgrade / remove）
 *
 *   node tools/recipes/card-wood.mjs <输出目录> [木折断精选目录]
 *
 * 底座 tools/ffkit.mjs。前四件全部源在仓内（atoms/ 自录 + library/vcsl CC0），
 * 整仓可复现；**remove 用了 Sonniss 的木折断素材**（不入库，禁 raw 再分发，
 * 见 E:/SoundLibrary/sonniss-gdc-wood-snap-picks/SOURCE.md）—— 库里没有木头
 * 断裂的原子，wood_block 是对敲、blade_wood 是刮，都不是「断」。
 *
 * ── 为什么换 ──────────────────────────────────────────────────
 * 卡牌美术要换成木制，现役 card-draw / play / shuffle / upgrade 是 Suno 批
 * （整 2.00s、实际有声 200-400ms、其余静音填充），纸感。0904 小天录了一条
 * 「木制摩擦」（atoms/wood_tile__slide__v1__01-08）专门给这个用。
 *
 * ── 8 个 take 其实是三种手势，按事件分配 ────────────────────
 *   点   03 05 04 08   -24/-25 起手 + 平 body 180ms      → 放下（play）
 *   滑   01 07         起手软、峰在 60-80ms              → 抽出（draw）
 *   点+滑 06           点一下、200ms 后拖尾上扬          → draw 变体
 * 录的时候没分档，是切完看包络分出来的。技法一样（木面摩擦），差别在
 * **有没有落定那一下** —— 落定是 play 的核心，抽出是没有落定的滑。
 *
 * ── draw 必须短：逐张错峰 78ms ──────────────────────────────
 * ui.ts 抽牌/弃牌是**每张卡一声** card-draw，间隔 `HAND_MOTION.staggerMs = 78`。
 * 一次抽 4 张 = 4 声叠在 234ms 里。所以 draw 的可听 body 压到 ~150ms，
 * 尾巴切干净 —— 长了就糊成一片。这也是它电平要比 play 低的物理原因：
 * 叠 3-4 层之后总响度会上去。
 *
 * ── play 要比 draw 响，现役是反的 ───────────────────────────
 * 现役 card-play -24.2 / card-draw -19.8 —— 主动打出比被动发牌还轻 4dB，
 * 而且 draw 还会叠。这版按事件权重摆：draw -20 / play -19 / shuffle -21 /
 * upgrade -15。draw 保持现役档（接线不跳），play 提上来。**这是改了相对
 * 关系，要小天听审确认。**
 *
 * ── play 的落定不靠木片摩擦，靠木块对敲 ────────────────────
 * wood_tile 的点是「木片碰木面」，薄；卡牌落到棋盘上要有点分量。叠一记
 * wood_block（两块小木料对敲，小天录来模拟棋子碰撞的）在 t=0 当落定的
 * 芯，wood_tile 的 body 跟在后面当木片质感。两个瞬态同帧才能融成一个事件
 * —— 跟钹必须跟木头 hit 对齐是一回事。
 *
 * ── shuffle = 两簇木块错开 8-34ms + 散落的滑 ───────────────
 * 没有「一叠木牌哗啦」的实录，用整排感手法：多份 wood_block 错开 8-34ms
 * 听成一簇（超过 60ms 就数得出几下）。两簇 + 中间散几条 wood_tile 滑 +
 * chessboard wood_slide 铺个木面底 = 700ms 的洗牌过程。
 *
 * ── upgrade：盖印 + 筝，戏剧层可以带音高 ────────────────────
 * 升级是奖励事件，纯木头出不了「变强了」的感觉。用 seal（印章按压 —— 升级
 * 就是盖一枚印）当物理层，叠两声筝 D4 → A4（上行纯五度）当戏剧层。调性照
 * drama-layer.mjs：D 大调五声，跟 BGM 的 D/G 两个调都合。文件名 C#3 实测是 D4。
 *
 * ── remove：木牌被删 = 折断，不是撕 ─────────────────────────
 * 现役 card-remove 是 cardboard__tear（纸板撕），换木牌就不对了。木头的
 * 「毁」是**折断**：拽一下 → 纤维先裂后断（两段式 crack）→ 碎屑噼啪 →
 * 碎块落地。五个变体换五种折断芯，碎屑轮换，落地那记一律很轻 —— 它只是
 * 交代「掉了」，不是第二个事件。-18 LUFS：主动毁牌，比 play 响、比 upgrade 轻
 * （原定 -17，两个薄芯变体物理上够不到，全家族让 1dB 换池内一致）。
 *
 * 折断素材的挑法：**看 attack 不看名字**。名字带 break/crack 的一半是
 * 「压碎」（pepper_crack / fence_destr attack 500-700ms，是过程不是瞬态），
 * 真折断 attack < 70ms。crack_short 尤其好：10ms 一记、100ms 再一记，
 * 正是木纤维先裂后断的形。
 *
 * ── 变体数对齐 manifest ─────────────────────────────────────
 * draw ×6 / play ×6 / shuffle ×2 / upgrade ×1 / remove ×5，跟现役键位一样，
 * 替换不改 manifest 条目数。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
const SN = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-wood-snap-picks';
if (!OUT) { console.error('用法：node tools/recipes/card-wood.mjs <输出目录> [木折断精选]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('card-wood');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (f, alias) => K.conv(join(ROOT, 'atoms', `${f}.wav`), alias);
const L = (f, alias) => K.conv(join(ROOT, 'library', 'vcsl', f), alias);
const W = (f, alias) => K.conv(join(SN, `${f}.wav`), alias);   // Sonniss 木折断精选，96k 混采样率，必须 conv
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
// 有硬瞬态（木块对敲 / 印章）的三族用慢 attack 的总线压缩：attack 20ms 让
// 4ms 的点整个过去再夹，保住瞬态 crest。draw 是滑没有硬瞬态，用默认就行。
//
// ⚠️ 一条差点把这三族改坏的教训：判断「落定那一下是不是最响」**要看峰值包络
// 不是 RMS 包络**。一记 4ms 的点摊进 30ms 窗，RMS 只剩 -25，看起来比 body
// 的 -21 还轻，于是以为重音跑到 body 上了，连改两轮参数都"没效"—— 其实峰值
// 包络上点一直是 -2、body 是 -11，差 9dB，从来没错过。这是 ffkit 里「限幅后
// 看 RMS 别看峰值」那条的镜像：**问的是「有没有被压平」用 RMS，问的是「重音
// 在不在一记点上」用峰值。** 第一次修没效就该先怀疑尺子，不是换个参数再修。
const SLOW = 'acompressor=threshold=-24dB:ratio=2.5:attack=20:release=120';

// ── 源 ────────────────────────────────────────────────────────
const tile = Object.fromEntries([1, 3, 4, 5, 6, 7, 8].map((i) => [i, A(`wood_tile__slide__v1__0${i}`, `tile${i}`)]));
const blk = (f, i) => A(`wood_block__strike__f${f}__0${i}`, `blk${f}${i}`);
const slideBoard = (f, i) => A(`chessboard__wood_slide__f${f}__0${i}`, `board${f}${i}`);
const seal = A('seal__press__f3__01', 'seal');
const zhengD = L('zheng_C#3_f.wav', 'zheng_d');   // 实测 D4
const zhengA = L('zheng_G#3_f.wav', 'zheng_a');   // G#4 +1 → A4

// ═══ card-draw ×6：滑为主，短 ═══════════════════════════════════
// 起手软的滑就是「从牌堆抽出来」。高通 300 让它薄一点 —— 抽牌是轻动作，
// 而且会叠 3-4 层，低频叠起来会闷。
const drawSpec = [
  [7, 'atrim=0:0.24'],                 // 纯滑，峰在 60ms
  [1, 'atrim=0.02:0.28'],              // 滑，稍长
  [6, 'atrim=0.16:0.42,areverse'],     // 06 的拖尾上扬倒过来 = 滑出去收住
  [4, 'atrim=0:0.20'],                 // 点，当「碰到牌」的变体
  [7, `atrim=0:0.24,asetrate=${semi(1)},aresample=48000`],   // 07 升半音，换个木片
  [1, `atrim=0.02:0.26,asetrate=${semi(-1)},aresample=48000`],
];
drawSpec.forEach(([i, f], n) => {
  const file = n === 0 ? 'card-draw.ogg' : `card-draw-${n + 1}.ogg`;
  K.ship(K.level(K.mix([
    K.br(tile[i], `${f},asetpts=N/SR/TB,highpass=f=300,afade=t=out:st=0.14:d=0.08`, `d${n}`, { db: 0, dense: true }),
  ], 'atrim=0:0.24', `draw${n}`), `draw${n}`), OUT, file, `draw ← tile ${String(i).padStart(2, '0')}`, -20);
});

// ═══ card-play ×6：木块落定芯 + 木片 body + 短滑尾 ═══════════════
const playSpec = [[2, 1, 3], [2, 2, 5], [2, 3, 4], [3, 1, 3], [2, 1, 5], [3, 2, 8]];
playSpec.forEach(([bf, bi, ti], n) => {
  const file = n === 0 ? 'card-play.ogg' : `card-play-${n + 1}.ogg`;
  K.ship(K.level(K.mix([
    // 落定的芯：木块对敲，t=0
    K.br(blk(bf, bi), 'atrim=0:0.16,asetpts=N/SR/TB,afade=t=out:st=0.08:d=0.08', `p_core${n}`, { db: 0 }),
    // 木片质感：wood_tile 的点 + body，跟芯同帧起，两个瞬态融成一下。
    // -9：body 只当质感，得让落定的点在峰值包络上高出它 ~8dB 才读得出
    // 「放下」；-4 的时候只高 4dB，点被 body 糊住。
    K.br(tile[ti], 'atrim=0:0.30,asetpts=N/SR/TB,afade=t=out:st=0.18:d=0.12', `p_tile${n}`, { db: -9, dense: true }),
    // 落到棋盘上滑那一小下：60ms 后起，很轻
    K.br(slideBoard(2, (n % 3) + 1), 'atrim=0.15:0.38,asetpts=N/SR/TB,highpass=f=500,'
      + 'afade=t=in:st=0:d=0.03,afade=t=out:st=0.12:d=0.11,adelay=60', `p_skid${n}`, { db: -11, dense: true }),
  ], 'atrim=0:0.34,afade=t=out:st=0.28:d=0.06', `play${n}`), `play${n}`, { comp: SLOW }), OUT, file, `play ← blk f${bf}-${bi} + tile ${String(ti).padStart(2, '0')}`, -19);
});

// ═══ card-shuffle ×2：两簇木块 + 散滑 + 木面底 ═════════════════
const cluster = (t0, picks, tag) => picks.map(([f, i, ms, db], k) =>
  K.br(blk(f, i), `atrim=0:0.12,asetpts=N/SR/TB,afade=t=out:st=0.06:d=0.06,adelay=${t0 + ms}`, `${tag}${k}`, { db }));
const shuffleSpec = [
  { a: [[1, 1, 0, 0], [2, 1, 9, -2], [1, 2, 17, -3], [2, 2, 26, -4], [1, 3, 34, -5], [2, 3, 45, -6]],
    b: [[2, 1, 0, -1], [1, 1, 8, -2], [2, 3, 15, -3], [1, 3, 24, -5], [2, 2, 33, -6]],
    slides: [[7, 120, -8], [1, 230, -9], [7, 430, -8], [6, 520, -10]] },
  { a: [[2, 2, 0, 0], [1, 3, 8, -2], [2, 1, 16, -3], [1, 1, 25, -4], [2, 3, 33, -6]],
    b: [[1, 2, 0, -1], [2, 2, 9, -2], [1, 1, 17, -3], [2, 1, 27, -5], [1, 3, 36, -6], [2, 3, 46, -7]],
    slides: [[1, 110, -8], [7, 240, -9], [6, 400, -9], [1, 540, -10]] },
];
shuffleSpec.forEach((s, n) => {
  const file = n === 0 ? 'card-shuffle.ogg' : `card-shuffle-${n + 1}.ogg`;
  K.ship(K.level(K.mix([
    ...cluster(0, s.a, `sA${n}_`),
    ...cluster(310, s.b, `sB${n}_`),
    ...s.slides.map(([i, ms, db], k) =>
      K.br(tile[i], `atrim=0:0.22,asetpts=N/SR/TB,highpass=f=400,afade=t=out:st=0.12:d=0.10,adelay=${ms}`, `sS${n}_${k}`, { db, dense: true })),
    // 木面底：整个过程牌在木面上蹭
    K.br(slideBoard(3, n + 1), 'atrim=0.05:0.70,asetpts=N/SR/TB,lowpass=f=2500,'
      + 'afade=t=in:st=0:d=0.06,afade=t=out:st=0.45:d=0.20', `sBed${n}`, { db: -12, dense: true }),
  ], 'atrim=0:0.72,afade=t=out:st=0.62:d=0.10', `shuffle${n}`), `shuffle${n}`, { comp: SLOW }), OUT, file, 'shuffle ← 两簇 blk + 散滑', -21);
});

// ═══ card-upgrade ×1：盖印 + 木 + 筝 D4→A4 ══════════════════════
K.ship(K.level(K.mix([
  // 物理层：印章按下去（升级 = 盖印），t=0
  K.br(seal, 'atrim=0:0.40,asetpts=N/SR/TB,afade=t=out:st=0.28:d=0.12', 'u_seal', { db: 0 }),
  // 落定重量：木块同帧
  K.br(blk(3, 1), 'atrim=0:0.16,asetpts=N/SR/TB,afade=t=out:st=0.08:d=0.08', 'u_core', { db: -3 }),
  // 木片质感
  K.br(tile[3], 'atrim=0:0.30,asetpts=N/SR/TB,afade=t=out:st=0.18:d=0.12', 'u_tile', { db: -8, dense: true }),
  // 戏剧层：筝 D4 → A4，上行五度。戏剧层可以带余韵（composition.md 十一）
  K.br(zhengD, 'atrim=0:0.7,asetpts=N/SR/TB,afade=t=out:st=0.45:d=0.25,adelay=40', 'u_zd', { db: -6 }),
  K.br(zhengA, `asetrate=${semi(1)},aresample=48000,atrim=0:0.7,asetpts=N/SR/TB,afade=t=out:st=0.45:d=0.25,adelay=200`, 'u_za', { db: -4 }),
], 'atrim=0:0.95,afade=t=out:st=0.80:d=0.15', 'upgrade'), 'upgrade', { comp: SLOW }), OUT, 'card-upgrade.ogg', 'upgrade ← seal + blk + 筝 D4→A4', -15);

// ═══ card-remove ×5：拽 → 折断 → 碎屑 → 落地 ═══════════════════
const crackShort = W('crack_short', 'crack_short');
const snapIm = W('snap_imotion', 'snap_im');
const celery = W('celery_crunch', 'celery');
const pileSmash = W('pile_smash', 'pile_smash');
const rummage = W('branches_rummage', 'rummage');
const debrisWood = W('debris_wood', 'debris_wood');
const plank = W('plank_drop', 'plank');
// 五种折断芯：[源, atrim 段, 标签]。段落是按事件切分表挑的（attack 全 < 70ms）
// 五个芯的峰值/body 比要接近 —— 随机池里的变体 LUFS 得落在 ±1dB 内，
// 首版 snap_imotion e4 太弱（差目标 5.4dB）撑不起芯，换成 debris_wood。
// 第 4 列 = 这个芯薄不薄。snap_imotion e3 和 celery 是纯瞬态 + 细纤维尾，body
// 太薄，随机池里比别的变体轻 2-3dB。试过给芯上 dense —— **更差**（-19.5→-20.2）：
// 短瞬态没有可抬的尾，压完再按有效 RMS 归一反而把峰压低了。正确的补法是
// **再叠一记第二次裂**（木牌折断本来就不止一声）—— 用 crack_short 的第二段
// 裂（90-220ms 那记）垫在底下，是加身体不是加增益。
const cores = [
  [crackShort, 'atrim=0:0.25', 'crack_short 两段式', false],
  [snapIm, 'atrim=0.57:0.74', 'snap_imotion e3（最亮）', true],
  // celery e1 芯物理上到不了 -18（-21，叠第二次裂也不动：182ms 稀疏纤维噼啪，
  // 峰值天花板由它自己的瞬态定死）。换 crack_short 降 2 个半音当「大一号的牌」
  // —— 池内一致性优先于素材多样性，这是个低频事件。celery 留在 SOURCE.md 里备用。
  [crackShort, `atrim=0:0.25,asetrate=${semi(-2)},aresample=48000`, 'crack_short -2 半音', false],
  [debrisWood, 'atrim=0.02:0.26', 'debris_wood（撞+碎）', false],
  [pileSmash, 'atrim=0:0.28', 'pile_smash（重一档）', false],
];
// 碎屑轮换：干枝噼啪 e2-e4
const debris = [
  [rummage, 'atrim=1.76:1.88'], [rummage, 'atrim=1.97:2.12'], [rummage, 'atrim=2.23:2.37'],
  [rummage, 'atrim=1.76:1.88'], [rummage, 'atrim=1.97:2.12'],
];
cores.forEach(([src, seg, label, denseCore], n) => {
  const file = n === 0 ? 'card-remove.ogg' : `card-remove-${n + 1}.ogg`;
  const [dsrc, dseg] = debris[n];
  K.ship(K.level(K.mix([
    // 拽：从牌堆/手里扯出来那一下，很短，只是交代「有人对它动手了」
    K.br(tile[7], 'atrim=0:0.12,asetpts=N/SR/TB,highpass=f=400,afade=t=out:st=0.06:d=0.06', `x_pull${n}`, { db: -8, dense: true }),
    // 折断芯：60ms 起
    K.br(src, `${seg},asetpts=N/SR/TB,afade=t=out:st=0.14:d=0.10,adelay=60`, `x_core${n}`, { db: 0 }),
    // 薄芯补第二次裂：crack_short 90-220ms 那记，晚 40ms 垫在主裂后面
    ...(denseCore ? [K.br(crackShort, 'atrim=0.09:0.22,asetpts=N/SR/TB,afade=t=out:st=0.08:d=0.05,adelay=100', `x_core2_${n}`, { db: -5 })] : []),
    // 碎屑噼啪：跟在断后 60ms，尾巴拖到 ~340 盖住落地前那段
    K.br(dsrc, `${dseg},asetpts=N/SR/TB,highpass=f=800,afade=t=out:st=0.10:d=0.12,adelay=120`, `x_deb${n}`, { db: denseCore ? -3 : -6, dense: true }),
    // 碎块落地：交代「掉了」，**不是第二个事件**。首版 -13 出来跟折断只差 3dB、
    // 300ms 处独占成一记「咚」，前面还空 30ms —— 压到 -20、掐掉 <150 的肥
    // 低频、提前到 235 让它藏进碎屑尾里。
    K.br(plank, 'atrim=0:0.18,asetpts=N/SR/TB,highpass=f=150,lowpass=f=900,afade=t=out:st=0.06:d=0.12,adelay=235', `x_land${n}`, { db: -20 }),
  ], 'atrim=0:0.50,afade=t=out:st=0.42:d=0.08', `remove${n}`), `remove${n}`, { comp: SLOW }),
    OUT, file, `remove ← ${label}`, -18);
});

console.log('\n二十条写到 ' + OUT + '（draw×6 / play×6 / shuffle×2 / upgrade×1 / remove×5）');
