#!/usr/bin/env node
/**
 * 配方：进新门（木门吱嘎）+ 波浪地块（水流）
 *
 *   node tools/recipes/gate-water.mjs <输出目录> [门水精选目录]
 *
 * 底座 tools/ffkit.mjs。⚠️ 声源采样率是 48k/96k/**192k** 混着的，必须走
 * `conv()` —— 见 docs/composition.md 十二。
 *
 * ── 两条各自要接的缺口（0822 从代码里查的）──────────────────
 *
 * **gate-open**：16 层 = 八门×2，`doorIndexForFloor(levelIndex)` 变化即"进了
 * 新门"。门名 VO（`checkDoorVo`）0804 被小天摘掉了（`if (true) return`），
 * 但**进门这个时刻本身一直没有音效**。这条补的是那个空位。
 *
 * **terrain-wave**：波浪地块一直在**借治疗音** —— `audio.ts` 落地时
 * `sfxOnce('terrain-heal')`、回合结束再恢复时 `sfxOnce('heal')`。借音能用但
 * 读不出"水"，波浪地块的身份全靠美术扛。
 *
 * ── 开门不是关门的倒放（两版 A/B 的由来）──────────────────
 * PMSFX HAUNTED DOORS 的 source 版音色最好，但它是**关门**：一段渐强的吱嘎，
 * 4.8s 处一记 -16dB 的门框撞击。
 *
 * 直觉是整段倒放当开门。**不对** —— 倒放会把撞击放到开头，变成「先撞一下再
 * 吱嘎」。开门的因果是：有人施力（门闩）→ 木轴才叫 → 门扇停住。
 * **素材里的事件顺序不等于你要的事件顺序，切之前先读包络。**
 *
 * 当时做了两版给小天听：
 *   A 主层 = door_closet（**真·开门**的吱嘎，因果天然对，但个头是柜门）
 *   B 主层 = door_long_creak 撞击**之前**那段（门够大够沉，但运动方向本是关门）
 * **小天选 B。** 记一笔：这类取舍上**「像不像那个东西」比「因果对不对」更早
 * 被耳朵判定** —— 因果只有在两者体量相当时才成为决胜项。A 版已删。
 *
 * ── 水地块是一次性事件，不是环境音 ──────────────────────────
 * 接的是 `sfxOnce`：单位落上去响一下。所以要**短促水花 + 短余韵**，不是循环
 * 流水。做成持续流水会在盘面上叠成一片噪声（波浪地块可能满地）。
 *
 * ── 响度对齐现役同档 ────────────────────────────────────────
 * 实测现役：terrain-heal -20.8 / heal -19.9 / terrain-fire -15.4 /
 * event-open -12.8 / shop-open -22.0 / rest-open -24.0。
 *   terrain-wave -20.5：跟它要替换的 terrain-heal 同档，接线时电平不跳。
 *   gate-open   -18.0：层转场是叙事节点，要比 UI 面板（-22~-24）有分量，
 *                      但不能到 event-open（-12.8）那种强提示 —— 进门是
 *                      "翻过一页"不是"出事了"。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
const S = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-door-water-picks';
if (!OUT) { console.error('用法：node tools/recipes/gate-water.mjs <输出目录> [门水精选]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('gate-water');
const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'atoms');
const A = (f, alias) => K.conv(join(ATOMS, `${f}.wav`), alias);
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(2);
const pitch = (n) => `asetrate=${semi(n)},aresample=48000,atempo=${Math.pow(2, -n / 12).toFixed(5)}`;

const knob = K.conv(join(S, 'door_knob.wav'), 'knob');
const creak = K.conv(join(S, 'door_long_creak.wav'), 'creak');
const gate = K.conv(join(S, 'door_wood_gate.wav'), 'gate');
const cupboard = K.conv(join(S, 'door_cupboard.wav'), 'cupboard');
const woodStress = K.conv(join(S, 'wood_stress.wav'), 'wood_stress');
const closet = K.conv(join(S, 'door_closet.wav'), 'closet');
const sink = K.conv(join(S, 'water_sink.wav'), 'sink');
const pour = K.conv(join(S, 'water_pour.wav'), 'pour');
const steady = K.conv(join(S, 'water_steady.wav'), 'steady');
// 自录的一条，比库里任何水都干净
const trickle = A('water_trickle__flow__01', 'trickle');

// ═══ 进新门 ═════════════════════════════════════════════════════
// 因果顺序：施力（门闩）→ 木轴叫（主层）→ 收。
//
// **A 版已淘汰，B 版胜出**（小天 0822 听审）。A 用的是 door_closet 那条真·开门
// 吱嘎，语义对但个头是柜门；B 用 door_long_creak 撞击**之前**那段，运动方向本是
// 关门，但门够大够沉。听下来体量赢过语义 —— 记一笔：**这类取舍上「像不像那个
// 东西」比「因果对不对」更早被耳朵判定**，因果只有在两者体量相当时才成为决胜项。
//
// **「门扇到位」那一层也被小天剪掉了。** 我原本在 1450ms 放了一记闷顿收尾，还
// 专门让吱嘎提前收出一段空给它。他试听后直接删掉整段 —— 进新门是**过场**不是
// **完成**，给它一个收束的句号反而把"翻过一页"读成了"这一段结束了"。
// 现在结构是：门闩 → 吱嘎起→盛→自然衰竭，1.45s 收干，不给句号。
K.ship(K.level(K.mix([
  // 0ms 门闩/把手：一声就够，这是「有人推了它」的交代
  K.br(knob, `atrim=0:0.30,asetpts=N/SR/TB,afade=t=out:st=0.20:d=0.10`, 'g_latch', { db: -5 }),
  // 200ms 木轴吱嘎（主层）：取撞击之前最厚的一截，降 3 个半音让门更大更沉
  K.br(creak, `atrim=2.55:3.85,asetpts=N/SR/TB,${pitch(-3)},`
    + `afade=t=in:st=0:d=0.18,afade=t=out:st=0.82:d=0.42,adelay=200`, 'g_creak', { db: 0 }),
  // 木体重量：门扇本身在受力，低通只留身体不留吱声
  K.br(woodStress, `atrim=0.9:1.95,asetpts=N/SR/TB,lowpass=f=700,${pitch(-4)},`
    + `afade=t=in:st=0:d=0.25,afade=t=out:st=0.62:d=0.40,adelay=250`, 'g_body', { db: -9 }),
], 'atrim=0:1.45,afade=t=out:st=1.375:d=0.065', 'gate'), 'gate'),
  OUT, 'gate-open.ogg', '进新门（闩 0 / 吱嘎 200 / 1.45s 收干，不给句号）', -18);

// ═══ 波浪地块 ══════════════════════════════════════════════════
// 一次性水花，不是循环流水（见文件头）。形状：涌起 → 散开 → 短尾。
// ⚠️ 三层的 fade 要**错开着收**。初版三层都拖到 500ms 以后，叠出来是一个
// 450ms 的平台 —— 听着像「一小段流水」不是「踩上去水花起来」。水花的形状是
// 快起快落，所以主层 160ms 就开始收，后两层各晚一点收，尾巴才是渐次散开的。
K.ship(K.level(K.mix([
  // 涌起：稳定流本身是**匀的**（实测 21s 全程 -16~-17 无起伏），
  // 所以形状**全靠 fade 造**，不靠找一个"正好在涌"的段落 —— 找不到的。
  // exp 曲线的前段慢后段快，正好是水被踩起来那一下。
  K.br(steady, `atrim=6.0:6.55,asetpts=N/SR/TB,highpass=f=200,`
    + `afade=t=in:st=0:d=0.11:curve=exp,afade=t=out:st=0.16:d=0.33`, 'w_rise', { db: 0, dense: true }),
  // 散开：换一条不同质地的水（龙头 vs 坝流）叠出层次，同一条素材叠自己只会变响
  K.br(sink, `atrim=8.0:8.42,asetpts=N/SR/TB,highpass=f=700,${pitch(3)},`
    + `afade=t=in:st=0:d=0.05,afade=t=out:st=0.12:d=0.28,adelay=90`, 'w_body', { db: -5, dense: true }),
  // 短尾：自录那条最干净，收在 700ms
  K.br(trickle, `atrim=0:0.40,asetpts=N/SR/TB,highpass=f=800,`
    + `afade=t=out:st=0.10:d=0.30,adelay=250`, 'w_tail', { db: -9, dense: true }),
], 'atrim=0:0.75,afade=t=out:st=0.62:d=0.13', 'wave'), 'wave'),
  OUT, 'terrain-wave.ogg', '波浪地块（一次性水花，对齐 terrain-heal 档）', -20.5);

console.log('\n两条写到 ' + OUT);
