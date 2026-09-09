# 棋门遁甲 · 纸木声核 —— 用什么做出来（2026-09-06）

> **该是什么声、怎么验**在游戏仓：`qimen-dunjia/docs/design/sound-design-paper-wood-0906.md`（材质→声音表、五载体→动作、三条判据、全库审计、优先级）。本文不复制那边的正文，只写执行侧：**现有原子能覆盖哪些、缺什么要录、配方怎么写、工单怎么排**。两边冲突以游戏仓为准。
> 起因：0901 起美术全面对齐纸／炭笔／朱砂／木片／竹片，青铜退场；音效库 0711–0730 的 Suno 批是按旧美术出的（青铜盾、玉磬、法宝铜器）。0906 全库 329 条扫过，非战斗层要换的集中在 UI 七键、事件、法宝、结算、治疗五处。

## 0. 一句话

**桌上能响的只有木、竹、纸、绳、陶、石、水和人的手；金属只有一串铜钱。**做法上等于：物理层全部从 `atoms/` 出，Sonniss 只补桌上没有的（水、门）；**戏剧层（锣钹筝）只留在命中链**，非战斗层一根钟的余韵都不许有。

## 1. 材质→原子：有什么，缺什么

| 材质（游戏仓 §1） | 现有原子 | 够不够 | 缺口（→ §2 录制清单） |
|---|---|---|---|
| 厚木（盘、案、令牌、状态牌） | `wood_block` 3×3 · `chessboard` knock 54 · `desk_padded` 27 · Sonniss `plank_drop` | 敲击够；**「压下去」没有** | #1 厚木牌压案 |
| 薄木片（符底、木筹、小木牌） | `chopstick__rub` 8 · `wood_block f1` | 摩擦够；碰撞偏「敲」不偏「片」 | #2 薄木片互碰、落桌 |
| 枣木珠 | — | **零** | #4 木珠 |
| 毛竹（简、签） | — | **零** | #3 竹简摊卷、#2 竹签 |
| 楮皮纸 | `paper__flatten` 3 · `scroll__unroll` 3 · `playing_card` draw 11 / shuffle 8 · `cardboard` 14 | 有，但 playing_card 是扑克（涂层纸，太脆），cardboard 太厚 | #6 厚韧纸抽／翻／展／拍 |
| 麻绳 | — | 零，低优先 | — |
| 粗陶（投筹碗） | `ceramic_plate` 9（瓷，太亮） | 不够 | #5 木筹投陶碗 |
| 青石 | `stone_slab__piece_drop` 20 | 够 | — |
| 真水 | `water_trickle` 2 · Sonniss 门水精选 | 够 | — |
| 朱砂·笔 | — | **零** | #7 毛笔划纸／木 |
| 朱砂·印 | `seal__press` 7 | 够 | — |
| 铜钱 | — | 零；现役 Suno `shop-buy` 待听审，若过则不录 | （#9 可选）钱串落案 |
| 法宝小件放案 | 用厚木＋薄木片合成 | 勉强 | #8 小木匣／木盖放案 |
| 空心木（敌子入场「空心一记」，若入范围） | — | 零 | #10 竹筒／空木盒 |
| 木楔（门星解锁、钉纸条） | — | 零 | #11 木楔入木 |

## 2. 录制清单（给小天，按工单顺序）

> **0906 晚已录三件**（`D:/Music/音效录制/`，切进 `atoms/`，各 `map-*.json` 与 `split-report-*.json` 同目录）：
> #1 厚木牌压案 → `wood_tag__press__f1–f3` 各 3（marker 分档，峰 −18/−11/−8 单调；⚠ 桌面有一根 2.07kHz 模态三档九条全在，配方里 `bandreject=f=2070` 掐掉）→ 已换进 `ui-click` / `ui-confirm` / `score-card` 的芯；**`score-total` 试过两版都不加**（压的能量在 250Hz 以下，K 加权不认，只吃峰值余量，见 score-wood.mjs 注）。
> #5 木筹投陶碗 → `clay_bowl__chip_toss__v1` ×9（短的 04/07/09 是一枚，长的 01/02/05/06 是几枚在碗里滚；陶模态 2.3k ring 100–150，合法）→ 新做 `score-subtotal`（一枚）/ `score-mult`（几枚）。
> 竹节 → `bamboo_node__scrape__v1` ×12（小天追认「刮过那个竹节的感觉」：多数是快刮 90–170ms，07/08 是慢刮）→ 先出 `ui-toggle-bamboo` A/B，正式归属等竹签/竹简件有动作时再定；慢刮那两条以后给「卷简」用正合适。

录法照 `recording-guide.md`：干、近、截瞬态、每件三档力度各 ≥5 次、档间打 marker；文件名按 `schema.md` 采集侧命名，用途不进名字。**每件录完先跑 `material-scan`，ring 超 150 的当场换物件**——比如陶碗要挑哑的，瓷碗一敲就是 400ms 的峰。

| # | 物件·手法 | 轴 | 服务的键 | 提示 |
|---|---|---|---|---|
| 1 | **厚木牌压木案**（2cm 厚小木牌，按下／放下） | f1–f3 | `ui-confirm` `ui-click` `score-total` `score-card` | 要的是「压」不是「敲」：手不离牌，牌不弹起。结束回合令牌是甲档，这一记是全 UI 最常听的 |
| 2 | **薄木片／竹签互碰、落桌** | f1–f3 | `ui-toggle` 状态签 `poison/vulnerable/float-apply`（若入范围） | 竹比木空、亮；两种都录，混着用 |
| 3 | **竹简摊开／卷起**（没有真竹简用一排竹筷穿麻绳） | 慢／中／快 | `ui-open` `ui-close` 战斗日志 | 摊开是连串轻响，卷起是刮擦；两个方向各录 |
| 4 | **木珠串拨**（算盘或手串；算盘只借声音，canon 已否它当 UI） | 单颗／连拨三档速度 | `score-tick` `score-fill` `energy` `heal-chain` 血／气变动 | 单颗要 ≤ 80ms 干净一颗；连拨要能截出 3–8 颗 |
| 5 | **木筹投粗陶碗**（木片／木圆片投进哑陶碗） | 一枚／三枚／一把 | `score-mult` `score-subtotal` 敌方计数 | 碗要哑（陶不是瓷）；碗里已有筹和空碗各录一版 |
| 6 | **厚韧纸抽／翻／展／拍**（手头最接近楮皮纸的：厚而柔韧、未涂布的手工纸；不要复印纸、不要扑克那种涂层纸） | 慢／中／快 | 符纸层 `event-open` `event-reveal` `reward-claim` `map-node` | 皮纸的特征是**软**：不要复印纸那种脆响 |
| 7 | **炭笔划纸**（不是毛笔——小天 0906：记号是炭笔的声音）：炭条在皮纸上划短道、点一下 | 短划／点／圈 | `ui-hover`（行笔）0909 换芯为小天录的**重粗糙摩擦**（`rough_surface__rub`，频心 1.2k，比纸板纤维低两个八度——「更温和、会低一些」）；`ui-dot`（落笔）仍是纸板拼的；`map-node` 圈门 | 声音很小，近距离录；炭条要软的，硬铅笔是另一种声 |
| 8 | **小木匣／木盖放到木案**（法宝＝案上小件） | f1–f3 | `artifact-get` `treasure-open`（若复活） | 要的是「案受一记＋物件自身短模态」；不要盖子合上的机构声 |
| 9 | （可选）**钱串落案**（一串铜钱或硬币） | 轻／重 | `shop-open` `shop-buy` | 只在现役 Suno 听审不过时录 |
| 10 | （若入范围）**空心木**（竹筒／空木盒敲） | f1–f3 | `enemy-summon` 局散最后一格 | 跟 `desk_padded` 声核同力度对录，方便对比「实木 vs 空心」 |
| 11 | **木楔敲进木板** | 一记／三记 | `score-unlock` 纸条钉案 | 要有「进去了」的收束感 |

## 3. 配方规范（ffkit 约定，非战斗层）

底座 `tools/ffkit.mjs`，写法照 `tools/recipes/card-wood.mjs`（木牌卡五族是本层的样板）。逐条：

1. **48k 单声道进链**：任何外部素材先 `conv()`（composition 十二）。Sonniss 门水那批是 96k/192k。
2. **每层一个 `br()`，按有效 RMS 归一后再给 `db`**：原始素材差 20–36dB，不归一 `db` 就不是混合比。纸摩擦、碎屑这类颗粒材料加 `dense: true`；木块、木片这类稀疏瞬态**不加**（会把峰压平）。
3. **总线压缩用 `SLOW`**（attack 20ms）：木片 4ms 的起音会被默认 3ms attack 咬掉，重音就没了——card-play 那次的教训。
4. **响度目标按听感层级给**（composition 十）：交互件 −24（`ui-*`）· 过场件 −19（open / reveal / claim / artifact）· 结算件 −16（`score-*`）· 声核族 −20 附近（`piece-move` 现役参照）。`ship()` 在编码后实测收敛，够不到就如实报 shortfall，不硬 limit。
5. **时长**：交互件有效音 ≤ 0.4s、atk ≤ 30ms；过场件 ≤ 1.5s；结算件 ≤ 1.0s；`afade` 收干净，末尾不留 −60dB 的尾巴。
6. **干声**：素材自带房间的（Sonniss 常见）切到直达＋早期反射；单发件 `room` ≤ −50dB。房间归场景，不归素材（游戏仓 §4-C）。
7. **变体**：同族 ±1dB；交互件 2–3 条、结算件 3 条、过场件 1–2 条。同一素材做变体靠**换 take**不靠换增益。
8. **换素材不换键**：输出文件名沿用现役键（`ui-click.ogg` `ui-click-2.ogg`…），游戏侧零接线；变体数变了要重跑 `scripts/audio-manifest.mjs` 并同步 `release/electron-assets.json` 的 `audio` 计数。
9. **迁移守形状**：改配方不改声音的，用 `tools/compare-shape.mjs` 对交付版；改声音的，用 `tools/material-scan.mjs` 出三个数再给小天听。
10. **Sonniss 不进 git**（`library/README.md`）；VCSL（CC0）可以。自录原子进 `atoms/` 并重跑 `gen-library.mjs`。

## 4. 工单（按游戏仓 §6 优先级；层结构是起点，听审后改）

> **0906 状态**：本节工单当日全部落地（`ui-wood` / `paper-run` / `desk-objects` / `terrain-heal` / `score-wood` 五个配方，游戏仓四批提交），听审改动都记在各配方头注里——尤其 artifact-get 五条 A/B 选真刮奏 ×1.6、energy 从「珠拨一颗」改「一口气」、scroll-open 两条都取 scroll 03、score-total 目标 −15→−16。下面的层结构是**做之前**的起点，以配方为准。`heal` 小天定案不动（瓷盘点 + 水）。未做：符加皮纸层（P3）。录制清单里值最高的三条：#1 厚木牌压案（换 click/confirm/score-card/score-total 的印章替身）、#4 木珠串（换 score-fill/tick/energy 的木块替身）、#5 木筹投陶碗（score-mult/subtotal 现役还是 Suno）。

时间线单位 ms；层写法 `原子 @起点 db`。「缺」= 录制清单编号，录到之前用括号里的临时替身。

### P0-1 `ui-wood.mjs` —— UI 七键（13 文件，−24 LUFS）

| 键 | 载体·动作 | 层 | 时长 |
|---|---|---|---|
| `ui-hover` ×3 | 炭笔行笔（v3，0909） | `rough_surface__rub` 窗口 highpass 180 lowpass 4200 @0 · `air_slit` 低通 5k db −12 · `paper__flatten` 高通 2k db −14；−29 | 0.21 |
| `ui-click` ×2 | 厚木牌压案 | 缺#1（暂 `chessboard knock r_center f1` 低通 2k）@0 · `wood_block f1` @0 db −9 | 0.15 |
| `ui-confirm` ×1 | 令牌按下（甲档，比 click 重一档） | 缺#1 f2 @0 · `chessboard knock r_center f2` @4 db −6 | 0.20 |
| `ui-toggle` ×2 | 木栓拨 | `wood_block f1` @0 · `chopstick__rub` 03 截 60ms @15 db −10 | 0.12 |
| `ui-open` ×2 | 摊开竹简 | 缺#3（暂 `scroll__unroll 01` 0–350ms） · `chopstick__rub` 01 @0 db −8 | 0.40 |
| `ui-close` ×2 | 卷简 | 缺#3 反向（暂 `chopstick__rub` 07 + `cardboard pull_out spd2` 后段 db −9） | 0.35 |
| `ui-error` ×1 | 木牌卡住／空敲 | `wood_block f2` 低通 1.2k @0 · 同一条 −2 半音 @55 db −4（两记「卡了」） | 0.18 |

### P0-2 `event-open` ×3（−19）· `event-reveal` ×3（−21）

- open：缺#6 展纸（暂 `scroll__unroll 01` 0.2–0.9s，fade 0.15/0.3）@0 · `wood_block f1` @380 db −8（纸铺到案上那一下）。1.0s。
- reveal：`paper__flatten` 02 截 0.30s，highpass 400 · `chopstick__rub` 起音 @0 db −12。0.30s。

### P0-3 `artifact-get` ×1（−19，≤ 1.0s）

缺#8（暂 `plank_drop` 低通 1.5k @0）· `wood_block f2` @6 db −5 · `seal__press f2` @180 db −14（东西放稳了）。**不加任何铜／玉的鸣**——它是被放在案上，不是在醒。

### P1-1 `terrain-heal` ×3（−21.5）

现役是 `grill_rack` spd3 原子直出（0804 版；`heal` 在 0808 被 `heal.mjs` 瓷盘+水替掉了，terrain-heal 没跟上）。木面返生＝木纹变清：`chopstick__rub` 01/07 顺纹滑，第二条 +2 半音晚 90ms 叠上去做「上行」· **与 `heal` 同一条 `water_trickle`**（低通 4k，db −8）——共享层让「地块生成」和「回血」读成同一件事 · `wood_block f1` −12 极轻一记当「那一格变了」· 0.5s 收干。`heal` 本身留 P3（瓷盘点换薄木片，水不动）。

### P1-2 `score-wood.mjs` —— 结算七键（20 文件，−16）

| 键 | 载体·动作 | 层 |
|---|---|---|
| `score-tick` ×3 | 珠点亮一颗 | 缺#4 单颗（暂 `wood_block f1` 截 60ms，highpass 600） |
| `score-line-1..5` | 一行刻数 | **现役 15 条形态对，先不动**，材质听审后决定 |
| `score-card` ×3 | 木牌一记 | 缺#1 f1（暂 `chessboard knock r_mid f1`） |
| `score-mult` ×3 · `score-subtotal` ×3 | 筹落碗 | 缺#5（暂 `ceramic_plate f2` 低通 3k + `wood_block f1` @0） |
| `score-total` ×3 | 令牌落案 | 缺#1 f3（暂 `chessboard knock r_center f3` + `plank_drop` db −10） |
| `score-unlock` ×3 | 木楔入木 | 缺#11（暂 `wood_block f3` 三记 @0/70/160 递重） |
| `score-fill` ×2 | 珠串连续拨（fadable） | 缺#4 连拨（暂 `wood_block f1` 每 45ms 一颗 ×N，随机 ±8ms） |

### P1-3 零散四件

- `energy` ×1（−21）：缺#4 单颗，0.10s。
- `reward-claim` ×1（−19）：`playing_card draw 04` highpass 500 @0 · `chopstick__rub` 起音 @0 db −8（抽出一页谱）；0.35s。现役 −30.7 LUFS 太轻。
- `scroll-open` ×2（−20）：`scroll__unroll 01`（小天点名较好那段）0–1.2s；**游戏侧要接线**（现无消费者）。
- `heal-chain` ×2（−17）：缺#4 连拨 4–6 颗，@0 起每 90ms 一颗，前轻后重；0.7s。

### P2 听审后定

`map-node`（`chessboard knock f1` + `paper__flatten` 极轻 @0）· `shop-open`（现役若是钱串则留）· 状态签四件（缺#2 一记）· `enemy-die`/`spirit-dissipate` 截到 ≤ 2s。

### 若小天把 `enemy-summon` 划进范围（P0）

缺#10 空心木一记，力度对齐 `piece-move` 现役（−20 附近），0.30s。跟声核并排听：实木是你，空心是别人。

## 5. `material-scan` —— 出数不出结论

```bash
node tools/material-scan.mjs <目录或文件...> [--json] [--ring 150]
```

| 读数 | 器物层门槛 | 说明 |
|---|---|---|
| `ring` | ≤ 150ms（铜钱／陶 ≤ 250，纸 = 0） | 峰后 150ms 起，500Hz–10kHz 内同一根窄峰持续多久。木／纸／竹的尾巴是宽带噪声；钟一敲 400ms 起步 |
| `dur` / `atk` | 交互 ≤ 0.4s / ≤ 30ms；过场 ≤ 1.5s | 反馈跟不跟手 |
| `room` | 单发件 ≤ −50dB | 300–800ms 窗相对直达峰；持续型不测 |
| `tonal` | 参考 | 尾巴里 8 根最强峰占比，> 0.7 基本是有音高的东西 |

**ring 低是必要条件不是充分条件**：两块木头对敲也能有一根 800Hz 的短峰；`card-remove` 150 是木纤维断裂的模态，`gate-open` 500 是吱嘎的准周期摩擦，都合法。数字挡明显错的，结论小天听。

0906 对现役全库跑过一遍，非战斗层超门槛的：`event-open` 2300 · `artifact-get` 3850 · `heal-chain` 5150 · `score-total` 500 · `shop-open` 850 · `energy` 700 · `enemy-summon` 2750；孤儿键 `vajra-guard` 6800 · `jianzhen-on` 3400。全表在游戏仓 §5。

## 7. 入游 30 秒（0909）· 教训

配方 `tools/recipes/entry-30s.mjs`（v1）→ `entry-30s-v2.mjs`（现行）。脚本是小梦 0908 的 xiaqiuqiu.com/d/qimen-entry-audio-rtlln6za。v1 被 A梦 听成「恐怖片」，四层叠出来的：朱砂字幕、灰蓝调色、人声处理（tremolo / 低通 / 吞字 / 狼人吼 + 回声、呼吸缺席）、台词本身。声音这层是执行偏离脚本：脚本明写「六句干、真、不处理」「兽认不出种类不用狼嚎」「声像后半球」「他自己四样声音正中」，v1 一条都没守住。**口头局部要求（「老人加点效果」）撞书面总设计时，先把脚本那条摆出来 flag，再做。**

v2 守回来的：兽 = 公有领域麋鹿 bugle + bellow 两方向共振峰偏移（`library/commons-pd/`）；人声一律 anull（小天缩混已分声线）；风三段不相关 + Haas 阵头（⚠ Eye Of The Storm 是 30s loop，偏移避开 30 的倍数，否则 corr 0.65 假立体声）；兽回声左右拆 700/830ms；人声越走越远（近路→远路交叉淡 + 整体压）；山谷 = 每声道两下离散暗反射过短抽头扩散器（反馈梳被听成「脑海里的声音」；本机 ffmpeg 的 afir 卷积出零，别指望它）；时间轴对实际画面（20.0 手到门环，人声 19.6 前退光）；抓环后兽收、风 −8、门原声留。
