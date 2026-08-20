#!/usr/bin/env node
/**
 * ffkit —— 配方共用的 ffmpeg 底座
 *
 * 这里每一件都是踩出来的，不是「工程整洁」。配方直接手写 filter_complex 会
 * 反复掉进同三个坑（0820 校准劫线时全撞了一遍，详见 docs/composition.md 十二）：
 *
 *   1. **声源采样率没归一** → `asetrate` 之类的参数语义直接变掉。
 *      实测：96k 素材上 `asetrate=46800` 的「降 0.44 半音」变成了降八度。
 *   2. **vibrato 跟 amix 同链吐 NaN**（ffmpeg 8.1.1，非确定性）。NaN 一路穿到
 *      limiter，测出来的 LUFS 全是垃圾，表现为「增益怎么调都不对」。
 *   3. **电平写死常数** → 只在当时那条链上成立，改任何一段都得重调，
 *      而且改完没人知道要重调。
 *
 * 对应三件：`conv()` 强制 48k 单声道 / `br()`+`mix()` 一支路一落盘并验 NaN /
 * `level()`+`ship()` 全程测量驱动。
 *
 * 用法：
 *   const K = kit('dianbing');
 *   const sand = K.conv('E:/.../sand_fall.wav', 'sand');
 *   const raw  = K.mix([K.br(sand, 'atrim=0:0.5,...', 'a'), ...], '尾部滤镜', 'rally');
 *   K.ship(K.level(raw, 'rally', { lufs: -14 }), 'dianbing-rally.ogg', '起兵');
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { measureLufs, measureRms } from './normalize-loudness.mjs';

export const WAV = ['-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le'];
export const OGG = ['-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5'];
/** level=disabled 是必须的：默认 level=true 会把峰值**推上去**顶到 limit */
export const LIM = 'alimiter=level=disabled:limit=0.80';
/** 进压缩器前统一对齐到的峰值。压缩器阈值是绝对的，不定死喂进去的电平，
 *  压缩量就不可复现 —— 这也是「加了增益结果没变响」的常见根因 */
export const FEED_PEAK = -6;
/** 补增益之后的目标峰值。留 0.3dB 余量在 alimiter 的 -1.94 之上。 */
export const CEILING = -2.2;
/** 允许 limiter 削掉的深度上限。
 *
 *  游戏音效的行规就是 crest ~12dB（本库已听审通过的成品实测 8.9-12.3），
 *  而干净的混音常有 20-27dB —— 中间那一截就是靠压缩和限幅换来的，**这是
 *  正常工序不是破坏**。已过审的劫线湮灭就是 19.5 → 12.3，削了 7dB。
 *
 *  但也不能无上限：削太深整条会变成一堵墙。8dB 是照已过审批次反推的。
 *  还够不到目标就**报低**，那说明这条音效的 crest 天生太大，该改的是设计里
 *  各层的相对电平（把身体抬上来），不是继续加增益。
 *
 *  `ship(..., { depth })` 可以单条放宽。**只给一种情况用**：迁移老配方时，
 *  交付版本身就是靠更深的限幅换来的响度（老写法是 `volume=31dB` 直接顶进
 *  limiter，深度藏在那个常数里没人看得见）。这种放宽要把实测深度写在注释里
 *  —— 显式声明「这条削了 14dB」比藏着强，也才 review 得动。新配方不要用。
 *
 *  ⚠️ 判断「有没有被压平」要看 **RMS 包络**不是峰值包络 —— 限幅后的峰值
 *  包络必然贴着天花板走，拿它当尺子会把每一条正常成品都误判成压平了
 *  （0820 点兵就这么误判过一轮）。 */
export const LIMIT_DEPTH = 8;

export function kit(name, { comp = 'acompressor=threshold=-24dB:ratio=3.5:attack=3:release=120' } = {}) {
  const TMP = join(tmpdir(), `${name}-work`);
  mkdirSync(TMP, { recursive: true });

  const ff = (args, pre = []) => {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...pre, ...args], { maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop());
  };

  /** 峰值 + NaN/Inf 计数 */
  const inspect = (f) => {
    const s = spawnSync('ffmpeg', ['-v', 'info', '-i', f, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-'],
      { maxBuffer: 1 << 26 }).stderr.toString();
    const pk = /Peak level dB:\s*(-?[\d.]+)/.exec(s);
    const nan = /Number of NaNs:\s*([\d.]+)/.exec(s);
    const inf = /Number of Infs:\s*([\d.]+)/.exec(s);
    return { peak: pk ? Number(pk[1]) : NaN, bad: (nan ? Number(nan[1]) : 0) + (inf ? Number(inf[1]) : 0) };
  };
  const peakOf = (f) => {
    const { peak, bad } = inspect(f);
    if (bad > 0) throw new Error(`${f} 里有 ${bad} 个 NaN/Inf`);
    if (Number.isNaN(peak)) throw new Error(`测不出峰值：${f}`);
    return peak;
  };

  /** 渲一个中间产物，带 NaN 就重来。ffmpeg 侧的竞态，单跑同一条链几十次
   *  都不复现但整条配方跑起来偶发，只能验完重渲 */
  const render = (args, p, what) => {
    for (let i = 0; i < 4; i++) {
      ff(args, i ? ['-filter_threads', '1'] : []);
      if (!inspect(p).bad) return p;
      console.warn(`  ⚠ ${what} 第 ${i + 1} 次渲出 NaN，重渲`);
    }
    throw new Error(`${what} 连续 4 次都带 NaN`);
  };

  /** 声源归一到 48k 单声道。**每个外部素材进链之前都要过这一道** ——
   *  Sonniss 的包大量是 96kHz 立体声，链里的 aresample 兜不住（它在
   *  asetrate 之后才生效，那时候语义已经错了） */
  const conv = (src, alias) => {
    const p = join(TMP, `s_${alias}.wav`);
    ff(['-i', src, ...WAV, p]);
    return p;
  };

  /** 有效 RMS：只统计峰值 40dB 以内的样本。
   *  整段 RMS 会被前后静音和衰减尾拉低 —— 拿它当「这层有多响」会差十几 dB */
  const activeRms = (f) => {
    const b = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'f32le', '-ar', '48000', '-ac', '1', '-'],
      { maxBuffer: 1 << 28 }).stdout;
    const a = new Float32Array(b.buffer, b.byteOffset, b.length >> 2);
    let pk = 0;
    for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > pk) pk = v; }
    const floor = pk * Math.pow(10, -40 / 20);
    let sum = 0, n = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i]) >= floor) { sum += a[i] * a[i]; n++; }
    return n ? 20 * Math.log10(Math.sqrt(sum / n)) : -120;
  };

  /** 一条支路 → 一个 wav，**并归一到统一参考电平**。
   *
   *  为什么必须归一：设计时写的 `db: -9` 意思是「这层比主层轻 9dB」。但各个
   *  声源的原始电平能差 20dB 以上（0820 点兵实测：沙层的有效 RMS 比脚步低
   *  36dB），不归一的话 `-9dB` 根本不是那个意思 —— 你以为在做配比，实际在
   *  做随机数。表现出来就是「明明写了 -9，听着完全没有」。
   *
   *  归一用**有效 RMS** 不用峰值：峰值只代表最尖那一下，颗粒类素材（沙、
   *  碎石）峰值高但听感轻，拿峰值对齐会让沙层压过一切。
   *
   *  filter 里不要再写 volume —— 配比统一走 `db`。
   *
   *  `dense: true` 给**颗粒类素材**（沙、碎石、流沙）用。它们层内 crest 就有
   *  20dB 以上（单颗粒撞击是尖峰，平均能量很低），整条混完之后总 crest 大到
   *  怎么都推不响。在**支路上**压是对的：压的是层内颗粒密度，宏观包络还是
   *  由 filter 里的 fade 决定 —— 跟在总线上压完全不是一回事，后者才会把
   *  「涌起 / 飞行 / 压实」的三段结构抹平。 */
  const br = (src, filter, alias, { db = 0, ref = -22, dense = false } = {}) => {
    const t = join(TMP, `t_${alias}.wav`);
    render(['-i', src, '-af', filter + (dense
      ? ',acompressor=threshold=-30dB:ratio=6:attack=1:release=60' : ''), ...WAV, t], t, `支路 ${alias}`);
    // 迁移老配方用：老配方的配比写在 filter 里的 volume 上，`FFKIT_CAL=1` 跑一遍
    // （filter 里暂时留着那个 volume）就能把它换算成等价的 db —— 照抄回 br 的
    // 参数里，配比一模一样但从此是测量语义。迁完就该把 volume 从 filter 删掉。
    if (process.env.FFKIT_CAL) console.log(`  [cal] ${alias.padEnd(12)} db: ${(activeRms(t) - ref).toFixed(1)}`);
    const p = join(TMP, `b_${alias}.wav`);
    ff(['-i', t, '-af', `volume=${(ref + db - activeRms(t)).toFixed(2)}dB`, ...WAV, p]);
    return p;
  };

  /** 把已落盘的支路混起来。tail 是 amix 之后的滤镜串（不含首尾方括号） */
  const mix = (parts, tail, alias) => {
    const p = join(TMP, `m_${alias}.wav`);
    const chain = parts.map((_, i) => `[${i}:a]`).join('')
      + `amix=inputs=${parts.length}:normalize=0,asetpts=N/SR/TB`
      + (tail ? `,${tail}` : '') + '[o]';
    return render([...parts.flatMap((f) => ['-i', f]), '-filter_complex', chain, '-map', '[o]', ...WAV, p],
      p, `混音 ${alias}`);
  };

  /** 裸信号 → 压缩。返回 { file, peak }，交给 ship 去搜增益。
   *
   *  ⚠️ `squash` 默认 0，**不要随便调高**。
   *
   *  「LUFS 差一点点」的自然反应是加压缩。**这条路是错的。** 0820 点兵实测：
   *  为了把起兵从 -15.7 拉到 -14 而放开压缩梯度，「涌 300 / 飞 430 / 压实 730」
   *  的三段结构被压成一条直线 —— LUFS 达标了，音效毁了。（跟灵马 disperse
   *  那次同一个坑：压缩会把刻意做出来的衰减结构抹平。）
   *
   *  结构化的音效本来就该读得低：中间有意做空的段落会把 integrated LUFS
   *  拉下来，那不是缺陷。squash 只留给**真·单瞬态**（卡牌翻落这种没有内部
   *  结构可毁的）。 */
  const level = (raw, alias, { comp: c = null, squash = 0 } = {}) => {
    const ladder = c ? [c] : [
      comp,
      'acompressor=threshold=-26dB:ratio=5:attack=2:release=110',
      'acompressor=threshold=-28dB:ratio=8:attack=1:release=90',
      'acompressor=threshold=-30dB:ratio=12:attack=1:release=80',
    ].slice(0, 1 + Math.max(0, Math.min(3, squash)));
    const feed = (FEED_PEAK - peakOf(raw)).toFixed(2);
    const a = join(TMP, `l_${alias}.wav`);
    ff(['-i', raw, '-af', `volume=${feed}dB,${ladder[ladder.length - 1]}`, ...WAV, a]);
    return { file: a, peak: peakOf(a), alias };
  };

  /** 搜增益 → 编码 → **在成品上**量 → 再搜。
   *
   *  为什么必须在成品上收敛：limiter 削峰和 vorbis 编码都会改响度，而且
   *  改多少取决于削了多深 —— 事前算不准。0820 点兵试过「事前预测 + 事后
   *  补一刀」，预测值系统性偏乐观 5dB，因为它没算限幅吃掉的那部分。
   *
   *  唯一的自由变量是增益，上界是 `峰值余量 + LIMIT_DEPTH`。够不到目标就
   *  报低不硬顶。 */
  const ship = (lv, outDir, file, note, lufs = -14, { depth = LIMIT_DEPTH } = {}) => {
    const { file: src, peak, alias } = lv;
    const p = join(outDir, file);
    const gMax = CEILING + depth - peak;
    let lo = gMax - 24, hi = gMax, g = gMax, l = null;
    for (let i = 0; i < 8; i++) {
      ff(['-i', src, '-af', `volume=${g.toFixed(2)}dB,${LIM}`, ...OGG, p]);
      // <400ms 的素材 ebur128 一律测不出。退路用**有效 RMS**不用整段 RMS ——
      // 整段 RMS 把衰减尾和静音也算进去，瞬态素材上能低十几 dB（0820 实测
      // 卡回堆：整段 -27.9 / 有效 -18.4），照它补增益会把提示音做得死响。
      l = measureLufs(p) ?? (activeRms(p) + 3);
      if (Math.abs(lufs - l) <= 0.15) break;
      if (l < lufs) { if (g >= gMax - 0.01) break; lo = g; } else hi = g;
      const next = Math.min(gMax, (lo + hi) / 2);
      if (Math.abs(next - g) < 0.05) break;
      g = next;
    }
    if (lufs - l > 0.3) {
      console.warn(`  ⚠ ${alias} 差目标 ${(lufs - l).toFixed(1)}dB —— crest 太大，`
        + `削满 ${depth}dB 还够不到。把设计里的身体层抬上来，别加增益`);
    }
    const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p])
      .stdout.toString().trim();
    console.log(`  ${file.padEnd(26)} ${(+dur).toFixed(2)}s  ${l.toFixed(2).padStart(6)} LUFS  peak ${peakOf(p).toFixed(1).padStart(5)}  ${note}`);
    return p;
  };

  return { TMP, ff, conv, br, mix, level, ship, peakOf, inspect, activeRms };
}
