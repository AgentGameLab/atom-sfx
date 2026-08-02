#!/usr/bin/env node
/**
 * mix-layers.mjs —— Matcher v1：原子 → piece-move 候选变体
 *
 * 两个模式，对应 docs/audio-atom-pipeline.md 里要对比的两组：
 *   --mode direct    piece_place 整录 → 归一 → mp3（不混层）
 *   --mode layered   piece_contact_dry × board_body → 混层 → mp3
 *
 * 用法：
 *   node scripts/audio/mix-layers.mjs --mode direct
 *   node scripts/audio/mix-layers.mjs --mode layered --body-gain -3 --body-delay 4
 *
 * 关于归一（这里跟直觉相反，是有意的）：
 *   **不做 per-file 归一，只做 per-family 的单一增益。**
 *   力度轴的全部意义就是真实能量差 —— 每个文件各自归一到同一响度，
 *   轻放和落定就一样响了，轴直接废掉。所以整族用同一个系数缩放，
 *   族内相对关系原样保留，只把最响的那个对齐到目标峰值。
 *
 * 短瞬态用 peak/RMS 不用 LUFS：ebur128 的 integrated loudness 需要 ≥400ms
 * 的分析块，木子落板 300-400ms 正好在边界上，结果不可靠。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC_DIR = 'atoms';
const OUT_ROOT = 'candidates';
const TARGET_PEAK_DB = -3; // 族内最响的那个对齐到这里
const MP3_BITRATE = '192k'; // §7A 说 128-192 够用，源侧取上限

function parseArgs(argv) {
  const a = { mode: null, src: SRC_DIR, out: null, bodyGain: -3, bodyDelay: 4, defId: 'sfx', dryRun: false, family: null, contact: null, body: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--mode') a.mode = argv[++i];
    else if (k === '--src') a.src = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--body-gain') a.bodyGain = Number(argv[++i]);
    else if (k === '--body-delay') a.bodyDelay = Number(argv[++i]);
    else if (k === '--def-id') a.defId = argv[++i];
    else if (k === '--family') a.family = argv[++i]; // direct 模式用哪个 source
    else if (k === '--contact') a.contact = argv[++i]; // layered 的瞬态层
    else if (k === '--body') a.body = argv[++i]; // layered 的共振层
    else if (k === '--dry-run') a.dryRun = true;
    else throw new Error(`未知参数：${k}`);
  }
  if (!['direct', 'layered'].includes(a.mode)) throw new Error('--mode 要么 direct 要么 layered');
  a.out = a.out || join(OUT_ROOT, a.mode);
  return a;
}

function ff(args) {
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`ffmpeg 起不来（装了吗 / 在 PATH 里吗）：${r.error.message}`);
  return { status: r.status, stderr: r.stderr?.toString() ?? '' };
}

/** 读峰值和 RMS（dBFS）—— astats 对短音频可靠，ebur128 不行 */
function measure(file) {
  const { status, stderr } = ff(['-v', 'info', '-i', file, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-']);
  if (status !== 0) throw new Error(`分析失败 ${file}：${stderr.trim().split('\n').slice(-3).join(' ')}`);
  const peak = /Peak level dB:\s*(-?\d+(?:\.\d+)?|-?inf)/i.exec(stderr);
  const rms = /RMS level dB:\s*(-?\d+(?:\.\d+)?|-?inf)/i.exec(stderr);
  const num = (m) => (m ? (m[1].includes('inf') ? -Infinity : Number(m[1])) : null);
  const p = num(peak);
  if (p === null) throw new Error(`没读到峰值 ${file}（ffmpeg 版本太老？）`);
  return { peakDb: p, rmsDb: num(rms) };
}

/**
 * 解析 <source>__<technique>__<key_value>...__<axis+序号>__NN.wav
 * 例：desk_padded__fingernail__r_center__f1__01.wav
 *   → source=desk_padded, technique=fingernail, axis={r:'center', f:'1'}, variant=1
 * 也兼容老的 family__key_value__NN.wav。
 */
function parseAtom(name) {
  const m = /^(.+?)__(.+)__(\d+)\.wav$/i.exec(name);
  if (!m) return null;
  const axis = {};
  let technique = null;
  for (const part of m[2].split('__')) {
    const i = part.indexOf('_');
    if (i > 0) {
      axis[part.slice(0, i)] = part.slice(i + 1); // r_center → r=center
      continue;
    }
    const num = /^([a-z]+)(\d+)$/i.exec(part); // f1 → f=1
    if (num) axis[num[1]] = num[2];
    else if (!technique) technique = part; // 纯词 = 手法
  }
  return { file: name, family: m[1], technique, axis, variant: Number(m[3]) };
}

function scan(srcDir) {
  if (!existsSync(srcDir)) throw new Error(`原子目录不存在：${srcDir}（先跑 split-takes.mjs）`);
  const atoms = readdirSync(srcDir)
    .filter((f) => f.toLowerCase().endsWith('.wav'))
    .map(parseAtom)
    .filter(Boolean);
  const byFamily = new Map();
  for (const a of atoms) {
    if (!byFamily.has(a.family)) byFamily.set(a.family, []);
    byFamily.get(a.family).push(a);
  }
  return byFamily;
}

/** 整族统一增益：把族内最响的对齐到 TARGET_PEAK_DB，族内相对关系不动 */
function familyGain(srcDir, atoms) {
  let maxPeak = -Infinity;
  for (const a of atoms) {
    a.meas = measure(join(srcDir, a.file));
    if (a.meas.peakDb > maxPeak) maxPeak = a.meas.peakDb;
  }
  if (!Number.isFinite(maxPeak)) throw new Error('整族都是静音？检查素材');
  return TARGET_PEAK_DB - maxPeak;
}

// contact 走 transient role（高频主导，让出低频）；body 走 body role（低频主导，让出高频）
// 这就是「同 role 只准一层主导」的落地 —— 不做这步多层叠起来会糊
const SHAPE_CONTACT = 'bass=g=-4:f=200,treble=g=2:f=3000';
const SHAPE_BODY = 'bass=g=2:f=200,treble=g=-8:f=3000';

function outName(defId, n) {
  // §7A 变体约定：主文件 {defId}.mp3，变体从 {defId}-2.mp3 起
  return n === 1 ? `${defId}.mp3` : `${defId}-${n}.mp3`;
}

function renderDirect(srcDir, outDir, atoms, gainDb, defId, dryRun) {
  const rows = [];
  atoms.sort((a, b) => a.file.localeCompare(b.file));
  atoms.forEach((a, i) => {
    const out = join(outDir, outName(defId, i + 1));
    rows.push({ out: outName(defId, i + 1), from: a.file, gainDb: Number(gainDb.toFixed(2)), srcPeakDb: a.meas.peakDb });
    if (dryRun) return;
    const { status, stderr } = ff([
      '-v', 'error', '-y', '-i', join(srcDir, a.file),
      '-af', `volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.89`,
      '-ac', '1', '-c:a', 'libmp3lame', '-b:a', MP3_BITRATE, out,
    ]);
    if (status !== 0) throw new Error(`渲染失败 ${out}：${stderr.trim()}`);
  });
  return rows;
}

function renderLayered(srcDir, outDir, contacts, bodies, gains, opts) {
  const rows = [];
  // 按 force 配对：同一力度档的 contact 和 body 才配在一起
  const byForce = (list) => {
    const m = new Map();
    for (const a of list) {
      const f = a.axis.force ?? 'na';
      if (!m.has(f)) m.set(f, []);
      m.get(f).push(a);
    }
    return m;
  };
  const cf = byForce(contacts);
  const bf = byForce(bodies);
  let n = 0;
  for (const force of ['soft', 'mid', 'firm']) {
    const cs = (cf.get(force) ?? []).sort((a, b) => a.variant - b.variant);
    const bs = (bf.get(force) ?? []).sort((a, b) => a.file.localeCompare(b.file));
    if (!cs.length || !bs.length) {
      console.log(`⚠ force=${force} 缺层（contact ${cs.length} / body ${bs.length}），跳过`);
      continue;
    }
    for (const c of cs) {
      for (const b of bs) {
        n++;
        const out = join(outDir, outName(opts.defId, n));
        rows.push({
          out: outName(opts.defId, n), force,
          contact: c.file, body: b.file,
          contactGainDb: Number(gains.contact.toFixed(2)),
          bodyGainDb: Number((gains.body + opts.bodyGain).toFixed(2)),
          bodyDelayMs: opts.bodyDelay,
        });
        if (opts.dryRun) continue;
        const fc = [
          `[0:a]volume=${gains.contact.toFixed(2)}dB,${SHAPE_CONTACT}[c]`,
          `[1:a]adelay=delays=${opts.bodyDelay}:all=1,volume=${(gains.body + opts.bodyGain).toFixed(2)}dB,${SHAPE_BODY}[b]`,
          `[c][b]amix=inputs=2:duration=longest:normalize=0[m]`,
          `[m]alimiter=limit=0.89[out]`,
        ].join(';');
        const { status, stderr } = ff([
          '-v', 'error', '-y',
          '-i', join(srcDir, c.file), '-i', join(srcDir, b.file),
          '-filter_complex', fc, '-map', '[out]',
          '-ac', '1', '-c:a', 'libmp3lame', '-b:a', MP3_BITRATE, out,
        ]);
        if (status !== 0) throw new Error(`混层失败 ${out}：${stderr.trim()}`);
      }
    }
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv);
  const srcDir = resolve(args.src);
  const outDir = resolve(args.out);
  const byFamily = scan(srcDir);

  console.log(`\n原子目录：${srcDir}`);
  for (const [fam, list] of byFamily) console.log(`  ${fam}: ${list.length} 个`);

  if (!args.dryRun) mkdirSync(outDir, { recursive: true });
  let rows;

  if (args.mode === 'direct') {
    const fam = args.family ?? (byFamily.size === 1 ? [...byFamily.keys()][0] : null);
    if (!fam) throw new Error(`目录里有 ${byFamily.size} 个 source，用 --family 指定一个：${[...byFamily.keys()].join(' / ')}`);
    const atoms = byFamily.get(fam);
    if (!atoms?.length) throw new Error(`没找到 source「${fam}」，目录里有：${[...byFamily.keys()].join(' / ')}`);
    const gain = familyGain(srcDir, atoms);
    console.log(`\ndirect · ${fam} ${atoms.length} 个 · 整族增益 ${gain.toFixed(2)}dB（最响的对齐到 ${TARGET_PEAK_DB}dBFS）`);
    rows = renderDirect(srcDir, outDir, atoms, gain, args.defId, args.dryRun);
  } else {
    if (!args.contact || !args.body) {
      throw new Error(`layered 模式要指定两层：--contact <source> --body <source>。目录里有：${[...byFamily.keys()].join(' / ')}`);
    }
    const contacts = byFamily.get(args.contact);
    const bodies = byFamily.get(args.body);
    if (!contacts?.length) throw new Error(`没找到 contact 层「${args.contact}」，目录里有：${[...byFamily.keys()].join(' / ')}`);
    if (!bodies?.length) throw new Error(`没找到 body 层「${args.body}」，目录里有：${[...byFamily.keys()].join(' / ')}`);
    const gains = { contact: familyGain(srcDir, contacts), body: familyGain(srcDir, bodies) };
    console.log(`\nlayered · contact ${contacts.length} × body ${bodies.length}`);
    console.log(`  contact 增益 ${gains.contact.toFixed(2)}dB · body 增益 ${gains.body.toFixed(2)}dB${args.bodyGain >= 0 ? '+' : ''}${args.bodyGain}dB(--body-gain) · body 延迟 ${args.bodyDelay}ms`);
    rows = renderLayered(srcDir, outDir, contacts, bodies, gains, args);
  }

  console.log(`\n${args.dryRun ? '（dry-run）会生成' : '生成'} ${rows.length} 个变体`);
  for (const r of rows.slice(0, 6)) console.log(`  ${r.out}  ←  ${r.from ?? `${r.contact} + ${r.body}`}`);
  if (rows.length > 6) console.log(`  …… 其余 ${rows.length - 6} 个见 mix-report.json`);

  if (args.dryRun) {
    console.log(`\n--dry-run：没写文件。\n`);
    return;
  }
  writeFileSync(join(outDir, 'mix-report.json'), JSON.stringify({ mode: args.mode, generatedAt: new Date().toISOString(), opts: { bodyGain: args.bodyGain, bodyDelay: args.bodyDelay, targetPeakDb: TARGET_PEAK_DB }, rows }, null, 2));
  console.log(`\n写到 ${outDir}`);
  console.log(`\n装进游戏试听：`);
  console.log(`  cp ${join(args.out, `${args.defId}*.mp3`)} public/audio/sfx/`);
  console.log(`  node scripts/audio-manifest.mjs`);
  console.log(`\n（先把现有的 ${args.defId}*.mp3 备份出来，好换回去 A/B）\n`);
}

try {
  main();
} catch (e) {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
}
