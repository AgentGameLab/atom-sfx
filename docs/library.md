# 素材库索引

> 自动生成：`node tools/gen-library.mjs`。改了 `atoms/` 就重跑。
> 共 **374** 个原子 / **32** 个 source。

文件名即元数据：`<source>__<technique>__<轴>...__<variant>.wav`。
轴的取值来自录制时的受控变量（力度 / 落点 / 速度 / 材质状态…），命名规范见 [schema.md](schema.md)。

| source | technique | 轴坐标 | 数量 | 来历 |
|---|---|---|---|---|
| `chessboard` | knock_side / knock / wood_slide | f1 · f2 · f3 …共 15 | 54 | 大棋盘。落点中心/圆环/边缘/角落各三档 + 敲盘侧边 + 木头在木头上滑动 |
| `desk_padded` | fingernail | r_center f1 · r_center f2 · r_center f3 …共 9 | 27 | 带垫子的木桌面，指甲敲击；木质回响、沉闷。每组轻/中/重各三下 |
| `glass_cup` | metal_spoon | p_edge f_1 · p_edge f_2 · p_edge f_3 …共 9 | 27 | 金属勺敲玻璃杯。从最厚往最薄边缘三个位置，各轻中重三下，清脆叮叮 |
| `long_rod` | twang | len_long f_1 · len_long f_2 · len_long f_3 …共 9 | 27 | 长杆压边弹颤动。长度 长/中/短 × 力度 小/中/大（力度顺序按实测峰值定，档1 最轻）。中杆力度轴最完整（跨度 10.5dB 单调）；短杆中/大仅差 0.3dB，可当两档用 |
| `metal_box` | lid_close / lid_open / strike | f1 · side_1 f1 · side_1 f2 …共 7 | 25 | 大铁盒，声音偏沉像钟。两个面各三档敲击 + 开盖 + 关盖 |
| `stone_slab` | piece_drop | damp_dry f1 · damp_dry f2 · damp_dry f3 …共 6 | 20 | 棋子落石板（干）。开门青石用。三档力度，marker 前那档是档1 |
| `playing_card` | draw / shuffle | v1 · v2 | 19 | 真实卡牌。抽一张出来（多版本）/ 洗牌（两版本） |
| `cardboard` | pull_out / tear | spd1 · spd2 · spd3 | 14 | 硬纸板抽出，速度慢/中/快。软木塞拔出实测无声（摩擦系数低+弹性回弹），改纸板纤维撕扯。渐进摩擦包络：attack 122-429ms |
| `cleaver` | tap | — | 13 | 菜刀金属敲击。无力度分档，13 个变体。清脆干净，attack 4-15ms |
| `blade_wood` | scrape | spd1 · spd2 · spd3 | 9 | 锋利金属刮过木头，慢/中/快三档速度 |
| `ceramic_plate` | tap | f1 · f2 · f3 | 9 | 敲瓷盘，三档力度。用作 S5 磬钉帧——比 glass_cup 短、比金属干 |
| `cleaver_chopstick` | chop | f1 · f2 · f3 | 9 | 菜刀砍筷子，三档力度。金属刃切断木杆——矛/箭折断、木质敌人被斩 |
| `cork` | stab | f1 · f2 · f3 | 9 | 锥形物戳软木，三档力度。用作矛/箭的刺入层（入木瞬态） |
| `glass_slab` | knuckle | f1 · f2 · f3 | 9 | 指节敲一大块玻璃，沉闷。轻/中/重三档 |
| `grill_rack` | metal_slide | spd1 · spd2 · spd3 | 9 | 金属头滑过烤网格栅，连续清脆带回响。慢/中/快三档 |
| `leather` | hand_rub | tex_rough f1 · tex_rough f2 · tex_rough f3 …共 9 | 9 | 手搓皮革，力度=速度。两张：粗糙 4 档 / 光滑 3 档 |
| `metal_board2` | piece_drop | r_center · r_edge · r_mid | 9 | 棋子落金属板 第二份。落点轴：中间/边上一点/最边缘。低频三档几乎不变(1.5dB)，变的全是中高频=板振动模态。小天定为死门青铜 |
| `metal_board` | piece_drop | f1 · f2 · f3 | 9 | 棋子落金属板。伤门铁用。三档力度，余韵 343-490ms 明显长于石板 |
| `wood_block` | strike | f1 · f2 · f3 | 9 | 两块小木料对敲。小天点名：模拟棋子之间碰撞。轻/中/重三档 |
| `breath_whoosh` | mouth | w_heavy · w_light · w_sharp | 8 | 口吹模仿破空声。三版：重物挥动 / 轻快滑过 / 锋利如划纸 |
| `plastic_bag` | hand_rub | — | 8 | 手轻搓塑料袋，像篝火噼啪声。经典的火焰拟音替代 |
| `seal` | press | f1 · f2 · f3 | 7 | 印章落下按压。软木平底按纸，两档力度（marker 之前那下是试按） |
| `nail_clipper` | snap_close | size_large · size_small | 6 | 指甲刀合盖，金属碰撞+机械结构。大/小两个，不分力度 |
| `magnet_lid` | close | — | 5 | 塑料磁吸盖吸合的关闭声。不分力度，多录几遍 |
| `metal_screech` | scrape | — | 4 |  |
| `paper_burn` | crackle | — | 4 |  |
| `air_slit` | hiss | — | 3 |  |
| `air_whoosh` | burst | — | 3 |  |
| `paper` | flatten | — | 3 | 手掌铺平纸张。小天点名也可用作翻页类。三个变体动作略不同（渐进抹平/拍平/推平） |
| `scroll` | unroll | — | 3 | 卷轴展开三段。第一段小天点名较好（1.5s，比后两段响 11dB） |
| `flamethrower` | burst | src_real f1 · src_real f2 | 2 | 真实喷火器。计划小/中/大三段，第三段没气了没录成 |
| `water_trickle` | flow | — | 2 |  |

## 怎么用

```bash
# 单源归一渲染
atom-mix --mode direct --src atoms/ --family <source> --def-id <目标id>

# 两层合成（瞬态 + 共振）
atom-mix --mode layered --src atoms/ --contact <source A> --body <source B> \
  --pair-axis f --body-axis r=center --body-gain -10 --body-delay 4 --def-id <目标id>
```

合成时的取舍见 [composition.md](composition.md)。
