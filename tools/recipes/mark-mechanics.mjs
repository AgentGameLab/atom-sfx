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
 * ── 机制约束 ─────────────────────────────────────────────
 * **`fuhuo-blast` 必须短（0.6s）**。combat.ts 的 fuhuoDetonated 带的是
 * `detonations` 数组 —— 多颗可以同时炸，引擎侧按放置顺序错峰复播同一个文件。
 * 单颗做长了三颗连锁就糊成一团。这个时长不是听感选择，是机制推出来的。
 *
 * `zuyin-echo` 同理会被 zuyinPulsed（万军呐喊，全场阵印一起脉冲）复播，
 * 但它 1.1s 偏长 —— 如果 pulsed 听起来糊，接线侧应该只播一次而不是每印一次。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = process.argv[2];
const PICKS = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
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
// 低频脉冲（框鼓低通）对应它给的格挡 —— 有护体的分量。
ff(['-i', A('seal__press__f3__01.wav'), '-i', A('seal__press__f2__01.wav'),
  '-i', join(PICKS, 'geodrone.wav'), '-filter_complex',
  `[0:a]areverse,atrim=0:0.30,asetpts=N/SR/TB,afade=t=in:st=0:d=0.26,volume=-3dB[pre];`
  + `[1:a]adelay=300|300,volume=0dB[main];`
  + `[2:a]atrim=4.0:4.9,asetpts=N/SR/TB,lowpass=f=260,volume=-4dB,`
  + `afade=t=in:st=0:d=0.1,afade=t=out:st=0.55:d=0.35,adelay=290|290[sub];`
  + `[pre][main][sub]amix=inputs=3:normalize=0,asetpts=N/SR/TB,`
  + `aecho=0.85:0.8:180|420:0.4|0.22,atrim=0:1.15,volume=-0.2dB,alimiter=level=disabled:limit=0.94[o]`,
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

// ── 伏火爆炸：低频 boom + 药纸炸开 ─────────────────────────
// hm1_boom 给低频冲击（<150Hz -28.7，全库最沉的现成素材），
// paper_burn + plastic_bag 给火药的碎裂噼啪。共享 paper_burn = 跟埋设呼应。
// 0.6s 硬约束：连锁复播（见文件头机制约束）。
// boom 的 crest 极大，必须先 acompressor 收瞬态再补增益，否则瞬态穿透 limiter
// 顶到 +2.8dB（实测）。这跟 normalize-loudness 的第二个坑是同一件事。
ff(['-i', join(PICKS, 'hm1_boom.wav'), '-i', A('paper_burn__crackle__01.wav'),
  '-i', A('plastic_bag__hand_rub__01.wav'), '-filter_complex',
  `[0:a]atrim=0:0.6,asetpts=N/SR/TB,volume=0dB[boom];`
  + `[1:a]atrim=0.6:1.1,asetpts=N/SR/TB,volume=-6dB,afade=t=out:st=0.3:d=0.2[fire];`
  + `[2:a]atrim=0:0.35,asetpts=N/SR/TB,highpass=f=1500,volume=-9dB,`
  + `afade=t=out:st=0.2:d=0.15,adelay=25|25[crack];`
  + `[boom][fire][crack]amix=inputs=3:normalize=0,asetpts=N/SR/TB,atrim=0:0.6,`
  + `afade=t=out:st=0.45:d=0.15,acompressor=threshold=-24dB:ratio=8:attack=1:release=80,volume=13.5dB,alimiter=level=disabled:limit=0.92[o]`,
  '-map', '[o]', ...enc, join(OUT, 'fuhuo-blast.ogg')]);
console.log('  fuhuo-blast.ogg   -19  低频 boom + 药纸炸开 + 噼啪（0.6s 为连锁）');

rmSync(TMP, { recursive: true, force: true });
console.log('\n四条 = 两对，每对共享一层：阵印共享 seal / 伏火共享 paper_burn');
