#!/usr/bin/env node
/**
 * 配方：局外纸类过场件 —— event-open（先做这一件，reward-claim / scroll-open 后续并入）
 *
 *   node tools/recipes/paper-run.mjs <输出目录>
 *
 * 底座 tools/ffkit.mjs。全部源在 atoms/。
 * canon：qimen-dunjia/docs/design/sound-design-paper-wood-0906.md §2「写」列。
 *
 * ── event-open：为什么是「翻开一本册子」不是「展一张纸」──────────
 * 0906 查 styles.css：奇遇界面是一本**书**（`.event-book-overlay`：封面 → 左叶
 * 翻开 → 右叶，`--event-book-open-ms` 520–560ms）。所以声音跟着动画走：
 *   0ms    封面掀起（厚一点的纸板纤维）
 *   170ms  左叶落下（纸铺平）
 *   360ms  右叶落下（纸铺平，轻一档）
 *   520ms  册子搁稳（案受一记木 + 软的一拍）
 * 跟 ui-open（翻开册子，0.4s 一叶）是同一种物件的大号版：两叶、更长、响 4dB。
 * 玩家听到的应该是「同一本册子，这次是奇遇那本」。
 *
 * 现役 event-open 是 0730 Suno：1.8–2.7s、ring 2300 @516Hz、tonal 0.97、
 * room −17 —— 一口钟，还带厅堂。整个非战斗库最「青铜」的一条。
 *
 * ── 响度 ───────────────────────────────────────────────────
 * 过场件档 −19（现役 −16.3，那是钟拉响的；ui-open −23，这本要比它有分量）。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/paper-run.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('paper-run');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (f, alias) => K.conv(join(ROOT, 'atoms', `${f}.wav`), alias);
const SLOW = 'acompressor=threshold=-24dB:ratio=2.5:attack=20:release=120';

const blk = (f, i) => A(`wood_block__strike__f${f}__0${i}`, `blk${f}${i}`);
const seal = (f, i) => A(`seal__press__f${f}__0${i}`, `seal${f}${i}`);
const paper = (i) => A(`paper__flatten__0${i}`, `paper${i}`);
const scroll = (i) => A(`scroll__unroll__0${i}`, `scroll${i}`);
const pull = (s, i) => A(`cardboard__pull_out__spd${s}__0${i}`, `pull${s}${i}`);

const name = (key, n) => (n === 0 ? `${key}.ogg` : `${key}-${n + 1}.ogg`);

// ═══ event-open ×3：封面 → 左叶 → 右叶 → 搁稳 ═══════════════════
// 三个变体换的是纸的 take，不换结构；封面用纸板纤维（厚），两叶用纸铺平（薄）。
// 右叶 -4：第二叶总是比第一叶轻，翻书就是这样。
const spec = [
  { cover: [pull(2, 1), 'atrim=0.04:0.34'],  left: [paper(1), 'atrim=0.28:0.58'], right: [paper(2), 'atrim=0:0.26'],  land: [1, 1, 1, 1] },
  { cover: [pull(2, 2), 'atrim=0.02:0.32'],  left: [paper(2), 'atrim=0:0.30'],    right: [paper(3), 'atrim=0:0.26'],  land: [1, 2, 2, 2] },
  { cover: [scroll(1), 'atrim=0.12:0.44'],   left: [paper(3), 'atrim=0:0.30'],    right: [paper(1), 'atrim=0.30:0.56'], land: [1, 3, 1, 1] },
];
spec.forEach((s, n) => {
  const [bf, bi, sf, si] = s.land;
  K.ship(K.level(K.mix([
    // 0ms 封面掀起：厚纸板纤维，高通 250 去掉桌面的闷
    K.br(s.cover[0], `${s.cover[1]},asetpts=N/SR/TB,highpass=f=250,afade=t=in:st=0:d=0.02,afade=t=out:st=0.20:d=0.10`, `ev_cover${n}`, { db: -3, dense: true }),
    // 170ms 左叶落下
    K.br(s.left[0], `${s.left[1]},asetpts=N/SR/TB,highpass=f=300,afade=t=out:st=0.18:d=0.12,adelay=170`, `ev_left${n}`, { db: 0, dense: true }),
    // 360ms 右叶落下，轻一档
    K.br(s.right[0], `${s.right[1]},asetpts=N/SR/TB,highpass=f=350,afade=t=out:st=0.14:d=0.12,adelay=360`, `ev_right${n}`, { db: -4, dense: true }),
    // 520ms 搁稳：案受一记木（低通只留身体）+ 软的一拍（书脊压下去）
    K.br(blk(bf, bi), 'atrim=0:0.12,asetpts=N/SR/TB,lowpass=f=2200,afade=t=out:st=0.06:d=0.06,adelay=520', `ev_wood${n}`, { db: -9 }),
    K.br(seal(sf, si), 'atrim=0:0.16,asetpts=N/SR/TB,lowpass=f=2500,afade=t=out:st=0.09:d=0.07,adelay=515', `ev_pat${n}`, { db: -6 }),
  ], 'atrim=0:0.80,afade=t=out:st=0.70:d=0.10', `event${n}`), `event${n}`, { comp: SLOW }), OUT, name('event-open', n), `event-open ← 封面 ${n === 2 ? 'scroll' : 'pull'} + 两叶 paper + 搁稳`, -19);
});

// ═══ reward-claim ×2：拿起一张符 = 木底一记 + 纸抽 + 木片滑 ═══════
// 奖励屏「三张符摊在案上，选中=拿起来」（ui-object-spec §4）。现役是 Suno「silk
// card」，−30.7 LUFS 比同档轻 8–12dB，几乎听不见。符是薄木裱纸（§3.2 #11）：
// 拿起时木底离案一记，纸面和木边一起蹭过。0.35s，−19。
const card = (i) => A(`playing_card__draw__v1__${String(i).padStart(2, '0')}`, `card${i}`);
const tile = (i) => A(`chopstick__rub__v1__0${i}`, `tile${i}`);
[[1, 4, 7], [2, 6, 1]].forEach(([bi, ci, ti], n) => {
  K.ship(K.level(K.mix([
    K.br(blk(1, bi), 'atrim=0:0.08,asetpts=N/SR/TB,lowpass=f=2500,afade=t=out:st=0.04:d=0.04', `rc_lift${n}`, { db: -4 }),
    K.br(card(ci), 'atrim=0:0.21,asetpts=N/SR/TB,highpass=f=500,afade=t=out:st=0.13:d=0.08,adelay=20', `rc_paper${n}`, { db: 0, dense: true }),
    K.br(tile(ti), 'atrim=0:0.26,asetpts=N/SR/TB,highpass=f=300,afade=t=out:st=0.16:d=0.10,adelay=15', `rc_wood${n}`, { db: -5, dense: true }),
  ], 'atrim=0:0.36,afade=t=out:st=0.30:d=0.06', `reward${n}`), `reward${n}`, { comp: SLOW }), OUT, name('reward-claim', n), `reward-claim ← blk f1-${bi} + card ${ci} + tile ${ti}`, -19);
});

// ═══ scroll-open ×2：摊开那卷图 = 展纸 + 铺平 + 镇纸压角 ═════════
// 地图＝案上摊开的旧皮纸图（§3 #1 / §3.2 #22：一角木楔钉进案面，对角石镇纸压住）。
// 现役 Suno 版零消费者——接线到 modeEntered map。scroll__unroll 01 是小天点名
// 较好的那段。展完 → 铺平 → 河卵石压角一记（stone_slab f1 低通，石落纸不是石落木）。
// 听审（小天 0906）：scroll 03 那条胜过 01——03 是一段匀速的长展开（2.17s，−41
// 平台），01 有两个峰听着像展了两次。两条变体都从 03 取：前段 0.30–1.35 / 后段
// 0.95–2.00（1.55–1.75 有一处「铺到头」的小起伏，正好落在铺平层前面）。
const stone = (i) => A(`stone_slab__piece_drop__damp_dry__f1__0${i}`, `stone${i}`);
[[3, 'atrim=0.30:1.35', 3, 3], [3, 'atrim=0.95:2.00', 1, 1]].forEach(([si, tr, pi, st], n) => {
  K.ship(K.level(K.mix([
    K.br(scroll(si), `${tr},asetpts=N/SR/TB,highpass=f=200,afade=t=in:st=0:d=0.03,afade=t=out:st=0.80:d=0.25`, `so_roll${n}`, { db: 0, dense: true }),
    K.br(paper(pi), 'atrim=0:0.40,asetpts=N/SR/TB,highpass=f=300,afade=t=out:st=0.25:d=0.15,adelay=780', `so_flat${n}`, { db: -4, dense: true }),
    K.br(stone(st), 'atrim=0.01:0.16,asetpts=N/SR/TB,lowpass=f=1800,afade=t=out:st=0.08:d=0.08,adelay=1010', `so_stone${n}`, { db: -9 }),
  ], 'atrim=0:1.25,afade=t=out:st=1.12:d=0.13', `scroll${n}`), `scroll${n}`, { comp: SLOW }), OUT, name('scroll-open', n), `scroll-open ← scroll 0${si} + paper 0${pi} + 镇纸`, -20);
});

console.log('\nevent-open ×3 + reward-claim ×2 + scroll-open ×2 写到 ' + OUT);
