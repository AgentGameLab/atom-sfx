#!/usr/bin/env node
/**
 * 配方：terrain-heal ×3 —— 治疗地块生成瞬间：格内木面返生
 *
 *   node tools/recipes/terrain-heal.mjs <输出目录>
 *
 * 底座 tools/ffkit.mjs。全部源在 atoms/。
 * canon：ui-object-spec §3 #23 治疗地块＝**格内木面返生**（色浅一档、木纹变清，
 * 与碎子「断口露新鲜木纹」同一语言）；地块层零绿。
 *
 * ── 现役是什么 ─────────────────────────────────────────────
 * `grill_rack__metal_slide__spd3` 三条原子**直出**（0804「烤网快档」）。0808 heal
 * 换成 `heal.mjs` 的瓷盘＋水之后 terrain-heal 没跟上，读数跟原子逐项吻合
 * （0.54s / 频心 13k / >8k 占 0dB / tonal 0.70）。整条非战斗库里最亮的一条，
 * 材质是金属格栅。
 *
 * ── 结构：木纹变清 + 与 heal 同一条水 ─────────────────────────
 *   0ms    木片顺纹滑（chopstick rub 的「滑」手势）：木纹在变
 *   90ms   第二条滑 +2 半音叠上去：两条错开、后一条高，听感是「上行」——
 *          asetrate 只能整条移调，「渐升」靠错开两条做
 *   40ms   water_trickle 低通 4k、淡入 80ms：**跟 heal.mjs 用的是同一条水**，
 *          共享一层让「地块生成」和「回血」读成同一件事（composition 三）
 *   0ms    wood_block f1 −12：极轻一记，「那一格变了」。不是敲，是变
 * 0.50s 收干。地块可能满地生成，一条一条叠起来不能糊——所以短、干、低频少。
 *
 * ── 响度 ───────────────────────────────────────────────────
 * −21.5：现役族均 −22.0，跟它要替换的对齐；比 heal（−19.9）轻 1.5dB——地块是
 * 环境，回血是结果。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/terrain-heal.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('terrain-heal');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (f, alias) => K.conv(join(ROOT, 'atoms', `${f}.wav`), alias);
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
const pitch = (n) => `asetrate=${semi(n)},aresample=48000`;
const SLOW = 'acompressor=threshold=-24dB:ratio=2.5:attack=20:release=120';

const tile = (i) => A(`chopstick__rub__v1__0${i}`, `tile${i}`);
const water = (i) => A(`water_trickle__flow__0${i}`, `water${i}`);
const blk = (f, i) => A(`wood_block__strike__f${f}__0${i}`, `blk${f}${i}`);

// 三条换木片的 take：01/07 是纯滑，06 是点+滑（截掉点只留拖尾）
const spec = [
  { a: [1, 'atrim=0.02:0.30'], b: [7, 'atrim=0:0.26'], w: 2, bi: 1 },
  { a: [7, 'atrim=0:0.28'],    b: [1, 'atrim=0.02:0.28'], w: 2, bi: 2 },
  { a: [6, 'atrim=0.16:0.42,areverse'], b: [7, 'atrim=0:0.26'], w: 1, bi: 3 },
];
spec.forEach((s, n) => {
  const file = n === 0 ? 'terrain-heal.ogg' : `terrain-heal-${n + 1}.ogg`;
  K.ship(K.level(K.mix([
    K.br(tile(s.a[0]), `${s.a[1]},asetpts=N/SR/TB,highpass=f=350,afade=t=out:st=0.18:d=0.10`, `th_a${n}`, { db: 0, dense: true }),
    K.br(tile(s.b[0]), `${s.b[1]},asetpts=N/SR/TB,${pitch(2)},highpass=f=400,afade=t=in:st=0:d=0.03,afade=t=out:st=0.16:d=0.10,adelay=90`, `th_b${n}`, { db: -3, dense: true }),
    K.br(water(s.w), 'atrim=0:0.40,asetpts=N/SR/TB,lowpass=f=4000,afade=t=in:st=0:d=0.08,afade=t=out:st=0.22:d=0.16,adelay=40', `th_w${n}`, { db: -8, dense: true }),
    K.br(blk(1, s.bi), 'atrim=0:0.08,asetpts=N/SR/TB,lowpass=f=2500,afade=t=out:st=0.04:d=0.04', `th_p${n}`, { db: -12 }),
  ], 'atrim=0:0.50,afade=t=out:st=0.42:d=0.08', `theal${n}`), `theal${n}`, { comp: SLOW }), OUT, file, `terrain-heal ← tile ${s.a[0]}+${s.b[0]}(+2) + water 0${s.w}`, -21.5);
});

console.log('\nterrain-heal ×3 写到 ' + OUT);
