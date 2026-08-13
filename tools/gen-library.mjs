#!/usr/bin/env node
/**
 * gen-library.mjs —— 扫 atoms/ 生成素材库索引 docs/library.md
 *
 * 元数据来源有两处，都不需要额外维护：
 *   - 文件名：<source>__<technique>__<轴>...__<variant>.wav
 *   - 同目录的 map JSON：source / technique / note
 * 所以只要按规范切分入库，索引就是自动的。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2] ?? 'atoms';
const OUT = process.argv[3] ?? 'docs/library.md';

const files = readdirSync(SRC);
const wavs = files.filter((f) => f.toLowerCase().endsWith('.wav'));

// 收集 map JSON 的 note。文件名历史上有 map-x.json / x-map.json 两种，都认
const meta = {};
for (const f of files.filter((f) => f.endsWith('.json') && f.includes('map'))) {
  try {
    const m = JSON.parse(readFileSync(join(SRC, f), 'utf8'));
    if (!m.source) continue;
    meta[m.source] ??= { notes: [] };
    // 数**非 skip** 的组：补录批次会用 skip 占位把长度撑到跟主批次一样
    const live = (m.groups ?? []).filter((g) => !g.skip).length;
    if (m.note) meta[m.source].notes.push({ text: m.note, groups: live });
  } catch {
    /* 坏 JSON 跳过，不阻塞索引生成 */
  }
}

const bySrc = {};
for (const w of wavs) {
  const m = /^(.+?)__(.+)__(\d+)\.wav$/.exec(w);
  if (!m) continue;
  const [, src, mid] = m;
  const parts = mid.split('__');
  // technique 永远是第一段（命名规范 <source>__<technique>__<轴>...）。
  // 不能靠"含不含下划线"判——piece_drop / wood_slide 这类手法本身就有下划线
  const [tech, ...axes] = parts;
  bySrc[src] ??= { n: 0, techs: new Set(), coords: new Set() };
  bySrc[src].n++;
  bySrc[src].techs.add(tech);
  if (axes.length) bySrc[src].coords.add(axes.join(' '));
}

const rows = Object.entries(bySrc).sort((a, b) => b[1].n - a[1].n);
const noteOf = (src) => {
  const ns = meta[src]?.notes ?? [];
  // 按 groups 数取主批次，同数取更长的
  return ns.sort((a, b) => b.groups - a.groups || b.text.length - a.text.length)[0]?.text ?? '';
};

let md = `# 素材库索引

> 自动生成：\`node tools/gen-library.mjs\`。改了 \`atoms/\` 就重跑。
> 共 **${wavs.length}** 个原子 / **${rows.length}** 个 source。

文件名即元数据：\`<source>__<technique>__<轴>...__<variant>.wav\`。
轴的取值来自录制时的受控变量（力度 / 落点 / 速度 / 材质状态…），命名规范见 [schema.md](schema.md)。

| source | technique | 轴坐标 | 数量 | 来历 |
|---|---|---|---|---|
`;
for (const [src, d] of rows) {
  const note = noteOf(src).replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 90);
  const cs = [...d.coords];
  const coords = cs.slice(0, 3).join(' · ') || '—';
  md += `| \`${src}\` | ${[...d.techs].join(' / ')} | ${coords}${cs.length > 3 ? ` …共 ${cs.length}` : ''} | ${d.n} | ${note} |\n`;
}
md += `
## 怎么用

\`\`\`bash
# 单源归一渲染
atom-mix --mode direct --src atoms/ --family <source> --def-id <目标id>

# 两层合成（瞬态 + 共振）
atom-mix --mode layered --src atoms/ --contact <source A> --body <source B> \\
  --pair-axis f --body-axis r=center --body-gain -10 --body-delay 4 --def-id <目标id>
\`\`\`

合成时的取舍见 [composition.md](composition.md)。
`;

writeFileSync(OUT, md);
console.log(`写出 ${OUT}：${rows.length} 个 source / ${wavs.length} 个原子`);
