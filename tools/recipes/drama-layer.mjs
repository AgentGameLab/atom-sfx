#!/usr/bin/env node
/**
 * 配方：棋门遁甲的戏剧层（锣 / 钹 / 筝 / 举盾落定鼓）
 *
 *   node tools/recipes/drama-layer.mjs <输出目录>
 *
 * 戏剧层 = 不对应任何物理事件的那一层，给的是"这一下很重要"的标记和文化质感。
 * 它跟物理层（atoms/ 那套）的判据是反的，别拿物理层的规矩套：
 *   - 可以带余韵和房间 —— 它在叙事空间里，不在场景的物理空间里
 *   - 素材来自外部 CC0 采样库（library/vcsl/），不是自录
 *
 * 底座是 tools/ffkit.mjs —— 采样率归一 / 支路落盘验 NaN / 电平测量驱动都在那儿。
 *
 * ⚠️ **vcsl 全是 44.1kHz，锣钹鼓还是立体声**。`conv()` 先转 48k 单声道，
 *    所以 `semi()` 的基准也跟着从 44100 换成 **48000** —— 变调量依赖输入采样率，
 *    转完不改基准就是移了整整一个 8 度还差一点（docs/composition.md 十二，
 *    劫线就是栽在这条上）。转换本身不改音高，改的是"这个常数该写多少"。
 *
 * 四档映射（小天 2026-08-16 听审定）：
 *   light/medium  筝     丝弦    有音高、短
 *   heavy         钹     薄金属  炸开、无明确音高
 *   lethal        锣     厚金属  轰鸣、长余韵
 * 材质递进对应伤害递进。锣只给 lethal —— 它是"终结"的语义，用在普通命中会通胀。
 *
 * ── 两条踩过的坑 ──
 *
 * 1. 要不要时间错开，取决于**频段撞不撞**，不是一刀切
 *      筝在 300-600Hz 跟木头撞车（只差 3dB），必须延后 100ms 让木头的瞬态先出来
 *      钹在 >5k，跟木头不撞，就**必须对齐**——两个瞬态挨得近才融合成"一下"，
 *      错开反而听成两下。（实测：钹加 100ms 延迟后小天当场听出是两下）
 *
 * 2. 有音高的乐器必须先查 BGM 的调
 *      本作 BGM 是 D 调（battle/boss）和 G 调（battle-2/3）。Dan Tranh 原始调弦是
 *      B 大调五声（B C# D# F# G#），跟这两个调**一个音都不重合**。
 *      移调后取 D 大调五声（D E F# A B）—— 在 D 调是本调，在 G 调也全落在音阶内。
 *      移动量最多 1 个半音，asetrate 对音色的改变可以忽略。
 *      查调的工具：Goertzel 扫 12 半音求 chroma，见 git 历史里的 chroma.mjs。
 *
 * ── 响度：老版写死增益，现在是逐条实测目标 ──────────────────
 * 老版每条自己填 `volume=xx dB`，成品响度是**算出来才知道**的。现在 `ship()`
 * 收敛到写在下面的目标值，这些值就是交付版（已听审）的实测 LUFS：
 *   锣 -21.9 / 钹 -23.1 / 筝 -26.0~-29.9 / 举盾 -18.0
 * 两处要注意：
 *   - 钹两条老版是**不同增益、同一目标响度**（它们是候选不是力度轴），迁移后
 *     两条都写 -23.1，这个意图现在是直接写在代码里的，不再靠手算增益。
 *   - 六条筝老版是**同一个增益**（9.5dB），于是成品 LUFS 散在 -26.0 到 -29.9，
 *     差了 4dB。这里逐条写死实测值**保交付版原样**；要不要按"变体池"的规矩
 *     统一成同响度，是重新听审的事，不在迁移范围内。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/drama-layer.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('drama-layer');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const L = (f, alias) => K.conv(join(ROOT, 'library', 'vcsl', f), alias);
const A = (f, alias) => K.conv(join(ROOT, 'atoms', f), alias);

// 戏剧层统一的"房间"。物理层禁止这么做，这里是刻意的
const ROOM = 'aecho=0.9:0.75:60|130|220:0.30|0.18|0.10';
const ROOM_SHORT = 'aecho=0.9:0.75:60|130:0.25|0.14';
/** 变调量。**基准必须是 conv() 之后的 48000**，见文件头 */
const semi = (n) => (48000 * Math.pow(2, n / 12)).toFixed(3);
/** 这批全是纯乐器采样，老版没有压缩器，迁移不给它们加 */
const flat = { comp: 'anull' };

// ── 致命一击：锣 ──────────────────────────────────────────
// atrim 从 0.025 起 = 把峰从 60ms 提到 20ms，跟 piece-impact 的 5ms 瞬态融合。
// 2.2s 截断：原采样 27s，衰减到 2s 时已 -12dB，fade 收尾听不出被切。
K.ship(K.level(K.br(L('gong_fff.wav', 'gong'),
  'atrim=0.025:2.225,asetpts=N/SR/TB,afade=t=out:st=1.6:d=0.6', 'gong', { db: 0 }), 'gong', flat),
  OUT, 'lethal-gong.ogg', '锣 · 厚金属长余韵', -21.9);

// ── 重击：钹 ──────────────────────────────────────────────
// 不加 adelay（见坑 2）。highshelf 削 4dB 防刺。两档做变体池，
// 同一目标响度而不是同一增益 —— 它们是候选不是力度轴。
for (const [src, alias, name] of [
  ['cymbal_mf.wav', 'cym_mf', 'heavy-cymbal'],
  ['cymbal_mp.wav', 'cym_mp', 'heavy-cymbal-2'],
]) {
  K.ship(K.level(K.br(L(src, alias),
    'atrim=0:1.25,asetpts=N/SR/TB,highshelf=g=-4:f=6000,'
    + `afade=t=out:st=0.75:d=0.5,${ROOM_SHORT}`, alias, { db: 0 }), alias, flat),
    OUT, `${name}.ogg`, '钹 · 薄金属炸开', -23.1);
}

// ── 普通命中：筝 ──────────────────────────────────────────
// 半音数是移调量：D#→E、G#→A 各 +1，其余原样。
// adelay=100 给木头让路（见坑 1）；300-600Hz 只让了 1.6dB —— 不能再多，B4 基频就在那。
// 玩家打人用协和音（A B G#），挨打用不协和（D+E 大二度 / D / F#）—— 小天定的分组：
// 三全音 G# 给了 attack 而不是 hurt，因为它在金属乐里是"侵略性"不是"恐惧"。
const zheng = (src, n, name, lufs) => {
  const alias = name.replace('-', '_');
  K.ship(K.level(K.mix([
    K.br(L(src, `z_${alias}`), `asetrate=${semi(n)},aresample=48000,atrim=0:0.7,asetpts=N/SR/TB,`
      + 'afade=t=out:st=0.45:d=0.25', alias, { db: 0 }),
  ], `${ROOM},highshelf=g=-2:f=4000,adelay=100,asetpts=N/SR/TB`, alias), alias, flat),
    OUT, `${name}.ogg`, '筝 · 丝弦', lufs);
};
zheng('zheng_G#3_f.wav', 1, 'attack-A', -29.3);   // G#4 +1 → A4
zheng('zheng_B3_f.wav', 0, 'attack-B', -29.9);
zheng('zheng_G#3_f.wav', 0, 'attack-Gs', -26.0);  // 三全音，不移调
zheng('zheng_C#3_f.wav', 0, 'hurt-D', -27.6);     // 文件名 C#3，实测就是 D4
zheng('zheng_F#3_f.wav', 0, 'hurt-Fs', -28.0);
// hurt-DE：D 和 E 同时响 = 大二度，最刺耳的音程之一。单音编码不了"难听"，得靠音程
K.ship(K.level(K.mix([
  K.br(L('zheng_C#3_f.wav', 'z_de_d'), 'atrim=0:0.7,asetpts=N/SR/TB,afade=t=out:st=0.45:d=0.25',
    'de_d', { db: 0 }),
  K.br(L('zheng_D#3_f.wav', 'z_de_e'), `asetrate=${semi(1)},aresample=48000,atrim=0:0.7,asetpts=N/SR/TB,`
    + 'afade=t=out:st=0.45:d=0.25', 'de_e', { db: -0.7 }),
], `${ROOM},highshelf=g=-2:f=4000,adelay=100,asetpts=N/SR/TB`, 'hurt_de'), 'hurt_de', flat),
  OUT, 'hurt-DE.ogg', '筝 · 大二度（D+E）', -26.9);

// ── 举盾：聚拢 + 落定 ──────────────────────────────────────
// 两段式（composition.md 第四条）：倒放的金属给渐强（聚拢），鼓给成型（落定）。
// 只有渐强没有收尾 = "还在充能"，有了收尾才是"已经立住"。
// 前奏跟收尾的差是听审调出来的：一开始前奏比收尾低 22.9dB 基本听不见；
// 现役老版两段只差 2.1dB。现在差 7.4dB —— 有层次又听得见。
// 金属正放垫在鼓下面：纯鼓听着像打鼓不像举盾，盾是金属的，那点泛音是身份。
// 老版必须写成两步（先出 wav 再降增益编码），否则 limiter 在不同电平上削的量
// 不一样，peak 会顶到 0.1dB；ffkit 的 level()+ship() 本来就是分开两步，
// 这个坑自动没了。整族同一目标响度，不各自归一。
// preDb/ringDb 逐条实测：老版三层都写死增益（16/14/-8），但两个鼓的原始电平差
// 3.6dB —— 同样的常数在两条上是**两个配比**。归一之后这件事才看得见。
//
// ⚠️ 换算时要补 3dB：老版用 `pan=mono|c0=0.5*c0+0.5*c1` 手动缩混，`conv()` 走
// ffmpeg 默认矩阵（每声道 0.7071），同一条立体声素材**默认矩阵响 3.01dB**。
// 鼓是立体声、金属两层是单声道 atom，所以这 3dB 只落在它们之间的配比上。
// 漏了的实测后果：前奏比落定低 3dB，「聚拢」那半段整个退到听不见。
for (const [drum, dAlias, name, preDb, ringDb] of [
  ['drum_bass.wav', 'd_bass', 'block-raise', -4.2, -11.3],
  ['drum_frame.wav', 'd_frame', 'block-raise-2', -0.6, -7.7],
]) {
  K.ship(K.level(K.mix([
    K.br(A('metal_board2__piece_drop__r_center__01.wav', `${dAlias}_m1`),
      'areverse,atrim=0:0.28,asetpts=N/SR/TB,afade=t=in:st=0:d=0.16', `${dAlias}_pre`, { db: preDb }),
    K.br(L(drum, dAlias), 'atrim=0:0.9,asetpts=N/SR/TB,afade=t=out:st=0.5:d=0.4,adelay=260',
      `${dAlias}_drum`, { db: 0 }),
    K.br(A('metal_board2__piece_drop__r_center__02.wav', `${dAlias}_m2`),
      'adelay=262', `${dAlias}_ring`, { db: ringDb }),
  ], 'atrim=0:1.1', dAlias), dAlias, flat),
    OUT, `${name}.ogg`, '举盾 · 聚拢 + 落定', -18.0);
}

console.log(`\n写出 11 个到 ${OUT}`);   // 老版这行写的是 12，实际一直是 11 条
console.log('  lethal-gong / heavy-cymbal ×2 / attack-A·B·Gs / hurt-D·DE·Fs / block-raise ×2');
console.log('响度已在配方内定死（ship 收敛到各自目标），不要再跑 normalize-loudness ——');
console.log('  各档的相对关系是听审定的：锣 -21.9 / 钹 -23.1 / 筝 -26~-30 / 举盾 -18.0');
