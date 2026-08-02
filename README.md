# AtomSFX

**Offline foley pipeline — record a long take, get named axis-annotated sound atoms, compose them into game-ready variants.**

> Status: early, working. Validated on real recordings. Engine-agnostic (Node + ffmpeg only).
> Companion to [AnchorSFX](https://github.com/AgentGameLab/anchor-sfx) — *atom* prepares the material, *anchor* plays it back in-engine.

## Why this exists

AI SFX generators (Suno, ElevenLabs) give you a finished sound. That's great until you need control, and then three problems show up at once:

- **Every generated clip carries its own room.** Sixty of them in one game means sixty different acoustic spaces, and the mix never settles.
- **You can't adjust it.** Want the shield break a little drier, the tail a little shorter? You can't — you can only reroll and hope.
- **Quality is a dice roll.** Some takes are great, some are mush, and you don't get to decide which.

Recording your own material fixes all three — but only if the material is *atoms*, not finished sounds. That's a different discipline, and it needs different tooling.

## The workflow

```
record one long take        →   split-takes   →   mix-layers   →   game
(talk, then perform)            named atoms       variants
```

**You record the way a foley artist actually works**: pick something up, say what it is and how you're about to hit it, then hit it. Hit `M` when you change intensity. Keep going.

**The splitter figures out the rest.** Speech and percussive transients differ by an order of magnitude in attack steepness (30–80ms vs <5ms), so it separates your narration from your takes without ASR. Markers in the wav's `cue` chunk define the intensity tiers. Everything gets named from that.

No shot list. No recording script. You don't decide what a sound is *for* until after you've heard it.

## Install

Needs Node ≥18 and `ffmpeg` on PATH.

```bash
git clone https://github.com/AgentGameLab/atom-sfx && cd atom-sfx && npm link
```

## Use

**1. Look at what you recorded** — nothing is written yet:

```bash
atom-split --input take.wav --dry-run
```

```
时长 86.5s · 噪声地板 -61.6dBFS · 触发阈值 -40.0dBFS
切到 37 段：slate 10 · take 27
marker 9 个：28.0s 33.5s 39.1s 50.7s ...
合并出 3 段口报

[ 1] 9 个 take  (口报 @ 1.28s)
        1.  档1  28.57s  attack   7ms  dur  143ms  peak -6.8dBFS
        2.  档1  30.46s  attack   6ms  dur  123ms  peak -11.0dBFS
        ...
```

**2. Describe what each group was** — transcribe your own narration (any ASR), write it down:

```json
{
  "source": "desk_padded",
  "technique": "fingernail",
  "tierAxis": "f",
  "groups": [
    { "axis": { "r": "center" } },
    { "axis": { "r": "mid" } },
    { "axis": { "r": "edge" } }
  ]
}
```

**3. Cut:**

```bash
atom-split --input take.wav --map desk.json --out atoms/
```

```
desk_padded__fingernail__r_center__f1__01.wav
desk_padded__fingernail__r_center__f1__02.wav
desk_padded__fingernail__r_center__f2__01.wav
...
```

**4. Compose** — layer atoms into variants, or just normalize and render single-source ones:

```bash
atom-mix --mode layered --body-gain -3 --body-delay 4
atom-mix --mode direct
```

## Three rules the pipeline is built on

**1. Atoms must be ingredients, not finished sounds.** A library "metal impact" is already designed — it has its own tail, its own room, its own mix. Stack two of those and the ear hears *two sounds*, not one. Record dry, single-event, short, same signal chain throughout.

**2. Split at the level where behaviour differs.** *If a component appears under one game state and not another, it must be its own atom.* Debris only exists when the shield actually breaks; armour rattle is the dominant secondary when it doesn't. Mechanical, not taste-based. The converse also holds — components that always appear together can stay fused, and splitting them just costs you recording time.

**3. Record along an axis, not as scattered points.** A library gives you fifty unrelated "metal impacts". One mic on one object varying only force gives you a *coordinate*. That's what makes `energy → sound` a real mapping instead of a pitch-shift guess, and it's the one thing buying can't give you.

## Design notes worth knowing before you change things

- **Normalization is per-family, one gain for the whole set — never per-file.** Per-file normalization flattens the force axis: soft and hard end up equally loud, and the axis is gone. The scripts scale the whole family by one coefficient so internal relationships survive.
- **Short transients use peak/RMS, not LUFS.** `ebur128` integrated loudness needs a ≥400ms analysis block; impacts land at 300–400ms, right on the boundary, and the reading isn't trustworthy.
- **Cutting must re-encode, never `-c copy`.** WAV `-c copy` seeks at packet granularity, so `-ss` rounds to a packet boundary and silently eats the attack. `pcm_f32le → pcm_f32le` is lossless and sample-accurate.
- **NG detection is off by default.** The "not a take and short" heuristic misfires on soft hits (their attack exceeds the transient threshold) and would silently discard a good take. Enable with `--ng` if you want it.

## Docs

- [录制说明](docs/recording-guide.md) — how to record so the tooling can read it (Chinese)
- [Schema](docs/schema.md) — atom metadata, axes, naming (Chinese)

## License

MIT — see [LICENSE](LICENSE).
