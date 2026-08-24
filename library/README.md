# library/ —— 外部素材

跟 `atoms/` 是两类东西，别混：

| | `atoms/` | `library/` |
|---|---|---|
| 来源 | 自己录的，同一条信号链 | 外部 CC0 采样库 |
| 用途 | **物理层** —— 对应真实发生的事 | **戏剧层** —— 不对应任何物理事件 |
| 干湿 | 必须干（截瞬态、去房间） | **可以带余韵** |
| 判据 | 受控变量、族内 σ < 2dB | 许可证 + velocity 分层 |

戏剧层为什么可以带房间：它不在场景的物理空间里，在叙事空间里——跟电影配乐不需要匹配画面混响是一回事。物理层那套"必须干、只截瞬态"的要求对它不适用。

## 找新素材去哪 —— 按顺序找，找到就停

不是所有音效都进这个仓，但每次都得判**这一条要什么等级的许可证**：

|  | 进 git（这个仓 / `library/`） | 只嵌进成品（放 `E:/SoundLibrary/`） |
|---|---|---|
| 谁能看到源文件 | 任何 fork / clone 的人 | 只有小天本机 + NAS |
| 许可证门槛 | **必须 CC0**（否则等于再分发别人的素材） | 只要"可商用"就行 |

按这个门槛，找新素材的顺序：

1. **Pixabay**（pixabay.com/sound-effects）—— 自定义许可证但**实操等于 CC0**：可商用、可修改、**无需署名**、无需注册。**没有再分发限制，可以进 git**（本库 `library/` 目前没有 Pixabay 素材，但语义上允许）。品类偏 UI / 环境音 / 简单 foley，专业录音师上传较少
2. **Freesound.org 勾 CC0 filter** —— 品类最全，field recorder 上传的高质量原始素材一堆。**需要免费账号**才能下载。CC0 只占少数，好东西经常卡在 CC BY 上
3. **Freesound.org CC BY 4.0** —— 可商用可修改，**必须署名**（作者名 + 标题 + 许可证名和链接 + 原素材链接）。用它就**从下载那一刻同步写进 `library/THIRD-PARTY-NOTICES.md`**，别攒到发布前补，那时候多半找不到出处
4. **Sonniss GDC 系列**（`E:/SoundLibrary/`）—— 最深最专业。禁 raw 再分发所以**不进 git**，成品里嵌无问题。见下面 §sonniss-gdc-2026

**下载时的许可证锁定当时的条款**，站方后来改条款只影响新下载。所以下时截图 / 存 URL / 记许可证名，比事后追溯稳。

## vcsl/ —— Versilian Community Sample Library

CC0-1.0（公有领域）。原文：*"you can do whatever you want with these sounds (even make commercial software), no royalties, no credit, no special terms."* 商用无需署名，是许可证上最干净的一档。

来源：https://github.com/sgossner/VCSL

这里只放**实际用到的**九个，整库有几个 GB，按需拉：

```bash
gh api -H "Accept: application/vnd.github.raw" \
  "repos/sgossner/VCSL/contents/<路径>" > library/vcsl/<名字>.wav
```

⚠️ 路径里的 `#` 要编码成 `%23`（`C#3_f_1.wav` → `C%233_f_1.wav`），否则被当 URL fragment 截断。

| 文件 | VCSL 路径 | 用在 |
|---|---|---|
| `gong_fff.wav` | `Idiophones/Struck Idiophones/Gong 1/` | 致命一击 |
| `cymbal_mf.wav` `cymbal_mp.wav` | `Idiophones/Struck Idiophones/Clash Cymbals 1/` | 重击 |
| `drum_bass.wav` | `Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v5_rr1_Sum.wav` | 举盾落定 |
| `drum_frame.wav` | `Membranophones/Struck Membranophones/Frame Drum/HDrumL_Hit_v3_rr1_Sum.wav` | 举盾落定（变体二） |
| `zheng_*.wav` | `Chordophones/Zithers/Dan Tranh/Normal/` | 普通命中 |

### 没拉但值得知道的

- **Gong 1 的另外四档**（`p` / `mp` / `mf` / `f`）—— 完整力度轴，见下面「锣的力度轴」
- **Dan Tranh/Gliss** —— 上行/下行刮奏 × 慢/中/涌 × mf/ff，语义现成（上行=增益，下行=debuff）
- **Dan Tranh/Tremolo** —— 轮指，但那是**持续**的语义，当一击用会觉得开头突兀
- `Suspended Cymbal 1/cresc_*` —— 1.5/2/4/7.5 秒的渐强，适合蓄力不适合打击
- `Clash Cymbals 2`、`Gong 2` —— 另一副钹/另一面锣，音色另一套

### 锣的力度轴（本库见过最极端的样本）

```
        <250Hz   250-2k    2k-6k     >6k     倾斜
p        -43.3    -51.4    -84.6   -103.5   -60.2
mf       -37.9    -39.9    -62.3    -81.9   -44.0
fff      -41.0    -33.0    -42.8    -56.5   -15.5
```

**低频几乎不涨（−43.3 → −41.0），高频涨了 47dB。** 木头那次是 +18.5 / +10，锣直接拉到 47 : 0。物理上：轻敲只激发基频模态，重敲把大量高阶模态非线性地激发出来——轻敲的锣（>6k 只有 −103.5）根本是一团纯低频嗡鸣，跟重敲是两件乐器。

所以这条轴该按**伤害档位**映射，而且换档时不要去调增益：`heavy` 一开始用 `mf` 觉得弱，正确的修法是换 `f` 档而不是给 `mf` 加 dB——加增益会把力度轴压平（见 composition.md 第九条）。

## sonniss-gdc-2026 —— GDC Game Audio Bundle

**素材不在本仓**（7.4GB）。完整索引在 [sonniss-gdc-2026-index.md](sonniss-gdc-2026-index.md)，347 个文件名可以直接 grep。

| 在哪 | 路径 |
|---|---|
| 本地解压版 | `E:/SoundLibrary/sonniss-gdc-2026/` |
| NAS 原始 zip | `sound-library/sonniss-gdc-2026/`（5 个分卷 + INDEX.md） |
| 官方 | https://gdc.sonniss.com/ |

许可证：royalty-free 可商用、无需付费或署名。**禁 raw 再分发**（只能作为成品游戏的一部分）、**禁 AI/ML 训练**。

形态：**每个厂商 3-4 个代表作的样品集**，不是完整库（347 文件 / 122 厂商）。都是单个音效不是合集，规格很高（96kHz / 192kHz，部分立体声），拿来用要降到 48k 单声道。

跟本项目缺口对得上的（按文件名，未逐个试听）：

| 缺口 | 命中 |
|---|---|
| 敌人起手叫声 | `SoundBits - Vox Bestiae - Source Elements`（人形/虫类/幽灵/水生的 exhale 与 tremble attack）· `Epic Stock Media - Humanoid Creatures Vol 4`（兽人蓄力攻击、海兽长嚎）· `ANMLRept_Large Herbivore Roar`（大型草食恐龙，可当奔彘） |
| 木质战斗 | `344 Audio - Medieval Weapons Vol 2` 的 `WEAPBlnt_Spear And Stick Impact, Wooden` · `WOODImpt_Wooden Hit, Dark, Heavy Hit` |
| 金属 / 铁翎 | `The Noisery - Moaning Metal`（金属弓拉尖啸、低频刮擦）· `344 Audio - Antique Small Metals` |
| 举盾 / 格挡 | `WEAPArmr_Metal Shield Spin On Floor, Buckler` |
| 火法卡 | `Ivo Vicic - Campfire/Bonfire FX` · `FIREBurn_Loop Elements Fire Crackling` · `FIREWhsh_Whoosh Fire Deep Growl Monster` |
| 借东风 | `WINDDsgn_Wind, Rush, Whoosh, Long x5` · `344 Audio - Extreme Winds Vol 1` |
| 大招重音 | `Cinematic Sound Design - Colossal Impacts` / `Ultra Transitions & Impacts` |

⚠️ 生物音都是**血肉生物**的。本作敌人是木/金属造物，直接用会串味 —— 正确用法是拿它当**声源层**，叠我们自录的木质/金属材质层（`atoms/wood_block`、`blade_wood`、`metal_screech`），合成"木头做的东西在叫"。

## 采样库通用注意

- **velocity layers 就是现成的力度轴**，跟自录的 `f1/f2/f3` 是同一个东西。这跟生成模型有本质区别（后者每次生成都是不同的东西，见 composition.md 第八条）
- **round robin**（`rr1`/`rr2`）是同力度的不同次演奏，直接当变体池用
- 多数是 44.1kHz 立体声，本库口径是 48k 单声道，要转。降混前测一下相位损失：`pan=mono|c0=0.5*c0+0.5*c1` 跟原始立体声的 RMS 差应该 < 1dB，差太多说明两声道反相
- **文件名标的音高不一定准**。实测 Dan Tranh 的 `C#3` 基频是 D4，八度标记整体差 1。拨弦乐器基频弱、二次泛音强，检测时也容易报高八度——要用就实测
