#!/usr/bin/env node
/**
 * 配方：结算五键（score-tick / fill / card / total / unlock）—— 木牌与筹珠版
 *
 *   node tools/recipes/score-wood.mjs <输出目录>
 *
 * 底座 tools/ffkit.mjs。全部源在 atoms/。
 * canon：ui-object-spec §4「结算＝刻（一块刻好的木牌）＋ 挂（这一局的筹与珠留在
 * 原位不清空）」。⚠️ 现役视觉是 0811 金属北极星（`progression-ui.ts` 默认
 * `fxStyle='metal'`），早于 0901 木 canon——声音按 canon 目标做，不跟金属视觉。
 *
 * ── 每个键在结算里对着什么（0906 从 progression-fx.ts 查的）──
 *   score-fill    弈力条填充 820–1040ms，playFadableSfx，填完 fadeOut 200
 *                 → 定数珠按比例点亮：一串珠依次「哒」（缺#4，先用木块 f1 极短当珠）
 *   score-tick    填充途中每过一级（levelCrossing）一记
 *                 → 过级＝珠串上多亮一颗大的：木块 + 木片一下，比珠重
 *   score-card    签名卡逐张拍上来，index 递减音量（代码里 1 − 0.18·i）
 *                 → 木底符拍在木牌上：card-play 同族但重一档（结算件）
 *   score-total   620ms 后印章压下（`.score-total` 的 seal approach/impact）
 *                 → 印盖下去：seal f3 + 案受一记。就算视觉里的印以后拿掉，
 *                   「令牌落案」读出来是同一件事
 *   score-unlock  升级奖励弹层打开
 *                 → 翻开册子（event-open 同族，短一档）+ 木楔一记「解开了」
 *   score-line-1..5 / subtotal / mult  不动（现役是宽带短噪声，形态对）
 *
 * ── 响度（结算件档 −14~−18，见 composition 十）──
 *   fill −22（床）· tick −20（床上的重音）· card −17（代码再按 index 衰减）·
 *   total −16（整段的峰；首版目标 −15 三条都够不到，纯瞬态削满也差 1.4–3.7dB，
 *   抬身体层后 −16 三条收在 0.5dB 内）· unlock −18。现役全在 −14 左右是 Suno
 *   拉的，五个键一样响等于没有层级。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/score-wood.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('score-wood');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (f, alias) => K.conv(join(ROOT, 'atoms', `${f}.wav`), alias);
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
const pitch = (n) => (n ? `asetrate=${semi(n)},aresample=48000,` : '');
const SLOW = 'acompressor=threshold=-24dB:ratio=2.5:attack=20:release=120';

const blk = (f, i) => A(`wood_block__strike__f${f}__0${i}`, `blk${f}${i}`);
const tile = (i) => A(`chopstick__rub__v1__0${i}`, `tile${i}`);
const seal = (f, i) => A(`seal__press__f${f}__0${i}`, `seal${f}${i}`);
const knock = (r, f, i) => A(`chessboard__knock__r_${r}__f${f}__0${i}`, `knock_${r}${f}${i}`);
const slideBoard = (f, i) => A(`chessboard__wood_slide__f${f}__0${i}`, `board${f}${i}`);
const paper = (i) => A(`paper__flatten__0${i}`, `paper${i}`);
const pull = (s, i) => A(`cardboard__pull_out__spd${s}__0${i}`, `pull${s}${i}`);

const name = (key, n) => (n === 0 ? `${key}.ogg` : `${key}-${n + 1}.ogg`);
// 确定性伪随机：同一配方每次渲染一样
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// ═══ score-fill ×2：一串珠依次点亮 ═══════════════════════════════
// 45ms 一颗 ±8ms 抖动，每颗 ±1 半音，1.2s 共 26 颗；底下垫一条木片在木槽里
// 滑（-14），让珠串有「在一条杆上」的连续感。playFadableSfx 会在填完时 fade 掉。
[0, 1].forEach((n) => {
  const beads = [];
  let t = 0;
  for (let k = 0; k < 26; k++) {
    const i = (k % 3) + 1;
    const st = Math.round((rnd() - 0.5) * 2);
    const db = -8 + Math.round((rnd() - 0.5) * 4);
    beads.push(K.br(blk(1, i), `atrim=0:0.045,asetpts=N/SR/TB,${pitch(st)}highpass=f=700,afade=t=out:st=0.02:d=0.025,adelay=${t}`, `fb${n}_${k}`, { db }));
    t += 45 + Math.round((rnd() - 0.5) * 16);
  }
  K.ship(K.level(K.mix([
    ...beads,
    K.br(slideBoard(2, n + 1), 'atrim=0.05:1.25,asetpts=N/SR/TB,lowpass=f=2000,afade=t=in:st=0:d=0.08,afade=t=out:st=0.95:d=0.25', `fbed${n}`, { db: -14, dense: true }),
  ], 'atrim=0:1.25,afade=t=out:st=1.10:d=0.15', `fill${n}`), `fill${n}`, { comp: SLOW }), OUT, name('score-fill', n), 'fill ← 26 颗木珠 + 木槽滑', -22);
});

// ═══ score-tick ×3：过一级——珠串上多亮一颗大的 ═══════════════════
[[2, 1, 3], [2, 2, 5], [2, 3, 4]].forEach(([bf, bi, ti], n) => {
  K.ship(K.level(K.mix([
    K.br(blk(bf, bi), 'atrim=0:0.09,asetpts=N/SR/TB,highpass=f=400,afade=t=out:st=0.05:d=0.04', `tk_w${n}`, { db: 0 }),
    K.br(tile(ti), 'atrim=0:0.08,asetpts=N/SR/TB,highpass=f=900,afade=t=out:st=0.04:d=0.04,adelay=6', `tk_t${n}`, { db: -6, dense: true }),
  ], 'atrim=0:0.12', `tick${n}`), `tick${n}`, { comp: SLOW }), OUT, name('score-tick', n), `tick ← blk f2-${bi} + tile ${ti}`, -20);
});

// ═══ score-card ×3：签名卡拍上木牌——card-play 同族，重一档 ═══════
// 首版第一条用 blk f3-1 + tile 3 差目标 1.3dB（那两个 take 都是纯尖峰）；换 f3-3 + tile 8
[[3, 3, 8, 1], [3, 2, 5, 2], [2, 3, 4, 3]].forEach(([bf, bi, ti, si], n) => {
  K.ship(K.level(K.mix([
    K.br(blk(bf, bi), 'atrim=0:0.16,asetpts=N/SR/TB,afade=t=out:st=0.08:d=0.08', `sc_core${n}`, { db: 0 }),
    // 木片 body -6（card-play 是 -9）：结算件要够到 -17，身体层得比手牌厚
    K.br(tile(ti), 'atrim=0:0.30,asetpts=N/SR/TB,afade=t=out:st=0.18:d=0.12', `sc_tile${n}`, { db: -6, dense: true }),
    // 结算件比手牌重：案面也受一记，尾巴留长一点
    K.br(knock('center', 2, (n % 3) + 1), 'atrim=0:0.22,asetpts=N/SR/TB,lowpass=f=1800,afade=t=out:st=0.12:d=0.10', `sc_desk${n}`, { db: -3 }),
    K.br(slideBoard(2, si), 'atrim=0.15:0.36,asetpts=N/SR/TB,highpass=f=500,afade=t=in:st=0:d=0.03,afade=t=out:st=0.10:d=0.10,adelay=60', `sc_skid${n}`, { db: -12, dense: true }),
  ], 'atrim=0:0.36,afade=t=out:st=0.30:d=0.06', `scard${n}`), `scard${n}`, { comp: SLOW }), OUT, name('score-card', n), `card ← blk f${bf}-${bi} + tile ${ti} + 案`, -17);
});

// ═══ score-total ×3：印盖下去 / 令牌落案——整段的峰 ══════════════
[[3, 1, 1, 3, 1], [3, 2, 2, 3, 2], [3, 3, 1, 3, 3]].forEach(([sf, si, ki, bf, bi], n) => {
  K.ship(K.level(K.mix([
    // 首版三层全是瞬态，crest 太大：削满 8dB 还差 1.4–3.7dB，三条变体散 2.3dB。
    // 按 ship 的提示抬身体层：案那一记拉到 0 且尾巴放长，坐实层 -14 → -8。
    K.br(seal(sf, si), 'atrim=0:0.34,asetpts=N/SR/TB,afade=t=out:st=0.22:d=0.12', `st_seal${n}`, { db: 0 }),
    K.br(knock('center', 2, ki), 'atrim=0:0.30,asetpts=N/SR/TB,lowpass=f=2200,afade=t=out:st=0.18:d=0.12', `st_desk${n}`, { db: 0 }),
    K.br(blk(bf, bi), 'atrim=0:0.14,asetpts=N/SR/TB,afade=t=out:st=0.07:d=0.07', `st_wood${n}`, { db: -6 }),
    // 压住之后木牌在案上坐实：这层是身体，不是点缀
    K.br(slideBoard(1, (n % 3) + 1), 'atrim=0.10:0.36,asetpts=N/SR/TB,lowpass=f=1500,afade=t=in:st=0:d=0.02,afade=t=out:st=0.14:d=0.12,adelay=90', `st_settle${n}`, { db: -8, dense: true }),
  ], 'atrim=0:0.50,afade=t=out:st=0.40:d=0.10', `stotal${n}`), `stotal${n}`, { comp: SLOW }), OUT, name('score-total', n), `total ← seal f3-${si} + 案 + blk f3`, -16);
});

// ═══ score-unlock ×3：翻开册子 + 木楔一记「解开了」 ═══════════════
// event-open 同族（封面→叶→搁稳），短一档；结尾多一记重木当「楔」（缺#11）。
const unlockSpec = [
  { cover: [pull(2, 3), 'atrim=0.04:0.30'], leaf: [paper(2), 'atrim=0:0.28'], wedge: [3, 1] },
  { cover: [pull(3, 2), 'atrim=0.02:0.26'], leaf: [paper(3), 'atrim=0:0.26'], wedge: [3, 2] },
  { cover: [pull(2, 1), 'atrim=0.04:0.30'], leaf: [paper(1), 'atrim=0.28:0.54'], wedge: [3, 3] },
];
unlockSpec.forEach((s, n) => {
  K.ship(K.level(K.mix([
    K.br(s.cover[0], `${s.cover[1]},asetpts=N/SR/TB,highpass=f=250,afade=t=in:st=0:d=0.02,afade=t=out:st=0.18:d=0.08`, `un_cover${n}`, { db: -3, dense: true }),
    K.br(s.leaf[0], `${s.leaf[1]},asetpts=N/SR/TB,highpass=f=300,afade=t=out:st=0.16:d=0.10,adelay=150`, `un_leaf${n}`, { db: 0, dense: true }),
    K.br(blk(...s.wedge), 'atrim=0:0.14,asetpts=N/SR/TB,lowpass=f=2500,afade=t=out:st=0.07:d=0.07,adelay=380', `un_wedge${n}`, { db: -4 }),
    K.br(knock('edge', 2, (n % 3) + 1), 'atrim=0:0.16,asetpts=N/SR/TB,lowpass=f=1500,afade=t=out:st=0.08:d=0.08,adelay=382', `un_desk${n}`, { db: -8 }),
  ], 'atrim=0:0.62,afade=t=out:st=0.52:d=0.10', `unlock${n}`), `unlock${n}`, { comp: SLOW }), OUT, name('score-unlock', n), 'unlock ← 封面 + 叶 + 楔', -18);
});

console.log('\n结算五键写到 ' + OUT);
