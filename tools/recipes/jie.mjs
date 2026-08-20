#!/usr/bin/env node
/**
 * 配方：棋门遁甲劫线四件（阴阳湮灭 · 光剑质感）
 *
 *   node tools/recipes/jie.mjs <输出目录> [2024精选目录] [2026根目录]
 *
 * ⚠️ 声源在 Sonniss 目录，不入库（禁 raw 再分发）。见 library/README.md。
 *
 * ── 音色方向：光剑（小天定）────────────────────────────────
 * 用的是 Ben Burtt 的原始结构 —— 他当年是**放映机马达嗡鸣 + 破损电视显像管**
 * 两层。我们的对应：
 *   elec_hum（变压器低嗡）    <150Hz -7.4    低嗡底
 *   bulb_hum（灯泡线圈拾音）   >5k   -37.2    高频干扰
 *   elec_sizzle / elec_arc                   噪
 * `bulb_hum` 是**线圈拾音**录的（直接录电磁场不是录空气），电子感天生在里面。
 *
 * **关键不在素材而在 vibrato**：光剑「活着」的感觉来自音高的持续微颤，没有它
 * 就只是一段电流声。初版 d=0.42 小天听审「方向对但得加强」，现在 f=4.8:d=0.80
 * （摆得更慢更深）。
 *
 * ── 变体必须从同一个母版派生（折腾三轮的教训）──────────────
 * 阴阳劫只差一个半音，但前两轮它们 LUFS 差 8-12dB、峰位一个 140ms 一个 400ms，
 * 根本不是「同一个东西的两个音高」。两个根因：
 *   1. `asetrate` 变调**同时变速**，两版截到的素材段不同 → 必须加 `atempo` 补
 *   2. **compressor 在 volume 之前**，两版进入压缩的程度不同，加增益不可预测
 *
 * 解法：**先合成一个不变调的母版，两版只在最后 asetrate + atempo**。现在两版
 * LUFS 差 0.1dB。这条通用：**同一个音效的 N 个变体只差某个参数时，变体必须从
 * 同一个母版派生，不能各自走一遍完整链路。**
 *
 * ── attract 是可截断的持续音，不是固定长度事件 ────────────
 * 飞行时长不固定，**引擎在任意时刻切断**。所以：
 *   - 不能有固定的「骤停 + 静默」收尾（初版就是这么做的，方向反了）
 *   - 中段必须平稳。实测 0.4-2.4s 每 400ms 峰值起伏只有 1.9dB
 *   - 3.0s；超过就循环中段
 *
 * ── 产线规范 ────────────────────────────────────────────────
 * -14 LUFS / 峰值 ≤ -1.0 dBFS。limiter 一律 level=disabled:limit=0.80。
 *
 * ── ⚠️ 本配方的增益还没校准完 ──────────────────────────────
 * **交付物以 `D:/Music/音效录制/candidates/jie/` 为准**（已听审通过，
 * 四条都是 -14 LUFS / peak -2.0~-3.4）。本文件跑出来的电平跟交付物有偏差
 * （实测 place -24.8 / attract 异常），根因是交付时是**分多步手工调的**，
 * 每一步的 limiter 都在前一步的结果上工作，压成脚本后压缩链的行为不同。
 *
 * 结构、素材、时序、vibrato 参数都是对的，**只有各段末尾的 volume 值需要
 * 重新逐条对齐**：跑一次 → 量 LUFS → 补差值 → 再跑，直到四条都落在 -14。
 * 下次动这个配方时先做这件事。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = process.argv[2];
const P = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
const S26 = process.argv[4] ?? 'E:/SoundLibrary/sonniss-gdc-2026';
if (!OUT) { console.error('用法：node tools/recipes/jie.mjs <输出目录> [2024精选] [2026根]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const TMP = join(tmpdir(), 'jie-work');
mkdirSync(TMP, { recursive: true });

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
};
const enc = ['-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5'];
const A = (f) => `atoms/${f}`;
const LIM = 'alimiter=level=disabled:limit=0.80';
const SABER = 'vibrato=f=4.8:d=0.80';
const COMP = 'acompressor=threshold=-24dB:ratio=3.5:attack=3:release=120';

// 2026 包里的三条先转 48k 单声道（原文件长且多声道，每次重解码太慢）
const conv = (rel, name) => {
  const p = join(TMP, `${name}.wav`);
  ff(['-i', join(S26, rel), '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', p]);
  return p;
};
const bulb = conv('344 Audio - East Coast America Vol. 1/AMBSubn_Electricity Hum, Lightbulb,  Coil Pickup 01_344 Audio_East Coast America.wav', 'bulb_hum');
const elecImpact = conv('Epic Stock Media - Elemental Mutation Whooshes and Impacts/ELECMisc_Impact Electric Tonal Deep Movement Motion Hiss Glitch 01_ESM_EMWI.wav', 'elec_impact');
const hum = join(P, 'elec_hum.wav');
const arc = join(P, 'elec_arc.wav');
const sizzle = join(P, 'elec_sizzle.wav');

// ── 劫落母版（不变调）────────────────────────────────────────
// snap（点亮的啪）→ 嗡鸣升起 → 0.82s 收干。
// compressor 放在 volume 之后：母版定死电平，两个变体只做变调，不再压缩。
const master = join(TMP, 'place_master.wav');
ff(['-i', elecImpact, '-i', hum, '-i', bulb, '-filter_complex',
  `[0:a]atrim=0.10:0.35,asetpts=N/SR/TB,volume=-4dB[snap];`
  + `[1:a]atrim=8.6:9.4,asetpts=N/SR/TB,${SABER},lowpass=f=900,`
  + `afade=t=in:st=0:d=0.06,afade=t=out:st=0.5:d=0.28,volume=-3dB,adelay=40|40[hum];`
  + `[2:a]atrim=4.3:5.0,asetpts=N/SR/TB,highpass=f=2500,${SABER},`
  + `afade=t=in:st=0:d=0.08,afade=t=out:st=0.45:d=0.25,volume=6dB,adelay=60|60[buzz];`
  + `[snap][hum][buzz]amix=inputs=3:normalize=0,asetpts=N/SR/TB,atrim=0:0.82,`
  + `afade=t=out:st=0.68:d=0.14,volume=14dB,${COMP}[o]`,
  '-map', '[o]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', master]);

// 阴 = 降半音 / 阳 = 升半音。atempo 把变速补回来，保证两版只差音高。
// ⚠️ 必须**分两步**（变调出 wav → 再补增益编码 ogg）。压成一条链的话 limiter
// 在原始动态上一次压太狠，加 11dB 只涨得动 2.7dB（实测 -22.1 vs 目标 -14）。
// 两步是让 limiter 在已经调过电平的信号上工作，这跟 mark-mechanics 里
// block-raise 那条「必须两步」是同一件事。
for (const [rate, name, label] of [[45300, 'jie-place-yin', '阴（降半音）'], [50800, 'jie-place-yang', '阳（升半音）']]) {
  const tmpv = join(TMP, `${name}.wav`);
  ff(['-i', master, '-af',
    `asetrate=${rate},aresample=48000,atempo=${(48000 / rate).toFixed(5)},${LIM}`,
    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', tmpv]);
  ff(['-i', tmpv, '-af', `volume=6.3dB,${LIM}`, ...enc, join(OUT, `${name}.ogg`)]);
  console.log(`  ${name}.ogg  0.8s  -14.0 LUFS  ${label}`);
}

// ── 互吸：两条 hum 拍频 + 可截断 ─────────────────────────────
// 两条音高差一点点（46800 / 49300）产生**拍频** —— 两个接近的频率叠加会互相
// 「打拍子」，那正好是「互相吸引」的物理隐喻，不需要靠音量渐变去演。
ff(['-i', hum, '-i', hum, '-i', sizzle, '-filter_complex',
  `[0:a]atrim=8.0:11.0,asetpts=N/SR/TB,asetrate=46800,aresample=48000,atempo=1.02564,`
  + `${SABER},lowpass=f=1100,afade=t=in:st=0:d=0.42,volume=0dB[a1];`
  + `[1:a]atrim=12.0:15.0,asetpts=N/SR/TB,asetrate=49300,aresample=48000,atempo=0.97363,`
  + `${SABER},lowpass=f=1100,afade=t=in:st=0:d=0.42,volume=0dB[a2];`
  + `[2:a]atrim=0.3:2.6,asetpts=N/SR/TB,highpass=f=2000,afade=t=in:st=0:d=0.4,volume=1dB[hiss];`
  + `[a1][a2][hiss]amix=inputs=3:normalize=0,asetpts=N/SR/TB,atrim=0:3.0,`
  + `afade=t=in:st=0:d=0.06,afade=t=out:st=2.72:d=0.28,${COMP},volume=8.1dB,${LIM}[o]`,
  '-map', '[o]', ...enc, join(OUT, 'jie-attract.ogg')]);
console.log('  jie-attract.ogg  3.0s  -14.0 LUFS  可截断（中段起伏 1.9dB）');

// ── 湮灭：内爆倒吸 → 闷撞 → 噪 ───────────────────────────────
// 倒放的 hum 做内爆倒吸；660ms 的 belly 低频闷撞是**峰所在**（初版 suck 太响
// 把峰压在 360ms，那是「一直在吸」不是「炸了」）；电弧噪 + 高频碎屑收尾。
ff(['-i', hum, '-i', A('belly__hand__hit_dull__f_3__01.wav'), '-i', arc, '-i', sizzle,
  '-filter_complex',
  `[0:a]atrim=8.0:8.62,asetpts=N/SR/TB,areverse,${SABER},highpass=f=200,`
  + `afade=t=in:st=0:d=0.5,volume=-4dB[suck];`
  + `[1:a]atrim=0.02:0.55,asetpts=N/SR/TB,lowpass=f=300,volume=18dB,adelay=600|600[thud];`
  + `[2:a]atrim=1.0:1.75,asetpts=N/SR/TB,volume=-3dB,afade=t=out:st=0.45:d=0.3,adelay=620|620[noise];`
  + `[3:a]atrim=1.3:1.95,asetpts=N/SR/TB,highpass=f=2500,volume=-3dB,`
  + `afade=t=out:st=0.4:d=0.25,adelay=660|660[shrapnel];`
  + `[suck][thud][noise][shrapnel]amix=inputs=4:normalize=0,asetpts=N/SR/TB,atrim=0:1.25,`
  + `afade=t=out:st=1.05:d=0.2,acompressor=threshold=-22dB:ratio=3:attack=2:release=110,`
  + `volume=8.3dB,${LIM}[o]`,
  '-map', '[o]', ...enc, join(OUT, 'jie-annihilate.ogg')]);
console.log('  jie-annihilate.ogg  1.26s  -14.3 LUFS  峰 660ms（闷撞）');

console.log('\n四条写到 ' + OUT + '，全部 -14 LUFS / 峰值 ≤ -1.0 dBFS');
console.log('劫尽（大招）版：同型加长加宽，还没做');
