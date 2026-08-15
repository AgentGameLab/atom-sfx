#!/usr/bin/env node
/**
 * normalize-loudness.mjs —— 把渲染产物压到游戏可用的响度和动态范围
 *
 *   node tools/normalize-loudness.mjs <in.ogg> <out.ogg> [--lufs -18] [--ratio 2.5]
 *   node tools/normalize-loudness.mjs <目录> --in-place [--lufs -18]
 *
 * 为什么需要这一步：合成时按**峰值**归一，峰值齐了但**平均响度**可能差 10dB。
 * 游戏里耳朵听的是平均响度，而且 SFX 要在 BGM + 其他音效垫底的环境里全程听得见，
 * 所以动态范围必须比"物理真实"窄。实测现役音效动态差 9-24dB，我们按峰值归一的
 * 产物是 15-27dB —— hit 那一下够响，别的部分全被埋掉。
 *
 * 为什么不用 ffmpeg 的 loudnorm 一步到位：
 *   loudnorm 单遍是**动态模式**，需要足够长的音频才收敛。2 秒以内的 SFX 上它会
 *   给出错的增益 —— 实测把 -14.7 LUFS 的素材"归一"到了 -21.2，反而更轻。
 *   所以这里走确定性三步：先只压缩 → 实测 LUFS → 用 volume 精确补差值。
 *   loudnorm 只用来**测量**（print_format=json 的 input_i），不用来施加增益。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ff = (args) => spawnSync('ffmpeg', args, { maxBuffer: 1 << 26 });

/** 用 loudnorm 的测量模式读 integrated LUFS（只测量，不施加） */
export function measureLufs(file) {
  const r = ff(['-v', 'info', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const m = /"input_i"\s*:\s*"(-?[\d.]+)"/.exec(r.stderr.toString());
  const v = m ? Number(m[1]) : null;
  // -70 是 ffmpeg 对"测不出"的哨兵值（音频太短或太安静）
  return v == null || v <= -70 ? null : v;
}

/** 宽带 RMS（dBFS）。LUFS 测不出时的退路 —— 导出给别的脚本复用：
 *  短瞬态素材（<400ms）ebur128 一律测不出，每个脚本各写一遍必漏掉这个 fallback */
export function measureRms(file) {
  const r = ff(['-v', 'info', '-i', file, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-']);
  const m = /RMS level dB:\s*(-?[\d.]+)/.exec(r.stderr.toString());
  return m ? Number(m[1]) : null;
}

// LUFS 与 RMS 的经验偏移：实测本库归一到 -14 LUFS 的成品 RMS 落在 -16.6~-17.3，
// 取 3dB。K-weighting 对不同频谱内容加权不同，所以这是近似不是等式 —— 但对
// <400ms 的素材（ebur128 根本测不出）这是唯一可行的退路，比completely跳过强。
const LUFS_TO_RMS = -3;

/** 峰值与平均的差（crest factor）。决定要压多狠 —— 差得越大越压不动 */
function crestOf(file) {
  const r = ff(['-v', 'info', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const s = r.stderr.toString();
  const i = /"input_i"\s*:\s*"(-?[\d.]+)"/.exec(s);
  const tp = /"input_tp"\s*:\s*"(-?[\d.]+)"/.exec(s);
  return i && tp ? Number(tp[1]) - Number(i[1]) : null;
}

export function normalizeOne(src, out, { lufs = -18, ratio = null, quality = 5 } = {}) {
  // 没显式给 ratio 就按 crest 自动选：补增益前得先把峰值收下来，
  // 否则多补的部分全被 limiter 削掉，平均响度到不了目标（实测 block-raise
  // crest 25dB 时 ratio 2.5 补再多也停在 -21.5）
  if (ratio == null) {
    const c = crestOf(src) ?? 18;
    ratio = c > 22 ? 6 : c > 18 ? 4 : c > 14 ? 3 : 2;
  }
  const tmp = out.replace(/\.[^.]+$/, '.__norm.wav');
  // 1) 只压缩收动态，不动整体增益（makeup 交给第 3 步统一算）
  const c = ff([
    '-v', 'error', '-y', '-i', src,
    '-af', `acompressor=threshold=-26dB:ratio=${ratio}:attack=3:release=140`,
    '-ar', '48000', '-ac', '1', tmp,
  ]);
  if (c.status !== 0) throw new Error(`压缩失败 ${src}：${c.stderr?.toString().trim().split('\n').pop()}`);

  // 2) 实测压完的响度。短素材（<400ms）ebur128 测不出，退到 RMS
  let cur = measureLufs(tmp);
  let mode = 'LUFS';
  let target = lufs;
  if (cur == null) {
    cur = measureRms(tmp);
    target = lufs + LUFS_TO_RMS;
    mode = 'RMS';
  }
  const gain = cur == null ? 0 : target - cur;

  // 3) 精确补差值；limiter 只兜底防削，不参与响度决策
  const render = (g) =>
    ff([
      '-v', 'error', '-y', '-i', tmp,
      '-af', `volume=${g.toFixed(2)}dB,alimiter=limit=0.94`,
      '-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', String(quality), out,
    ]);
  const w = render(gain);
  if (w.status !== 0) {
    unlinkSync(tmp);
    throw new Error(`归一失败 ${src}：${w.stderr?.toString().trim().split('\n').pop()}`);
  }

  // 4) 补一轮：crest 大的素材补增益后会被 limiter 削掉一截，一次到不了目标
  const readBack = () => (mode === 'LUFS' ? measureLufs(out) : measureRms(out));
  let after = readBack();
  if (after != null && Math.abs(after - target) > 1.0) {
    render(gain + (target - after));
    after = readBack();
  }
  unlinkSync(tmp);
  return { before: cur, gain, after, mode };
}

// ── CLI ──
// 必须守卫：本文件导出 measureLufs/measureRms 供别的脚本复用，没有这道门
// import 的瞬间下面的 CLI 就会拿调用方的 argv 跑起来，把人家的目录归一一遍
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.log('用法：node tools/normalize-loudness.mjs <in|dir> [out] [--lufs -18] [--ratio 2.5] [--in-place]');
    process.exit(0);
  }
  const flag = (n, d) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? Number(argv[i + 1]) : d;
  };
  const inPlace = argv.includes('--in-place');
  const lufs = flag('lufs', -18);
  const ratio = argv.includes('--ratio') ? flag('ratio', null) : null;
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !isNaN(Number(a))));
  const [target, outArg] = positional;

  const isDir = existsSync(target) && !extname(target);
  const files = isDir
    ? readdirSync(target).filter((f) => /\.(ogg|mp3|wav)$/i.test(f) && !f.startsWith('_')).map((f) => join(target, f))
    : [target];

  console.log(`目标 ${lufs} LUFS · 压缩比 ${ratio}:1 · ${files.length} 个文件\n`);
  for (const f of files) {
    const out = isDir || inPlace ? f.replace(/\.[^.]+$/, '.__out.ogg') : outArg;
    const { before, gain, after, mode } = normalizeOne(f, out, { lufs, ratio });
    if (isDir || inPlace) renameSync(out, f.replace(/\.[^.]+$/, '.ogg'));
    const name = f.split(/[\\/]/).pop();
    console.log(`  ${name.padEnd(26)} ${before?.toFixed(1).padStart(6)} → ${after?.toFixed(1).padStart(6)} ${mode.padEnd(4)} (补 ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}dB)`);
  }
}
