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
 * ── 每个声源必须先转成 48k 单声道（0820 挖出来的真 bug）────
 * Sonniss 的 elec_hum / elec_sizzle / elec_arc 是 **96kHz 立体声**。直接喂进
 * 滤镜链会同时炸两件事：
 *   1. **`asetrate` 的语义依赖输入采样率。** 本配方拿 `asetrate=46800` 做
 *      「差不到半音」的微失谐（46800/48000 → 0.44 半音），可素材是 96k 时它
 *      变成 **降八度**。实测频带能量整体下移一个八度：40Hz 档 +2.4dB、
 *      320Hz 档 -7.9dB，拍频完全不成立。
 *   2. 96k 立体声进 amix 时 astats 直接报 `Peak level dB: inf`。
 *
 * ── 每条支路必须先渲成 wav，再 amix（第二个真 bug）────────
 * `vibrato` 放在 `filter_complex` 里跟 `amix` 同链时会**吐 NaN 采样**。
 * 实测 ffmpeg 8.1.1：三路 `[snap][hum][buzz]amix` 出 37760 个 NaN（几乎整条
 * 都是），但把 amix 的输入**换个顺序**写成 `[buzz][snap][hum]` 就是 0 个，
 * 单独去掉 hum 支路的 vibrato 也是 0 个 —— 典型的帧调度竞态：vibrato 的延时
 * 缓冲还没填满就被 amix 拉走了第一帧，读到未初始化内存。
 *
 * NaN 往下游一路穿：limiter 在 NaN 上工作，`RMS level dB: nan`，测出来的
 * LUFS 全是垃圾，于是「增益怎么调都不对」。
 *
 * 而且它**非确定性**：同一条支路单独跑 48 次一次都不复现，整条配方跑起来偶发
 * （0820 校准时撞到 `b_a_lo.wav` 一次性 144629 个 NaN —— 几乎是整段，说明是
 * 启动期缓冲没填就被拉走，不是中途出错）。
 *
 * 解法两层：**一条支路一个 wav 分开渲**（落盘强制 flush，把故障面缩到最小），
 * 外加**每个中间产物过 `inspect()` 验 NaN，中招就重渲**（第二次起把 filter
 * 线程压到 1）。这类 bug 不能靠事后听审发现 —— NaN 一路穿到 limiter，
 * `RMS level dB: nan`，测出来的 LUFS 全是垃圾。
 *
 * 为什么交付时没撞上这两条：**交付是分多步手工跑的，每一步都写中间 wav 并带
 * `-ar 48000 -ac 1`** —— 采样率在步骤之间被顺手统一了，落盘也顺手 flush 掉了
 * 竞态。压成单条链之后这两层隐式保护全没了。**通用教训：多步手工产物压成
 * 脚本时，先补回中间步骤隐含的格式归一与落盘边界，再谈参数对不对。**
 *
 * ── 变体必须从同一个母版派生（折腾三轮的教训）──────────────
 * 阴阳劫只差一个半音，但早期版本它们 LUFS 差 8-12dB、峰位一个 140ms 一个
 * 400ms，根本不是「同一个东西的两个音高」。两个根因：
 *   1. `asetrate` 变调**同时变速** → 必须加 `atempo` 补回来
 *   2. **compressor 在 volume 之前**，两版进入压缩的程度不同，加增益不可预测
 * 解法：**先合成一个不变调、已定死电平的母版，两版只在最后变调**。
 * 这条通用：**同一个音效的 N 个变体只差某个参数时，变体必须从同一个母版
 * 派生，不能各自走一遍完整链路。**
 *
 * ── attract 是可截断的持续音，不是固定长度事件 ────────────
 * 飞行时长不固定，**引擎在任意时刻切断**。所以：
 *   - 不能有固定的「骤停 + 静默」收尾（初版就是这么做的，方向反了）
 *   - 中段必须平稳。实测 0.4-2.4s 每 400ms 峰值起伏只有 1.9dB
 *   - 3.0s；超过就循环中段
 *
 * ── 电平：测量驱动，不写死增益 ────────────────────────────
 * -14 LUFS / 峰值 ≤ -1.0 dBFS。不再手填 `volume=8.3dB` 这种常数 —— 常数只在
 * 当时那条链上成立，改任何一段都得重调。改成两次测量：
 *   1. 裸信号峰值 → 对齐到 FEED_PEAK 再进压缩器。**压缩器阈值是绝对值**，
 *      不定死喂进去的电平，压缩量就不可复现。
 *   2. 压缩后实测 LUFS → 补精确差值。limiter 只当安全网（实测不触发）。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { measureLufs, measureRms } from '../normalize-loudness.mjs';

const OUT = process.argv[2];
const P = process.argv[3] ?? 'E:/SoundLibrary/sonniss-gdc-2024-picks';
const S26 = process.argv[4] ?? 'E:/SoundLibrary/sonniss-gdc-2026';
if (!OUT) { console.error('用法：node tools/recipes/jie.mjs <输出目录> [2024精选] [2026根]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const TMP = join(tmpdir(), 'jie-work');
mkdirSync(TMP, { recursive: true });
const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'atoms');

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
};
const wav = ['-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le'];
const enc = ['-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5'];
const LIM = 'alimiter=level=disabled:limit=0.80';
const SABER = 'vibrato=f=4.8:d=0.80';
const COMP = 'acompressor=threshold=-24dB:ratio=3.5:attack=3:release=120';
const FEED_PEAK = -6;   // 进压缩器前统一对齐到的峰值
const TARGET = -14;     // 成品 LUFS

/** 所有声源先归一到 48k 单声道 —— 见文件头「真 bug」那节，这步不能省 */
const conv = (src, name) => {
  const p = join(TMP, `${name}.wav`);
  ff(['-i', src, ...wav, p]);
  return p;
};
/** 峰值 + NaN 计数。NaN > 0 立刻抛 —— 见文件头 vibrato/amix 竞态那节 */
const inspect = (f) => {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', f, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  const s = r.stderr.toString();
  const pk = /Peak level dB:\s*(-?[\d.]+)/.exec(s);
  const nan = /Number of NaNs:\s*([\d.]+)/.exec(s);
  const inf = /Number of Infs:\s*([\d.]+)/.exec(s);
  const bad = (nan ? Number(nan[1]) : 0) + (inf ? Number(inf[1]) : 0);
  if (!pk && !bad) throw new Error(`测不出峰值：${f}`);
  return { peak: pk ? Number(pk[1]) : NaN, bad };
};
const peakOf = (f) => {
  const { peak, bad } = inspect(f);
  if (bad > 0) throw new Error(`${f} 里有 ${bad} 个 NaN/Inf`);
  return peak;
};

/** 渲一个中间产物，NaN 就重来。见文件头 —— 这是 ffmpeg 侧的竞态，
 *  单跑同一条链 48 次一次都不复现，但整条配方跑起来偶发。重试比装作
 *  没这回事强，第二次起顺带把 filter 线程压到 1。 */
const render = (args, p, what) => {
  for (let i = 0; i < 4; i++) {
    ff(args, i ? ['-filter_threads', '1'] : []);
    const { bad } = inspect(p);
    if (!bad) return p;
    console.warn(`  ⚠ ${what} 第 ${i + 1} 次渲出 ${bad} 个 NaN（vibrato 竞态），重渲`);
  }
  throw new Error(`${what} 连续 4 次都带 NaN，别往下走了`);
};
/** 一条支路 → 一个 wav。落盘强制 flush，也让 NaN 在这一层就暴露 */
const br = (src, filter, name) => {
  const p = join(TMP, `b_${name}.wav`);
  return render(['-i', src, '-af', filter, ...wav, p], p, `支路 ${name}`);
};
/** 把已落盘的支路混起来 */
const mix = (parts, tail, name) => {
  const p = join(TMP, `${name}_raw.wav`);
  const chain = parts.map((_, i) => `[${i}:a]`).join('')
    + `amix=inputs=${parts.length}:normalize=0,asetpts=N/SR/TB,${tail}[o]`;
  return render([...parts.flatMap((f) => ['-i', f]), '-filter_complex', chain, '-map', '[o]', ...wav, p], p, `混音 ${name}`);
};

/** 裸信号 → 定量压缩 → 实测补增益。返回落定后的 wav 路径 */
function level(rawWav, name, comp = COMP) {
  const out = join(TMP, `${name}_lv.wav`);
  ff(['-i', rawWav, '-af', `volume=${(FEED_PEAK - peakOf(rawWav)).toFixed(2)}dB,${comp}`, ...wav, out]);
  // <400ms 的素材 ebur128 测不出，退回 RMS（见 normalize-loudness.mjs 的经验偏移）
  const l = measureLufs(out) ?? (measureRms(out) + 3);
  const fin = join(TMP, `${name}_fin.wav`);
  ff(['-i', out, '-af', `volume=${(TARGET - l).toFixed(2)}dB`, ...wav, fin]);
  return fin;
}
/** 编码成品。limiter 削峰 + vorbis 本身都会改一点响度（湮灭这种高 crest 的
 *  能差 0.7dB），所以量完成品再补一轮 —— 只在成品上测才是真的。 */
const ship = (src, file, note) => {
  const p = join(OUT, file);
  let g = 0, l = null;
  for (let i = 0; i < 3; i++) {
    ff(['-i', src, '-af', `volume=${g.toFixed(2)}dB,${LIM}`, ...enc, p]);
    l = measureLufs(p) ?? (measureRms(p) + 3);
    if (Math.abs(TARGET - l) <= 0.15) break;
    g += TARGET - l;
  }
  console.log(`  ${file.padEnd(22)} ${l.toFixed(2).padStart(6)} LUFS  peak ${peakOf(p).toFixed(1).padStart(5)}  ${note}`);
};

const bulb = conv(join(S26, '344 Audio - East Coast America Vol. 1/AMBSubn_Electricity Hum, Lightbulb,  Coil Pickup 01_344 Audio_East Coast America.wav'), 'bulb_hum');
const elecImpact = conv(join(S26, 'Epic Stock Media - Elemental Mutation Whooshes and Impacts/ELECMisc_Impact Electric Tonal Deep Movement Motion Hiss Glitch 01_ESM_EMWI.wav'), 'elec_impact');
const hum = conv(join(P, 'elec_hum.wav'), 'elec_hum');
const arc = conv(join(P, 'elec_arc.wav'), 'elec_arc');
const sizzle = conv(join(P, 'elec_sizzle.wav'), 'elec_sizzle');
const belly = conv(join(ATOMS, 'belly__hand__hit_dull__f_3__01.wav'), 'belly');

// ── 劫落母版（不变调）────────────────────────────────────────
// snap（点亮的啪）→ 嗡鸣升起 → 0.82s 收干。
const placeRaw = mix([
  br(elecImpact, `atrim=0.10:0.35,asetpts=N/SR/TB,volume=-4dB`, 'p_snap'),
  br(hum, `atrim=8.6:9.4,asetpts=N/SR/TB,${SABER},lowpass=f=900,`
    + `afade=t=in:st=0:d=0.06,afade=t=out:st=0.5:d=0.28,volume=-3dB,adelay=40`, 'p_hum'),
  br(bulb, `atrim=4.3:5.0,asetpts=N/SR/TB,highpass=f=2500,${SABER},`
    + `afade=t=in:st=0:d=0.08,afade=t=out:st=0.45:d=0.25,volume=6dB,adelay=60`, 'p_buzz'),
], 'atrim=0:0.82,afade=t=out:st=0.68:d=0.14', 'place');
const placeMaster = level(placeRaw, 'place');

// 阴 = 降半音 / 阳 = 升半音。atempo 把 asetrate 顺带改的速度补回来，
// 保证两版只差音高。母版电平已定死，这里不再压缩。
for (const [rate, name, label] of [[45300, 'jie-place-yin', '阴（降半音）'], [50800, 'jie-place-yang', '阳（升半音）']]) {
  const v = join(TMP, `${name}.wav`);
  ff(['-i', placeMaster, '-af',
    `asetrate=${rate},aresample=48000,atempo=${(48000 / rate).toFixed(5)}`, ...wav, v]);
  ship(v, `${name}.ogg`, label);
}

// ── 互吸：两条 hum 拍频 + 可截断 ─────────────────────────────
// 两条音高差一点点（46800 / 49300）产生**拍频** —— 两个接近的频率叠加会互相
// 「打拍子」，那正好是「互相吸引」的物理隐喻，不需要靠音量渐变去演。
// ⚠️ 这两个 asetrate 只有在 hum 已经是 48k 时才是「差一点点」，见文件头。
const attractRaw = mix([
  br(hum, `atrim=8.0:11.0,asetpts=N/SR/TB,asetrate=46800,aresample=48000,atempo=1.02564,`
    + `${SABER},lowpass=f=1100,afade=t=in:st=0:d=0.42`, 'a_lo'),
  br(hum, `atrim=12.0:15.0,asetpts=N/SR/TB,asetrate=49300,aresample=48000,atempo=0.97363,`
    + `${SABER},lowpass=f=1100,afade=t=in:st=0:d=0.42`, 'a_hi'),
  br(sizzle, `atrim=0.3:2.6,asetpts=N/SR/TB,highpass=f=2000,afade=t=in:st=0:d=0.4,volume=1dB`, 'a_hiss'),
], 'atrim=0:3.0,afade=t=in:st=0:d=0.06,afade=t=out:st=2.72:d=0.28', 'attract');
ship(level(attractRaw, 'attract'), 'jie-attract.ogg', '可截断（中段起伏 1.9dB）');

// ── 湮灭：内爆倒吸 → 闷撞 → 噪 ───────────────────────────────
// 倒放的 hum 做内爆倒吸；660ms 的 belly 低频闷撞是**峰所在**（初版 suck 太响
// 把峰压在 360ms，那是「一直在吸」不是「炸了」）；电弧噪 + 高频碎屑收尾。
const anRaw = mix([
  br(hum, `atrim=8.0:8.62,asetpts=N/SR/TB,areverse,${SABER},highpass=f=200,`
    + `afade=t=in:st=0:d=0.5,volume=-4dB`, 'n_suck'),
  br(belly, `atrim=0.02:0.55,asetpts=N/SR/TB,lowpass=f=300,volume=18dB,adelay=600`, 'n_thud'),
  br(arc, `atrim=1.0:1.75,asetpts=N/SR/TB,volume=-3dB,afade=t=out:st=0.45:d=0.3,adelay=620`, 'n_noise'),
  br(sizzle, `atrim=1.3:1.95,asetpts=N/SR/TB,highpass=f=2500,volume=-3dB,`
    + `afade=t=out:st=0.4:d=0.25,adelay=660`, 'n_shrap'),
], 'atrim=0:1.25,afade=t=out:st=1.05:d=0.2', 'annihilate');
ship(level(anRaw, 'annihilate', 'acompressor=threshold=-22dB:ratio=3:attack=2:release=110'),
  'jie-annihilate.ogg', '峰 660ms（闷撞）');

console.log('\n四条写到 ' + OUT);
console.log('劫尽（大招）版：同型加长加宽，还没做');
