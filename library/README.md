# library/ —— 外部素材

跟 `atoms/` 是两类东西，别混：

| | `atoms/` | `library/` |
|---|---|---|
| 来源 | 自己录的，同一条信号链 | 外部 CC0 采样库 |
| 用途 | **物理层** —— 对应真实发生的事 | **戏剧层** —— 不对应任何物理事件 |
| 干湿 | 必须干（截瞬态、去房间） | **可以带余韵** |
| 判据 | 受控变量、族内 σ < 2dB | 许可证 + velocity 分层 |

戏剧层为什么可以带房间：它不在场景的物理空间里，在叙事空间里——跟电影配乐不需要匹配画面混响是一回事。物理层那套"必须干、只截瞬态"的要求对它不适用。

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

## 采样库通用注意

- **velocity layers 就是现成的力度轴**，跟自录的 `f1/f2/f3` 是同一个东西。这跟生成模型有本质区别（后者每次生成都是不同的东西，见 composition.md 第八条）
- **round robin**（`rr1`/`rr2`）是同力度的不同次演奏，直接当变体池用
- 多数是 44.1kHz 立体声，本库口径是 48k 单声道，要转。降混前测一下相位损失：`pan=mono|c0=0.5*c0+0.5*c1` 跟原始立体声的 RMS 差应该 < 1dB，差太多说明两声道反相
- **文件名标的音高不一定准**。实测 Dan Tranh 的 `C#3` 基频是 D4，八度标记整体差 1。拨弦乐器基频弱、二次泛音强，检测时也容易报高八度——要用就实测
