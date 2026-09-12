#!/usr/bin/env node
/**
 * 配方：案上放物 —— artifact-get + treasure-open（开匣）
 *
 *   node tools/recipes/desk-objects.mjs <输出目录>
 *
 * 底座 tools/ffkit.mjs。物理层全在 atoms/；戏剧层用 library/vcsl（CC0）。
 * canon：qimen-dunjia/docs/design/sound-design-paper-wood-0906.md §1「暗铜／暗玉法宝件」：
 * 它们是**放在案上的小件**，响的是「木案被放上一件东西」，不是它自己在鸣。
 * **禁**唤醒、共鸣、渐亮。
 *
 * ── 现役是什么 ─────────────────────────────────────────────
 * 0722 Suno，提示词原文 *Ancient bronze ritual artifact awakening, low resonant hum
 * swelling into a bright mystical chime*——9.84s，ring 3850 @1137Hz。整条非战斗库
 * 里唯一一条「按被抛弃的那套美术写的」音效。
 *
 * ── 结构：一件硬的小东西放到木案上，然后筝扫一下 ─────────────
 *   0ms   案受一记：chessboard knock r_center（棋子敲盘 = 硬物落木，库里最贴的）
 *   0ms   物件自身的硬：stone_slab f1 只取 60ms、高通 800 —— 陶/玉/暗铜都是硬而哑，
 *         要的是那一下「咔」，不要石板的身体
 *   40ms  筝上行刮奏（戏剧层）：VCSL Dan Tranh Gliss_Up_Med_ff，atempo 1.6 保音高
 *         压到 0.47s 到顶。真手扫十几根弦原速要 0.75s，原速版像仪式，快版像反馈
 *   90ms  放稳：seal 软压，手离开
 * 0.76s 收干。artifact-get 在 artifactGained 后延 150ms 播（audio.ts 07-14 错峰）。
 *
 * ── 听审记录（小天 0906）─────────────────────────────────────
 * 五条 A/B：纯物理 / 筝单音 D4 / 五根本地筝音拼的扫弦 / 真刮奏原速 / 真刮奏 ×1.6。
 * **选真刮奏 ×1.6**。物理层先响、40ms 后弦才起——先有东西落下，再有它的分量；
 * 弦是戏剧层不是法宝在鸣，canon「禁共鸣」写的是法宝自己。拼扫弦输给真刮奏的
 * 地方在密度：五根弦听得出是五下，十几根弦才是「扫」。
 *
 * ── 响度 ───────────────────────────────────────────────────
 * 过场件档 −19（现役 −15.1 是 9 秒 chime 拉的）。两条变体换物理层的 take，弦不换。
 *
 * ════ treasure-open（开匣）0912 ═══════════════════════════════
 * 0906 审计把它当零消费者删了（宝箱 hook 从未接）；0911 别人把 hook 接上，顺手
 * 用 `git checkout` 把**删之前那条 0722 Suno 原件**恢复回来了（md5 逐字节相同）。
 * 读数 4.52s · atk 420ms · <250Hz 主导 —— 旧美术那套的长闷响又回到线上。
 *
 * 画面（`public/art/ui/treasure-0907/chest-open.webp`）：厚木匣，木轴木榫，正面
 * 一枚朱砂印，**一件金属件都没有**。canon §2「案上放物」那一行本来就管着它。
 * 所以开匣 = 三段木：
 *   84ms  前导静音 —— **不是设计，是旧素材的固有静音**（0911 的 CHEST-SFX-0911b
 *         把 openSfxLeadMs 钉成 84 并写了断言）。新素材原样保留这段静音，
 *         接线与断言零改动；要去掉得连那条常量和 treasure-reveal-test 一起改，
 *         那是别人 0911 的合同，不在本次范围。
 *   0ms   盖子松动：blade_wood 慢刮，低通 2.5k —— 木轴转动的干涩，不是金属铰链
 *   60ms  掀起来的行程：cardboard 纤维拖擦，低通 1.8k，压到 −10（过程不是事件）
 *   210ms 盖靠到后板：wood_block f2 一记闷木 —— 这一下是整条唯一的「事件」
 *   250ms 匣内垫的纸：paper 高通 1.2k，−16，一点窸窣
 * 0.72s 收干。−19 与 artifact-get 同档（开盖是过场，获得声才是重音）。
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../ffkit.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('用法：node tools/recipes/desk-objects.mjs <输出目录>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const K = kit('desk-objects');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = (f, alias) => K.conv(join(ROOT, 'atoms', `${f}.wav`), alias);
const L = (f, alias) => K.conv(join(ROOT, 'library', 'vcsl', f), alias);   // 44.1k，必须 conv
const SLOW = 'acompressor=threshold=-24dB:ratio=2.5:attack=20:release=120';

const knock = (r, f, i) => A(`chessboard__knock__r_${r}__f${f}__0${i}`, `knock_${r}${f}${i}`);
const stone = (f, i) => A(`stone_slab__piece_drop__damp_dry__f${f}__0${i}`, `stone${f}${i}`);
const seal = (f, i) => A(`seal__press__f${f}__0${i}`, `seal${f}${i}`);
const blk = (f, i) => A(`wood_block__strike__f${f}__0${i}`, `blk${f}${i}`);
const glissFF = L('zheng_gliss_up_med_ff.wav', 'gliss_ff');

// 物理层：案 + 硬 + 木的第二模态 + 放稳
const physical = (n, { ki, si, bi }) => [
  K.br(knock('center', 2, ki), 'atrim=0:0.22,asetpts=N/SR/TB,lowpass=f=3000,afade=t=out:st=0.12:d=0.10', `a_desk${n}`, { db: 0 }),
  K.br(stone(1, si), 'atrim=0.01:0.08,asetpts=N/SR/TB,highpass=f=800,afade=t=out:st=0.03:d=0.04', `a_hard${n}`, { db: -6 }),
  K.br(blk(1, bi), 'atrim=0:0.08,asetpts=N/SR/TB,afade=t=out:st=0.04:d=0.04', `a_wood${n}`, { db: -12 }),
  K.br(seal(1, 1), 'atrim=0:0.14,asetpts=N/SR/TB,lowpass=f=2000,afade=t=out:st=0.08:d=0.06,adelay=90', `a_settle${n}`, { db: -8 }),
];
// 戏剧层：刮奏 0.30→1.45s 那段（起→峰→衰），×1.6 速
const gliss = (n) => K.br(glissFF, 'atrim=0.30:1.45,asetpts=N/SR/TB,atempo=1.6,'
  + 'afade=t=in:st=0:d=0.03,afade=t=out:st=0.50:d=0.22,adelay=40', `a_gliss${n}`, { db: -8 });

[{ ki: 1, si: 1, bi: 1 }, { ki: 2, si: 3, bi: 2 }].forEach((p, n) => {
  const file = n === 0 ? 'artifact-get.ogg' : `artifact-get-${n + 1}.ogg`;
  K.ship(K.level(K.mix([...physical(n, p), gliss(n)],
    'atrim=0:0.80,afade=t=out:st=0.68:d=0.12', `artifact${n}`), `artifact${n}`, { comp: SLOW }),
    OUT, file, `artifact ← knock c-f2-${p.ki} + stone f1-${p.si} + 刮奏 ×1.6`, -19);
});

// ═══ treasure-open ×1：开匣（木轴 → 行程 → 盖靠住 → 匣内纸）═══════
const LEAD = 78;   // 前导静音：0911 合同 openSfxLeadMs=84 说的是「素材固有静音」实测 83.5ms。
// adelay 78 + 起音淡入 + ogg 编码器的余量，实测落在 83–84ms（下面每次改都要用
// silencedetect=noise=-60dB 复量一遍；差一帧以内不影响，差多了开盖帧就对不上）。
const scrape = (s, i) => A(`blade_wood__scrape__spd${s}__0${i}`, `bw${s}${i}`);
const pull = (s, i) => A(`cardboard__pull_out__spd${s}__0${i}`, `pull${s}${i}`);
const paper = (i) => A(`paper__flatten__0${i}`, `paper${i}`);
K.ship(K.level(K.mix([
  K.br(scrape(1, 1), `atrim=0:0.20,asetpts=N/SR/TB,lowpass=f=2500,afade=t=in:st=0:d=0.01,afade=t=out:st=0.12:d=0.08,adelay=${LEAD}`, 'tr_hinge', { db: 0, dense: true }),
  K.br(pull(2, 2), `atrim=0.05:0.32,asetpts=N/SR/TB,lowpass=f=1800,highpass=f=200,afade=t=in:st=0:d=0.02,afade=t=out:st=0.17:d=0.10,adelay=${LEAD + 60}`, 'tr_travel', { db: -10, dense: true }),
  K.br(blk(2, 1), `atrim=0:0.22,asetpts=N/SR/TB,lowpass=f=3200,afade=t=out:st=0.12:d=0.10,adelay=${LEAD + 210}`, 'tr_stop', { db: -2 }),
  K.br(paper(2), `atrim=0:0.24,asetpts=N/SR/TB,highpass=f=1200,afade=t=out:st=0.14:d=0.10,adelay=${LEAD + 250}`, 'tr_paper', { db: -16, dense: true }),
], 'atrim=0:0.72,afade=t=out:st=0.60:d=0.12', 'treasure'), 'treasure', { comp: SLOW }),
  OUT, 'treasure-open.ogg', '开匣 ← 木轴刮 + 行程 + 盖靠住 + 匣内纸（前导静音 84ms）', -19);

console.log('\nartifact-get ×2 + treasure-open ×1 写到 ' + OUT);
