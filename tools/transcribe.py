#!/usr/bin/env python
"""
transcribe.py —— 长录音 → 语音区间 JSON（喂给 split-takes --speech）

为什么需要它：口报和素材的分离，靠声学特征（attack 陡峭度）只对**瞬态**有效。
持续音（火焰/风/水/摩擦）跟语音一样是慢 attack、长时长、多峰，分不开 ——
实测喷火器录音里，30 秒火焰被判成了口报。

反过来做就没有这个问题：**先定位语音，剩下的都是素材**。
段级时间戳不行（whisper 的 VAD 会把「说话…30秒火焰…说话」合成一段），
必须用**词级**时间戳，实测精确到 0.1s。

用法：
    python tools/transcribe.py take.wav -o speech.json
    atom-split --input take.wav --speech speech.json --dry-run

依赖 faster-whisper。任何能给词级时间戳的 ASR 都行，输出成这个格式即可：
    {"spans": [{"s": 0.5, "e": 11.84, "t": "口报原文"}, ...]}
"""
import argparse
import json
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("-o", "--out", help="输出 JSON 路径（不给就打到 stdout）")
    ap.add_argument("--model", default="large-v3-turbo", help="模型名或本地目录")
    ap.add_argument("--language", default="zh")
    ap.add_argument("--device", default="cpu", help="cpu / cuda（cuda 需要 cublas 在 PATH）")
    ap.add_argument("--compute-type", default="int8")
    ap.add_argument("--gap", type=float, default=0.6, help="相邻词间隔小于这个值就并成一段（秒）")
    args = ap.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("需要 faster-whisper：pip install faster-whisper")

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, _ = model.transcribe(
        args.input, language=args.language, word_timestamps=True, vad_filter=True
    )

    spans = []
    cur = None
    for seg in segments:
        for w in seg.words or []:
            if cur and w.start - cur["e"] <= args.gap:
                cur["e"] = round(w.end, 2)
                cur["t"] += w.word
            else:
                if cur:
                    spans.append(cur)
                cur = {"s": round(w.start, 2), "e": round(w.end, 2), "t": w.word}
    if cur:
        spans.append(cur)

    payload = {"input": args.input, "spans": spans}
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        for sp in spans:
            print(f'  {sp["s"]:7.2f} - {sp["e"]:7.2f}  ({sp["e"] - sp["s"]:5.2f}s)  {sp["t"][:50]}')
        print(f"\n{len(spans)} 段语音 → {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
