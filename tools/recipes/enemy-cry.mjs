#!/usr/bin/env node
/**
 * 配方：棋门遁甲敌人起手叫声（七个发声原型）
 *
 *   node tools/recipes/enemy-cry.mjs <输出目录> [Sonniss根目录]
 *   默认 Sonniss 根 = E:/SoundLibrary/sonniss-gdc-2026
 *
 * ⚠️ **声源素材不在本仓**。Sonniss GDC 的条款禁止 raw 再分发（只能作为成品游戏
 * 的一部分），所以不能像 library/vcsl/（CC0）那样入库。获取见 library/README.md。
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
 * ── 两个坑 ──
 *
 * 1. `afir` 的 IR 有 **24000 系数硬上限**。0.5s @48kHz = 24000 正好卡死，报
 *    "Too big number of coefficients"。所有当 IR 用的素材先截到 0.3s 以内。
 *
 * 2. 卷积会大幅摊薄能量（实测掉 13-14dB），而且不同 IR 掉的量不同。**必须逐条
 *    补增益对齐**，不能套用同一个 volume 值 —— 这跟力度轴那条（同族同增益）不
 *    冲突：这里七条是七个不同原型，不是一个族。
 *
 * ── 设定约束 ──
 * 敌人是木/金属/石的造物不是血肉，**受击不叫、攻击起手才叫**。叫声的功能是
 * 听觉预警（跟威胁格预告同一个功能，走耳朵），所以必须落在前摇、且各原型间
 * 一耳朵能分辨。**无机类（夔鼓/磊卒/天柱/天任）不配叫声**，让材质本身说话。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = process.argv[2];
const SONNISS = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2026';
if (!OUT) { console.error('用法：node tools/recipes/enemy-cry.mjs <输出目录> [Sonniss根]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
// 中间产物放系统临时目录，别脏了输出目录（ffmpeg 刚写的文件在 Windows 上可能
// 还被占用，放输出目录里 rmSync 会静默失败留下 .tmp）
const TMP = join(tmpdir(), 'enemy-cry-work');
mkdirSync(TMP, { recursive: true });

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
};
const enc = ['-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5'];
const TARGET_RMS = -22; // 前摇预警档：比命中链轻，但要压过挥击音听得见

/** 声源：Sonniss 路径 → 48k 单声道 → 截取叫声段 */
function source(rel, name, ss, dur, fadeOutAt) {
  const raw = join(TMP, `${name}_raw.wav`), cut = join(TMP, `${name}.wav`);
  ff(['-i', join(SONNISS, rel), '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', raw]);
  ff(['-ss', String(ss), '-t', String(dur), '-i', raw, '-af',
    `asetpts=N/SR/TB,afade=t=in:st=0:d=0.02,afade=t=out:st=${fadeOutAt}:d=0.22`,
    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', cut]);
  return cut;
}
/** IR：截到 0.3s 以内（afir 24000 系数上限） */
function ir(atom, name, dur = 0.28) {
  const p = join(TMP, `ir_${name}.wav`);
  ff(['-i', `atoms/${atom}`, '-af', `atrim=0:${dur},asetpts=N/SR/TB`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', p]);
  return p;
}

const PROTO = [
  // 兽：狼人低吼 ⊛ 小木块。苍狼/罴卒/貔貅/䝙跃 —— 个体靠换 IR 和变调区分
  { name: 'cry-beast', mode: 'conv', gain: -5.5,
    src: ['Epic Stock Media - Halloween Game - Haunted House and Horror Audio Scare Kit/CREABeast_Creature Werewolf Growl Menacing Monstrous 06_ESM_HALG.wav', 'werewolf', 0.48, 1.10, 0.85],
    ir: ['wood_block__strike__f3__01.wav', 'wood3'] },
  // 虫：虫类颤动攻击 ⊛ 木块中档。蛊雏/坟羊
  { name: 'cry-insect', mode: 'conv', gain: -1.0,
    src: ['SoundBits - Vox Bestiae - Source Elements/CREAInsc_Insectoid Creature Tremble Attack Long 1_SNDBTS_VB-SE.wav', 'insect', 0, 0.95, 0.70],
    ir: ['wood_block__strike__f2__01.wav', 'wood2'] },
  // 水：水生咕噜 ⊛ 石板。溺卒/天蓬
  { name: 'cry-water', mode: 'conv', gain: 1.4,
    src: ['SoundBits - Vox Bestiae - Source Elements/CREAAqua_Aquatic Creature Gurgling 2_SNDBTS_VB-SE.wav', 'aqua', 1.20, 1.10, 0.85],
    ir: ['stone_slab__piece_drop__damp_dry__f2__01.wav', 'stone'] },
  // 大型兽：草食恐龙吼 ⊛ 小木块。奔彘（小天点名，冲刺锁线那一拍）
  { name: 'cry-boar', mode: 'conv', gain: 0.5,
    src: ['344 Audio - Dinosaurs Vol. 2/ANMLRept_Large Herbivore Roar 01_344 Audio_Dinosaurs Vol 2.wav', 'roar', 7.4, 1.10, 0.85],
    ir: ['wood_block__strike__f3__01.wav', 'wood3'] },
];

// 叠加型：材质是表面不是身体
const LAYERED = [
  // 铁翎：迅猛龙尖啸 + 金属刮擦。铁羽是表面，所以金属在旁边响不是卷进去
  { name: 'cry-tieling', srcGain: -4.4, layGain: -8.4, layDelay: 40,
    src: ['344 Audio - Dinosaurs Vol. 1/ANMLRept_Raptor Flair_344 Audio_Dinosaurs.wav', 'raptor', 0.05, 1.00, 0.75],
    lay: 'metal_screech__scrape__01.wav', layTrim: [0.3, 1.0], layFade: 0.45 },
  // 人形：兽人蓄力攻击 + 金属板。铜额卒/砮魂/陵俑（陵俑该换 ceramic_plate）
  { name: 'cry-humanoid', srcGain: -13.2, layGain: -20.2, layDelay: 30,
    src: ['Epic Stock Media - Humanoid Creatures Vol 4 - Monstrous and Undead Creature Vocalization Sound Sets/CREAHmn_Designed Orc Male Attack Long Heavy Hit Charged Up 03_ESM_HC4.wav', 'orc', 0.30, 1.15, 0.90],
    lay: 'metal_board2__piece_drop__r_center__01.wav', layTrim: null, layFade: null },
];

for (const p of PROTO) {
  const s = source(...p.src), i = ir(...p.ir);
  ff(['-i', s, '-i', i, '-filter_complex',
    `[0:a][1:a]afir=dry=2:wet=8:maxir=0.35,asetpts=N/SR/TB,volume=${p.gain}dB,alimiter=limit=0.94[o]`,
    '-map', '[o]', ...enc, join(OUT, `${p.name}.ogg`)]);
  console.log(`  ${p.name}.ogg  (卷积)`);
}
for (const p of LAYERED) {
  const s = source(...p.src);
  const layChain = [
    p.layTrim ? `atrim=${p.layTrim[0]}:${p.layTrim[1]},asetpts=N/SR/TB` : null,
    `volume=${p.layGain}dB`,
    p.layFade ? `afade=t=out:st=${p.layFade}:d=0.25` : null,
    `adelay=${p.layDelay}|${p.layDelay}`,
  ].filter(Boolean).join(',');
  ff(['-i', s, '-i', `atoms/${p.lay}`, '-filter_complex',
    `[0:a]volume=${p.srcGain}dB[a];[1:a]${layChain}[b];`
    + `[a][b]amix=inputs=2:normalize=0,asetpts=N/SR/TB,alimiter=limit=0.94[o]`,
    '-map', '[o]', ...enc, join(OUT, `${p.name}.ogg`)]);
  console.log(`  ${p.name}.ogg  (叠加)`);
}

// 鬼：阿兹特克死亡哨 + 倒放前导 + 长混响。魍魉/磷火/虚子
// 小天听审：不卷积（卷了就闷）、要长混响给空间、要倒放前导给"从远处飘来"。
// ⚠️ 3.17s 且峰在 1180ms，**适合出场音或持续状态，不适合攻击前摇预警** ——
// 前摇要让玩家知道"现在"，这条起手没有明确时间点。要前摇得另切短版。
{
  const s = source('InMotionAudio - The Death Whistle/CREAEthr_Aztec Death Whistle Distortion_02_IMA_Death Whistle Samples.wav', 'whistle', 0.48, 0.95, 0.70);
  const LONG = 'aecho=0.8:0.85:300|650|1100|1700:0.5|0.38|0.28|0.20';
  ff(['-i', s, '-i', s, '-filter_complex',
    `[0:a]areverse,atrim=0:0.55,asetpts=N/SR/TB,afade=t=in:st=0:d=0.5,volume=-7dB[pre];`
    + `[1:a]adelay=520|520[main];[pre][main]amix=inputs=2:normalize=0,asetpts=N/SR/TB,`
    + `${LONG},highshelf=g=4:f=3500,volume=-3dB,alimiter=limit=0.94[o]`,
    '-map', '[o]', ...enc, join(OUT, 'cry-ghost.ogg')]);
  console.log('  cry-ghost.ogg  (长混响 + 倒放前导)');
}

console.log(`\n七个原型写到 ${OUT}，全部 RMS ≈ ${TARGET_RMS}`);
console.log('铺到具体敌人：同原型内换 IR 材质 + 变调区分个体（罴卒用 chessboard 更闷更大只、陵俑换 ceramic_plate）');
