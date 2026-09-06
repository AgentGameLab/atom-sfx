#!/usr/bin/env node
/**
 * 配方：UI 七键（hover / click / confirm / toggle / open / close / error）—— 纸木版
 *
 *   node tools/recipes/ui-wood.mjs <输出目录>
 *
 * 底座 tools/ffkit.mjs。全部源在 atoms/（自录），整仓可复现。
 * canon：qimen-dunjia/docs/design/sound-design-paper-wood-0906.md §2（五载体→动作→声）。
 *
 * ── 为什么换 ────────────────────────────────────────────────
 * 现役七键是 0722/0730 Suno 批：合成 click / whoosh / 低频闷响，没有一件是
 * 桌上的东西。ui-error 起音 340ms（错误提示慢了三分之一秒，24 个调用点）；
 * ui-click 主文件 2.0s、余韵 1.5s（一次点击拖一秒半）。
 *
 * ── 每个键在界面上是什么动作（0906 从 emitUiSfx 调用点查的）──
 *   hover    按钮悬停（audio.ts 委托）        → 木片轻抬：几乎只有起音
 *   click    .btn-qimen 通用按钮 + 盘面可交互格 → 木牌压案：软压 + 一记木
 *   confirm  确认类按钮（选职业/事件选项/选牌/商店成交）→ 令牌按下：比 click 重一档
 *   toggle   拨门/拨星、牌库草稿 ±、堆里选牌     → 木栓拨动：一记极短的木 + 木片刮一下
 *   open     图鉴/指南/排盘/弈力/战绩/设置/门选/牌库 → 翻开册子：纸 + 册子搁案一记
 *   close    上述合上                          → 合上册子：纸合拢 + 软的一拍
 *   error    买不起/门锁着/出牌被拒            → 木牌卡住：两记闷木，第二记更低
 *
 * ── 缺口（palette §2 录制清单）─────────────────────────────
 * 「厚木牌压案」#1 没录，click/confirm 用 seal__press（软木平底按纸）当「压」
 * 的替身 —— 它是库里唯一「压下去不弹起」的手势；木的重量靠 wood_block /
 * chessboard 补。录到真木牌后换芯即可，结构不动。
 * 「竹简摊卷」#3 没录，open/close 先按册子（纸）做——调用点里图鉴/指南/战绩/
 * 牌库这些册子类本来就多于简类（战斗日志那卷简现在还没有开合动作）。
 *
 * ── 响度 ───────────────────────────────────────────────────
 * 交互件档（composition 十）：hover -30 / toggle -26 / click -25 / open、close -23 /
 * confirm -23 / error -18（听审后从 -22 拉上来）。都 < 400ms，ship 走有效 RMS+3 的退路。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/ui-wood.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('ui-wood');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (f, alias) => K.conv(join(ROOT, 'atoms', `${f}.wav`), alias);
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
const pitch = (n) => `asetrate=${semi(n)},aresample=48000`;
// 木片 4ms 起音会被默认 3ms attack 咬掉（card-play 的教训）
const SLOW = 'acompressor=threshold=-24dB:ratio=2.5:attack=20:release=120';

const blk = (f, i) => A(`wood_block__strike__f${f}__0${i}`, `blk${f}${i}`);
const seal = (f, i) => A(`seal__press__f${f}__0${i}`, `seal${f}${i}`);
const knock = (r, f, i) => A(`chessboard__knock__r_${r}__f${f}__0${i}`, `knock_${r}${f}${i}`);
const tile = (i) => A(`chopstick__rub__v1__0${i}`, `tile${i}`);
const paper = (i) => A(`paper__flatten__0${i}`, `paper${i}`);
const scroll = (i) => A(`scroll__unroll__0${i}`, `scroll${i}`);
const pull = (s, i) => A(`cardboard__pull_out__spd${s}__0${i}`, `pull${s}${i}`);
const desk = (i) => A(`desk_padded__fingernail__r_center__f1__0${i}`, `desk${i}`);

const name = (key, n) => (n === 0 ? `${key}.ogg` : `${key}-${n + 1}.ogg`);

// ═══ ui-hover ×3：木片轻抬，只留起音 ═══════════════════════════
// 悬停 = 轻微抬起（ui-object-spec §2.2）。50ms 内收干，高通 700 去掉木块的
// 身体 —— 抬起来的是一片，不是一块。
[1, 2, 3].forEach((i, n) => {
  K.ship(K.level(K.mix([
    K.br(blk(1, i), 'atrim=0:0.06,asetpts=N/SR/TB,highpass=f=700,afade=t=out:st=0.02:d=0.04', `h${n}`, { db: 0 }),
  ], 'atrim=0:0.08', `hover${n}`), `hover${n}`, { comp: SLOW }), OUT, name('ui-hover', n), `hover ← blk f1-${i} 起音`, -30);
});

// ═══ ui-click ×2：木牌压案 = 真木牌压木桌（0906 录到了）+ 一记木 ═══
// 首版用 seal__press（软木平底按纸）当「压」的替身。小天 0906 录了「牌压桌」
// （wood_tag__press f1–f3，压的手势起音 5–20ms、身体 350–850ms），替身换真芯。
// ⚠ 桌面有一根 2.07kHz 的模态（三档九条全在，ring 300–600ms），是桌子不是牌，
// 用 bandreject 掐掉，不然每次点击都带一声「嗡」。wood_block f1 −8 只给起音一点
// 定义，压的身体全交给木牌。
const tag = (f, i) => A(`wood_tag__press__f${f}__0${i}`, `tag${f}${i}`);
const NOTCH = 'bandreject=f=2070:width_type=q:w=6';
[[1, 1, 1], [1, 2, 2]].forEach(([tf, ti, bi], n) => {
  K.ship(K.level(K.mix([
    K.br(tag(tf, ti), `atrim=0:0.18,asetpts=N/SR/TB,${NOTCH},lowpass=f=4000,afade=t=out:st=0.10:d=0.08`, `c_press${n}`, { db: 0 }),
    K.br(blk(1, bi), 'atrim=0:0.08,asetpts=N/SR/TB,afade=t=out:st=0.04:d=0.04', `c_wood${n}`, { db: -8 }),
  ], 'atrim=0:0.19,afade=t=out:st=0.15:d=0.04', `click${n}`), `click${n}`, { comp: SLOW }), OUT, name('ui-click', n), `click ← tag f${tf}-${ti} + blk f1-${bi}`, -25);
});

// ═══ ui-confirm ×2：令牌按下，比 click 重一档 ════════════════════
// 结束回合令牌是甲档（ui-object-spec §2.7）：木牌 f2 压下去，案面跟着受一记
// （chessboard r_center 低通 2k 只留盘身）。
[[2, 1, 1, 1], [2, 2, 2, 2]].forEach(([tf, ti, ki, bi], n) => {
  K.ship(K.level(K.mix([
    K.br(tag(tf, ti), `atrim=0:0.26,asetpts=N/SR/TB,${NOTCH},lowpass=f=3500,afade=t=out:st=0.16:d=0.10`, `f_press${n}`, { db: 0 }),
    K.br(knock('center', 2, ki), 'atrim=0:0.18,asetpts=N/SR/TB,lowpass=f=2000,afade=t=out:st=0.10:d=0.08', `f_board${n}`, { db: -6 }),
    K.br(blk(2, bi), 'atrim=0:0.08,asetpts=N/SR/TB,afade=t=out:st=0.04:d=0.04', `f_wood${n}`, { db: -9 }),
  ], 'atrim=0:0.27,afade=t=out:st=0.22:d=0.05', `confirm${n}`), `confirm${n}`, { comp: SLOW }), OUT, name('ui-confirm', n), `confirm ← tag f2-${ti} + knock center f2 + blk f2`, -23);
});

// ═══ ui-toggle ×2：木栓拨动 = 一记极短的木 + 木片刮一下 ═════════
[[1, 2, 3], [1, 3, 5]].forEach(([bf, bi, ti], n) => {
  K.ship(K.level(K.mix([
    K.br(blk(bf, bi), 'atrim=0:0.07,asetpts=N/SR/TB,afade=t=out:st=0.03:d=0.04', `t_wood${n}`, { db: 0 }),
    K.br(tile(ti), 'atrim=0:0.07,asetpts=N/SR/TB,highpass=f=1000,afade=t=out:st=0.03:d=0.04,adelay=8', `t_tile${n}`, { db: -7, dense: true }),
  ], 'atrim=0:0.10', `toggle${n}`), `toggle${n}`, { comp: SLOW }), OUT, name('ui-toggle', n), `toggle ← blk f1-${bi} + tile ${ti}`, -26);
});

// A/B（0906 竹节录到后）：toggle 用快刮一下竹节当「竹栓」——比木块亮、空，
// 跟以后的状态签 / 意图签是同一根竹。听审用，不是正式变体。
// （手法是刮不是敲，小天 0906 追认：「刮过那个竹节的感觉」）
const bamboo = (i) => A(`bamboo_node__scrape__v1__${String(i).padStart(2, '0')}`, `bamboo${i}`);
K.ship(K.level(K.mix([
  K.br(bamboo(3), 'atrim=0:0.09,asetpts=N/SR/TB,afade=t=out:st=0.05:d=0.04', 't_bamboo', { db: 0 }),
  K.br(tile(3), 'atrim=0:0.07,asetpts=N/SR/TB,highpass=f=1000,afade=t=out:st=0.03:d=0.04,adelay=8', 't_tile_b', { db: -9, dense: true }),
], 'atrim=0:0.11', 'toggle_b'), 'toggle_b', { comp: SLOW }), OUT, 'ui-toggle-bamboo.ogg', 'toggle ← bamboo 03 + tile 3（听审用）', -26);

// ═══ ui-open ×2：翻开册子 = 纸 + 册子搁案一记 ═══════════════════
// 纸在前、木在后：先翻开，再放到案上。木那一记 -10 只当「放稳了」。
K.ship(K.level(K.mix([
  K.br(paper(1), 'atrim=0.02:0.42,asetpts=N/SR/TB,highpass=f=250,afade=t=out:st=0.30:d=0.10', 'o_paper0', { db: 0, dense: true }),
  K.br(blk(1, 1), 'atrim=0:0.10,asetpts=N/SR/TB,lowpass=f=2500,afade=t=out:st=0.05:d=0.05,adelay=250', 'o_wood0', { db: -10 }),
], 'atrim=0:0.44,afade=t=out:st=0.38:d=0.06', 'open0'), 'open0', { comp: SLOW }), OUT, name('ui-open', 0), 'open ← paper 01 + blk', -23);
K.ship(K.level(K.mix([
  K.br(scroll(1), 'atrim=0.12:0.50,asetpts=N/SR/TB,highpass=f=250,afade=t=in:st=0:d=0.02,afade=t=out:st=0.26:d=0.12', 'o_paper1', { db: 0, dense: true }),
  K.br(paper(3), 'atrim=0:0.20,asetpts=N/SR/TB,highpass=f=400,afade=t=out:st=0.10:d=0.10,adelay=120', 'o_paper1b', { db: -6, dense: true }),
  K.br(blk(1, 2), 'atrim=0:0.10,asetpts=N/SR/TB,lowpass=f=2500,afade=t=out:st=0.05:d=0.05,adelay=270', 'o_wood1', { db: -10 }),
], 'atrim=0:0.44,afade=t=out:st=0.38:d=0.06', 'open1'), 'open1', { comp: SLOW }), OUT, name('ui-open', 1), 'open ← scroll 01 + paper 03 + blk', -23);

// ═══ ui-close ×2：合上册子 = 纸合拢 + 软的一拍 ═══════════════════
// 「合上」跟「翻开」的区别在收尾：翻开是纸铺开后放稳，合上是纸拢起后拍住。
// 拍住那一下用 seal（软压），不用木块——合上的是纸，不是木头。
K.ship(K.level(K.mix([
  K.br(paper(3), 'atrim=0:0.30,asetpts=N/SR/TB,highpass=f=250,afade=t=out:st=0.18:d=0.12', 'x_paper0', { db: 0, dense: true }),
  K.br(seal(1, 1), 'atrim=0:0.14,asetpts=N/SR/TB,lowpass=f=3000,afade=t=out:st=0.08:d=0.06,adelay=170', 'x_pat0', { db: -3 }),
], 'atrim=0:0.34,afade=t=out:st=0.28:d=0.06', 'close0'), 'close0', { comp: SLOW }), OUT, name('ui-close', 0), 'close ← paper 03 + seal f1', -23);
K.ship(K.level(K.mix([
  // 纸板抽出倒放 = 推回去；只取前段纤维摩擦
  K.br(pull(3, 1), 'atrim=0:0.24,asetpts=N/SR/TB,areverse,highpass=f=300,afade=t=in:st=0:d=0.03,afade=t=out:st=0.16:d=0.08', 'x_paper1', { db: 0, dense: true }),
  K.br(seal(2, 2), 'atrim=0:0.14,asetpts=N/SR/TB,lowpass=f=3000,afade=t=out:st=0.08:d=0.06,adelay=200', 'x_pat1', { db: -3 }),
], 'atrim=0:0.36,afade=t=out:st=0.30:d=0.06', 'close1'), 'close1', { comp: SLOW }), OUT, name('ui-close', 1), 'close ← pull spd3 倒放 + seal f2', -23);

// ═══ ui-error ×2：木牌卡住 = 两记闷木，第二记更低 ═══════════════
// 「不行」要立刻（atk ≤ 30ms）而且不能有音高。两记之间 55ms：一记是敲，
// 两记才是「卡住了没按下去」。第二记降 2 半音 + 低通更狠 = 更闷，往下走。
[[1, 2], [2, 3]].forEach(([i1, i2], n) => {
  K.ship(K.level(K.mix([
    K.br(blk(2, i1), 'atrim=0:0.09,asetpts=N/SR/TB,lowpass=f=1200,afade=t=out:st=0.05:d=0.04', `e_a${n}`, { db: 0 }),
    K.br(blk(2, i2), `atrim=0:0.10,asetpts=N/SR/TB,${pitch(-2)},lowpass=f=900,afade=t=out:st=0.05:d=0.05,adelay=55`, `e_b${n}`, { db: -2 }),
    // 垫木桌面的闷响给「卡住」一点身体
    K.br(desk(n + 1), 'atrim=0:0.12,asetpts=N/SR/TB,lowpass=f=600,afade=t=out:st=0.06:d=0.06', `e_body${n}`, { db: -9 }),
  // -18：小天 0906 听审「error 还是拉响一点」——拒绝要比确认（-23）跳出来，
  // 但不到现役 Suno 那条 -15 的程度（那是被拉响的合成音）。
  ], 'atrim=0:0.20,afade=t=out:st=0.16:d=0.04', `error${n}`), `error${n}`, { comp: SLOW }), OUT, name('ui-error', n), `error ← blk f2-${i1} + f2-${i2} -2semi + desk`, -18);
});

// ═══ energy ×2：得气 = 吸一口气 ══════════════════════════════════
// 首版做成「气珠拨一颗」（木块 +3 半音 + 木片 tick，0.05s，−21）——小天 0906
// 听审「听不出来，energy 不是气么」。对：状态牌上那颗珠是**记录**气，气本身是
// 人的一口气（声核白名单里的「人」：手、笔、印，加一口气）。
// 吸气＝口吹的轻 whoosh **倒放**：呼出去倒过来就是吸进来，起音软、收在最响处
// ＝吸满了截住。落点垫一颗珠 −12：气进了珠里。0.35s，−18。
// 二版 A/B（小天 0906）：air_slit「缝里吸气」的上行段 0.55s 干净但像气流，
// 口吹倒放短、糙、听得出是嘴——**选后者**（「快的这个更好」）。
// 现役 Suno 是 2s 的 74Hz 次低频 drone。sfxOnce 去重，一帧只响一次。
const breath = (w, i) => A(`breath_whoosh__mouth__w_${w}__0${i}`, `breath_${w}${i}`);
[[3, 'atrim=0.02:0.34', 2], [1, 'atrim=0.02:0.36', 3]].forEach(([wi, tr, bi], n) => {
  K.ship(K.level(K.mix([
    K.br(breath('light', wi), `${tr},asetpts=N/SR/TB,areverse,highpass=f=300,afade=t=in:st=0:d=0.04,afade=t=out:st=0.26:d=0.06`, `en_rev${n}`, { db: 0, dense: true }),
    K.br(blk(1, bi), `atrim=0:0.06,asetpts=N/SR/TB,${pitch(3)},highpass=f=600,afade=t=out:st=0.03:d=0.03,adelay=300`, `en_bead${n}`, { db: -12 }),
  ], 'atrim=0:0.38', `energy${n}`), `energy${n}`, { comp: SLOW }), OUT, name('energy', n), `energy ← 口吹 light 0${wi} 倒放 + 珠`, -18);
});

console.log('\nUI 七键 + energy 写到 ' + OUT);
