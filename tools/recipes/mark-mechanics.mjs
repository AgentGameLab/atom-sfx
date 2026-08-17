#!/usr/bin/env node
/**
 * 配方：棋门遁甲的两套「标记」机制音（阵印 / 伏火）
 *
 *   node tools/recipes/mark-mechanics.mjs <输出目录> [2024精选目录]
 *
 * 四条是**两对**，每对内部靠共享一层建立同一性（composition.md 第三条）：
 *   阵印：`zuyin-place` 盖下去 → `zuyin-echo` 它在响    共享 seal（印章按压）
 *   伏火：`fuhuo-plant` 埋进去 → `fuhuo-blast` 它炸了    共享 paper_burn（药纸）
 *
 * ── 响度梯度就是重要性编码 ────────────────────────────────
 *                 RMS    peak
 *   fuhuo-plant   -28.9  -4.0   隐秘动作。埋雷不该宣告，玩家自己知道就行
 *   zuyin-place   -23.9  -0.6   放置确认
 *   zuyin-echo    -19.9  -4.8   有伤害结算（周围 8 格 + 给格挡）
 *   fuhuo-blast   -23.3  -0.2   爆炸
 * 前三条按**这一刻对玩家有多重要**排，不是"调到好听"。
 *
 * fuhuo-blast 的 RMS 看着最低但**别去提它**：爆炸是高 crest 事件，峰值贴顶、
 * 平均值低才是它该有的形状。原定 -19，硬压到那个数就得把冲击感压平 —— 那是
 * 用数字换手感。这条上峰值比 RMS 更能代表听感。
 *
 * ── 同一个错犯了两次：延尾不能用离散回声 ──────────────────
 * `zuyin-echo` 初版 aecho 180/420ms → 听成三次敲击（"只能是一下"）。
 * `fuhuo-blast` 初版 aecho 180/400/750ms → 听成三声爆炸，而且连锁时 ×N。
 * **需要"长"的时候，要的是连续衰减不是离散反射。** 前者收到 45/95ms 当房间，
 * 后者改用低频 rumble 层撑长度。判据：逐 150ms 量峰值必须单调无第二峰。
 *
 * ── 一条被推翻的约束（留着当教训）────────────────────────
 * 初版把 `fuhuo-blast` 卡在 0.6s，理由是"连锁复播会糊"。**这个约束是错的**：
 * 爆炸的连锁本来就该是糊的（一片轰鸣），拖长的低频尾巴叠起来反而更像连锁。
 * 现在 1.5s，小天听审"0.6s 不带感"。
 *
 * 真正的时长约束来自**素材**不是机制：烟花录音的爆点间隔 1.0s、单次衰减
 * 0.9s（9.0s -6.6dB → 9.8s -34.5dB → 10.0s 下一发），截超 0.95s 就吃到
 * 下一次爆炸。所以取 0.95s 素材 + aecho 人工延尾到 1.5s。
 *
 * `zuyin-echo` 会被 zuyinPulsed（万军呐喊，全场阵印一起脉冲）复播 —— 那种
 * 情况接线侧应该**只播一次**而不是每印一次。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = process.argv[2];
const PICKS = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
// 烟花爆炸来自 GDC 2026 包（Ivo Vicic - Fireworks FX），预转成 48k 单声道后
// 放在 picks 目录，因为原文件 24s 立体声每次重跑都要重新解码
const PICKS_FW = process.argv[4] ?? PICKS;
if (!OUT) { console.error('用法：node tools/recipes/mark-mechanics.mjs <输出目录> [2024精选目录]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const TMP = join(tmpdir(), 'mark-mech-work');
mkdirSync(TMP, { recursive: true });

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
};
const enc = ['-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5'];
const A = (f) => `atoms/${f}`;

// ── 阵印出现：印章盖下 + 盘面落定 ─────────────────────────
// seal 的峰在 20ms（按压是瞬态），chessboard 垫低频给"钉在盘上"。
// 不加混响：放置是发生在这里的事，不是回响。
ff(['-i', A('seal__press__f2__01.wav'), '-i', A('chessboard__knock__r_center__f2__01.wav'),
  '-filter_complex',
  `[0:a]volume=0dB[a];`
  + `[1:a]lowpass=f=400,volume=-6dB,adelay=15|15[b];`
  + `[a][b]amix=inputs=2:normalize=0,asetpts=N/SR/TB,atrim=0:0.55,`
  + `afade=t=out:st=0.4:d=0.15,volume=2.0dB,alimiter=level=disabled:limit=0.94[o]`,
  '-map', '[o]', ...enc, join(OUT, 'zuyin-place.ogg')]);
console.log('  zuyin-place.ogg   -24  盖印 + 盘面落定');

// ── 阵印回响：同一枚印，但这次是它在响 ─────────────────────
// 倒放的 seal 当前导（气聚拢，方法论第四条），正放的 seal 当成型，
// 长混响给"回响"。共享 seal 音色 = 玩家能听出是同一枚印。
// 低频脉冲（geodrone 低通）对应它给的格挡 —— 有护体的分量。
// ⚠️ 反射必须**短**（45/95ms = 房间感）。初版用 180/420ms，小天听审"不能多下，
// 只能是一下" —— 那个延迟量听起来是三次敲击不是一次回响。前导也从 -3 降到
// -8dB：它该是"气"不该被听成独立的一下。
ff(['-i', A('seal__press__f3__01.wav'), '-i', A('seal__press__f2__01.wav'),
  '-i', join(PICKS, 'geodrone.wav'), '-filter_complex',
  `[0:a]areverse,atrim=0:0.30,asetpts=N/SR/TB,afade=t=in:st=0:d=0.28,volume=-8dB[pre];`
  + `[1:a]adelay=300|300,volume=0dB[main];`
  + `[2:a]atrim=4.0:4.9,asetpts=N/SR/TB,lowpass=f=260,volume=-4dB,`
  + `afade=t=in:st=0:d=0.1,afade=t=out:st=0.55:d=0.35,adelay=290|290[sub];`
  + `[pre][main][sub]amix=inputs=3:normalize=0,asetpts=N/SR/TB,`
  + `aecho=0.85:0.8:45|95:0.28|0.16,atrim=0:1.15,volume=0.5dB,alimiter=level=disabled:limit=0.94[o]`,
  '-map', '[o]', ...enc, join(OUT, 'zuyin-echo.ogg')]);
console.log('  zuyin-echo.ogg    -20  倒放前导 + 同枚印 + 低频脉冲 + 混响');

// ── 伏火埋设：戳进去 + 药纸 ────────────────────────────────
// cork stab 是"埋"的动作（锥形物戳软木，本来就是为刺入录的）。
// paper_burn 取**未燃的纸声**段落当药纸质感 —— 跟 fuhuo-blast 共享这一层。
// 最轻的一条：埋雷是隐秘动作，响了反而暴露。
ff(['-i', A('cork__stab__f1__01.wav'), '-i', A('paper_burn__crackle__01.wav'),
  '-filter_complex',
  `[0:a]volume=0dB[a];`
  + `[1:a]atrim=0.05:0.45,asetpts=N/SR/TB,highpass=f=1200,volume=-11dB,`
  + `afade=t=out:st=0.25:d=0.15,adelay=60|60[b];`
  + `[a][b]amix=inputs=2:normalize=0,asetpts=N/SR/TB,atrim=0:0.5,`
  + `afade=t=out:st=0.38:d=0.12,volume=8.4dB,alimiter=level=disabled:limit=0.94[o]`,
  '-map', '[o]', ...enc, join(OUT, 'fuhuo-plant.ogg')]);
console.log('  fuhuo-plant.ogg   -28  戳入 + 药纸（最轻，隐秘动作）');

// ── 伏火爆炸：真烟花 + 连续低频 rumble 延尾 ────────────────
// 声源是真烟花录音（小天听审选的）：**伏火和烟花都是黑火药**，材质同源。
// 之前用 hm1_boom 不行 —— 那是 "Cinematic Metallic Hit"，金属撞击不是爆炸，
// 带明确金属音色。爆炸该是宽带噪声 + 低频冲击。
//
// ⚠️ **延尾绝不能用长 aecho**。初版用 180/400/750ms 三次反射，听起来就是
// **三声爆炸**（小天：「blast 也只有一声啊，会有多个爆炸发生」）—— 游戏里多颗
// 连锁时每颗播一次，三颗就是九声。这跟 zuyin-echo 那条犯的是同一个错。
//
// 正确做法是**连续的低频 rumble**：爆炸的隆隆是低频在空间里持续衰减，不是
// 离散回声。geodrone 低通 200Hz、快起振（20ms）+ 长衰减（1.15s）叠在爆点上。
// aecho 只留 25/55ms 的极短反射当房间感 —— 那个延迟量不会被听成第二声。
//
// 验证方式：逐 150ms 量峰值，必须**单调衰减、无第二个峰**。现在是
// 0.15s -4.1 → 0.5s -9.7 → 1.1s -19.9 → 1.3s -62.7。
//
// 烟花远距离录的低频被距离吃掉（<150Hz 只有 -37.8），bass +7dB 补回来。
// paper_burn 那层是跟 fuhuo-plant 共享的药纸质感。
ff(['-i', join(PICKS_FW, 'fw.wav'), '-i', join(PICKS, 'geodrone.wav'),
  '-i', A('paper_burn__crackle__01.wav'), '-filter_complex',
  `[0:a]atrim=8.95:9.90,asetpts=N/SR/TB,bass=g=7:f=110,volume=8dB[boom];`
  + `[1:a]atrim=2.0:3.45,asetpts=N/SR/TB,lowpass=f=200,volume=-9dB,`
  + `afade=t=in:st=0:d=0.02,afade=t=out:st=0.08:d=1.15,adelay=50|50[rumble];`
  + `[2:a]atrim=0.6:1.1,asetpts=N/SR/TB,highpass=f=1500,volume=-12dB,`
  + `afade=t=out:st=0.3:d=0.2,adelay=40|40[fire];`
  + `[boom][rumble][fire]amix=inputs=3:normalize=0,asetpts=N/SR/TB,`
  + `aecho=0.9:0.9:25|55:0.20|0.10,atrim=0:1.5,afade=t=out:st=1.15:d=0.35,`
  + `acompressor=threshold=-24dB:ratio=4:attack=1:release=90,volume=10.5dB,`
  + `alimiter=level=disabled:limit=0.9[o]`,
  '-map', '[o]', ...enc, join(OUT, 'fuhuo-blast.ogg')]);
console.log('  fuhuo-blast.ogg   -20  真烟花 + 连续 rumble 延尾 1.5s（一声）');

rmSync(TMP, { recursive: true, force: true });
console.log('\n四条 = 两对，每对共享一层：阵印共享 seal / 伏火共享 paper_burn');
