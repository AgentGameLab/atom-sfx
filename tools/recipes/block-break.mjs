#!/usr/bin/env node
/**
 * 配方：block-break ×3 —— 格挡被打碎，真碎玻璃重做
 *
 *   node tools/recipes/block-break.mjs <输出目录> [玻璃精选目录] [2026根目录]
 *
 * 底座 tools/ffkit.mjs。自录 glass_slab 在仓内；碎玻璃素材是 Sonniss（不入库，
 * 禁 raw 再分发，见 E:/SoundLibrary/sonniss-gdc-glass-picks/SOURCE.md）。
 *
 * ── 为什么重做 ──────────────────────────────────────────────
 * 现役三条是 08-15 用「勺敲玻璃杯」堆的，composition.md 五当时就写明了局限：
 * 有明确基频的音堆多少都像一堆铃铛，真碎片是宽带噪声脉冲，根本解是真素材。
 * 而且按「初裂 42 / 分离 104 / 飞行 348 / 落地 615ms」留的物理间隔，没素材填，
 * 出来是中间 100ms 的死洞（-60）——听感「碎一下…空…再落一下」。
 *
 * ── 结构：同一条物理序列，这次层层叠着走 ────────────────────
 *   t=0     打碎它的那一击   glass_slab__knuckle__f3（自录，<300Hz 身体）
 *           + 初裂           window_crack 前 120ms（attack 1ms，是「裂」不是「碎」）
 *   0-550   碎散芯           pane_fienup / bz_break_002 / dt_shatter_small e1，三变体换芯
 *   120→    大碎块翻滚       shards_large（自带 0/300/550ms 三簇，翻滚的间隔是素材里的）
 *   180→    碎片飞行         crystal_fragments 倒放（原是 2.6s 上升噪，倒过来 = 飞散衰减）
 *   380→    落地/弹跳        dt_drop_shards e1 / bz_break_debris / pint_debris，三变体换
 *   0.85s 收
 * 每层的起点比上一层晚、终点也比上一层晚，任何时刻至少两层在响——洞就没了。
 *
 * ── 打碎它的那一击必须是自录的低频 ──────────────────────────
 * 碎玻璃素材几乎都是 1.2-10k 主导（pane -19.7 / mw -31.2 在 <300 段），单用会
 * 「只有碎没有撞」。格挡被打碎首先是**被打**，knuckle 那记 <300Hz 的闷给的是
 * 「有东西撞上来了」，碎是它的后果。两个瞬态同帧融成一个事件。
 *
 * ── 电平 ────────────────────────────────────────────────────
 * -16 LUFS，对齐现役（-15.4 ~ -16.1）；audio-loudness 门禁对 block-break 有
 * mean-dB 目标 -21..-15，现役 -18.7 过，这版形状相近应该也在区间里，提交前验。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
const GL = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-glass-picks';
const S26 = process.argv[4] ?? 'E:/SoundLibrary/sonniss-gdc-2026';
if (!OUT) { console.error('用法：node tools/recipes/block-break.mjs <输出目录> [玻璃精选] [2026根]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('block-break');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (f, alias) => K.conv(join(ROOT, 'atoms', `${f}.wav`), alias);
const G = (f, alias) => K.conv(join(GL, `${f}.wav`), alias);   // 96k/192k 混，必须 conv
const SLOW = 'acompressor=threshold=-24dB:ratio=2.5:attack=20:release=120';

const knuckle = A('glass_slab__knuckle__f3__01', 'knuckle');
const crack = G('window_crack', 'crack');
const pane = G('pane_fienup', 'pane');
const bz002 = G('bz_break_002', 'bz002');
const vase = G('vase_fienup', 'vase');
const shards = G('shards_large', 'shards');
const dtDrop = G('dt_drop_shards', 'dt_drop');
const bzDebris = G('bz_break_debris', 'bz_debris');
const pint = G('pint_debris', 'pint');
const frag = K.conv(join(S26, 'Epic Stock Media - Elemental Mutation Whooshes and Impacts/GLASMvmt_Whoosh Glass Crystal Fragments Sharp Shards Dry 05_ESM_EMWI.wav'), 'frag');

// 三变体：[碎散芯, 芯段, 落地源, 落地段, 标签, 加密芯段(可空)]
// v3 芯原是 dt_shatter_small e1（干录小碎），比 pane / bz002 薄 1.9dB，叠同文件 e3
// 也只抬 0.3dB —— 稀疏干录的碎，峰值天花板由自身瞬态定死，加身体抬不动，
// 跟 card-remove 芹菜那次一个结论：**这种芯只能换**。换 vase_fienup（花瓶碎，
// -6~-13 密集 500ms，跟 pane 同量级；空腔共鸣算作变体的音色差）。
// 格挡碎是战斗高频事件，池内响度一致比素材多样性重要。dt_shatter 留 SOURCE.md 备用。
const variants = [
  [pane, 'atrim=0:0.55', dtDrop, 'atrim=0.49:0.98', 'pane + dt_drop e1', null],
  [bz002, 'atrim=0:0.55', bzDebris, 'atrim=0.35:0.85', 'bz_break_002 + bz_debris', null],
  [vase, 'atrim=0:0.55', pint, 'atrim=0.05:0.55', 'vase + pint_debris', null],
];
variants.forEach(([core, cseg, land, lseg, label, cseg2], n) => {
  const file = n === 0 ? 'block-break.ogg' : `block-break-${n + 1}.ogg`;
  K.ship(K.level(K.mix([
    // t=0 打碎它的那一击：自录 knuckle，身体
    K.br(knuckle, 'atrim=0:0.25,asetpts=N/SR/TB,afade=t=out:st=0.12:d=0.13', `k${n}`, { db: -3 }),
    // t=0 初裂：120ms 的裂，跟 knuckle 同帧融成一下
    K.br(crack, 'atrim=0:0.12,asetpts=N/SR/TB,afade=t=out:st=0.06:d=0.06', `c${n}`, { db: -2 }),
    // 碎散芯（主层）
    K.br(core, `${cseg},asetpts=N/SR/TB,afade=t=out:st=0.38:d=0.17`, `core${n}`, { db: 0 }),
    ...(cseg2 ? [K.br(core, `${cseg2},asetpts=N/SR/TB,afade=t=out:st=0.30:d=0.12,adelay=30`, `core2_${n}`, { db: -4 })] : []),
    // 120ms 大碎块翻滚：素材自带三簇，不用我错开
    K.br(shards, 'atrim=0:0.50,asetpts=N/SR/TB,highpass=f=600,afade=t=out:st=0.34:d=0.16,adelay=120', `sh${n}`, { db: -6, dense: true }),
    // 180ms 碎片飞行：上升噪倒放 = 飞散衰减，只留高频闪
    K.br(frag, 'atrim=0.6:1.3,asetpts=N/SR/TB,areverse,highpass=f=3000,afade=t=in:st=0:d=0.03,afade=t=out:st=0.35:d=0.35,adelay=180', `fr${n}`, { db: -14, dense: true }),
    // 380ms 落地/弹跳
    K.br(land, `${lseg},asetpts=N/SR/TB,highpass=f=400,afade=t=in:st=0:d=0.02,afade=t=out:st=0.28:d=0.20,adelay=380`, `ld${n}`, { db: -8, dense: true }),
  ], 'atrim=0:0.85,afade=t=out:st=0.74:d=0.11', `bb${n}`), `bb${n}`, { comp: SLOW }),
    OUT, file, `block-break ← ${label}`, -16);
});
console.log('\n三条写到 ' + OUT);
