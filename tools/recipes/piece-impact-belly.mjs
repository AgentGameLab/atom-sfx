#!/usr/bin/env node
/**
 * 配方：给 piece-impact 的 heavy/lethal 两档叠 belly 低频层
 *
 *   node tools/recipes/piece-impact-belly.mjs <输出目录>
 *
 * 起因：现役四档的低频轴是反的 —— heavy(-28.3) 比 light(-22.0) 还少 6dB，
 * 重击听起来更"脆"而不是更"重"。按方法论第一条，只能加低频层，不能压别的层。
 *
 * 只做 heavy/lethal 不做 light/medium：belly 是"重击才有的肉感"，判据二说
 * 只在某些状态出现的成分就该只在那些状态出现。游戏侧 supplementalImpactSfx
 * 也正好把额外层的分界画在 heavy 上。
 *
 * 补偿用 RMS 不用 LUFS，且只用 volume 不再压缩：源已经归一压过一轮，
 * 二次压缩会把刚加进去的低频动态又拍平。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
const SFX = 'E:/Project/qimen-dunjia/public/audio/sfx';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const ff = (a) => { const r = spawnSync('ffmpeg', ['-v','error','-y',...a], { maxBuffer: 1<<26 }); if (r.status !== 0) throw new Error(r.stderr.toString().trim().split('\n').pop()); };
// piece-impact 只有 0.31s —— ebur128 需要 >=400ms 分析块，LUFS 一律测不出，
// 直接用 RMS。目标不是绝对值而是"保持原文件的 RMS"：这批已经归一过，
// 要的是低频占比变高，不是整体变响（变响会破坏跟其他音效的平衡）
import { measureRms } from '../normalize-loudness.mjs';
// belly 变体：file + 包络峰位（ms）。截取起点 = 峰-10ms，让低频峰落在瞬态后 ~25ms
// —— 撞击的低频共振本就晚于高频瞬态，但晚过 40ms 会听成两下
const BELLY = {
  medium: [['f_2__01',60],['f_2__02',60],['f_2__03',40]],
  heavy:  [['f_3__01',60],['f_3__02',60],['f_3__03',100]],
  lethal: [['f_3__01',60],['f_3__02',60],['f_3__03',100]],
};
// 目标 <250Hz：light -22(不动) / medium -21 / heavy -19.5 / lethal -18 —— 单调递增
const GAIN = { medium: 7, heavy: 10, lethal: 11 };


for (const tier of ['medium','heavy','lethal']) {
  for (let v = 1; v <= 9; v++) {
    const base = v === 1 ? `piece-impact-${tier}` : `piece-impact-${tier}-${v}`;
    const src = `${SFX}/${base}.ogg`;
    if (!existsSync(src)) { console.log(`  跳过 ${base}（源不存在）`); continue; }
    const [bf, pk] = BELLY[tier][(v - 1) % 3];
    const st = Math.max(0, (pk - 10) / 1000);
    const out = `${OUT}/${base}.ogg`;
    const chain = (extra) =>
      ff([ '-i', src, '-i', `atoms/belly__hand__hit_dull__${bf}.wav`,
        '-filter_complex',
        `[1:a]atrim=${st.toFixed(3)}:${(st+0.28).toFixed(3)},asetpts=N/SR/TB,lowpass=f=300,`
        + `volume=${GAIN[tier]}dB,afade=t=out:st=0.20:d=0.08,adelay=15|15[b];`
        + `[0:a][b]amix=inputs=2:normalize=0,asetpts=N/SR/TB,volume=${extra.toFixed(2)}dB,alimiter=limit=0.94[o]`,
        '-map','[o]','-ar','48000','-ac','1','-c:a','libvorbis','-q:a','5', out ]);
    const before = measureRms(src);
    chain(0);
    // 加低频会抬 LUFS。用 volume 精确补回 -14（不再压缩——原素材已经压过一轮，
    // 二次压缩会把好不容易加进去的低频动态又拍平）
    const mixed = measureRms(out);
    const corr = (before == null || mixed == null) ? 0 : before - mixed;
    if (Math.abs(corr) > 0.3) chain(corr);
    console.log(`  ${base.padEnd(24)} belly ${bf}  RMS ${before?.toFixed(1)} → ${mixed?.toFixed(1)} → ${measureRms(out)?.toFixed(1)} (补 ${corr.toFixed(1)}dB)`);
  }
}
