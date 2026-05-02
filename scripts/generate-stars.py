#!/usr/bin/env python3
"""Generate transparent-background star PNGs via Azure AI Foundry gpt-image-1.5.

Usage:
  ./generate-stars.py                       # generate all presets
  ./generate-stars.py --only gold-sparkle   # just one
  ./generate-stars.py --quality medium      # cheaper draft
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ENDPOINT = "https://claud-assistant-resource.cognitiveservices.azure.com"
DEPLOYMENT = "gpt-image-1.5"
API_VERSION = "2025-04-01-preview"
URL = f"{ENDPOINT}/openai/deployments/{DEPLOYMENT}/images/generations?api-version={API_VERSION}"

PROMPT_PREFIX = (
    "A single magical star object, centered on a fully transparent background. "
)
PROMPT_SUFFIX = (
    " The star body itself has crisp clean edges. A subtle gentle aura and small "
    "sparkle accents around the star are welcome (delicate dust catching light) "
    "but no large puffy halo, no thick outer glow, no atmospheric mist or fog. "
    "Anything outside the star and its small surrounding sparkle is 100% "
    "transparent: no sky, no background wash, no border, no frame, no caption, "
    "no text. Hand-illustrated fantasy painting style, jewel-like, ornate, "
    "delicate, refined, rich saturation."
)

PRESETS = {
    "gold-sparkle": (
        "A delicate ornate five-pointed gold star with fine sharp points, in warm "
        "honey, butter, and pale-cream tones, a hot white pinprick at the center, "
        "crisp and refined like a brooch catching candlelight, with small sparkle "
        "accents scattered nearby."
    ),
    "ruby-twinkle": (
        "A deep ruby-red sharp four-pointed star with crystalline cross gleam and a "
        "bright rose-pink core, faceted like a precious gemstone catching light."
    ),
    "amethyst-nebula": (
        "A six-pointed amethyst-purple star at the heart of a swirling violet and "
        "lavender nebula cloud, with tiny pinpoint dust stars scattered around it."
    ),
    "silver-crescent": (
        "A pale silver crescent moon shape paired with a small companion four-pointed "
        "star at its tip, in cool moonlight tones of pearl, ice-blue, and white."
    ),
    "aurora-ribbon": (
        "A flowing ribbon of aurora light in green, cyan, violet, and pink, gracefully "
        "woven around a central white-gold four-pointed star."
    ),
    "pearl-shimmer": (
        "An iridescent pearl sphere with shifting opal sheen of pink, blue, and gold "
        "highlights — a luminous pearl-like star with a dreamy soft inner glow."
    ),
    "comet-trail": (
        "A bright white-blue four-pointed star with a long curved sparkling tail "
        "trailing behind it like a comet, in deep cobalt and cyan tones."
    ),
    "supernova-bloom": (
        "An explosive multi-layered radial burst star with a bright white core "
        "blooming outward through gold, orange, and crimson — a supernova caught "
        "in the moment of full bloom."
    ),
    "emerald-glint": (
        "A vivid emerald-green four-pointed star with a brilliant white-gold inner "
        "facet glinting at its center, deep jade-green outer points fading to forest, "
        "faceted like a polished gemstone, cool mineral light."
    ),
    "copper-ember": (
        "A burnished copper four-pointed star glowing like a banked ember, with hot "
        "amber and orange highlights and tiny flickering ember sparks around it, deep "
        "burnt-sienna shadow into a bright cream-orange core."
    ),
    "frost-crystal": (
        "A six-armed ice-crystal snowflake star with delicate barbed branches, in pale "
        "ice-blue and frost-white tones, a hot white pinprick at the center, crisp and "
        "geometric like a winter snowflake catching moonlight."
    ),
    "cosmic-rose": (
        "A layered rose-shaped star with three offset five-pointed petal bursts in "
        "blush, pink, and magenta, soft rose-gold glow, evoking a celestial rose in "
        "bloom — petals overlap and rotate around a luminous pink-white heart."
    ),
    "rainbow-burst": (
        "A radial sunburst star with seven rainbow ribbons spoking outward — coral, "
        "amber, daffodil, mint, sky, lavender, rose — meeting at a brilliant white "
        "core, soft prismatic glow, joyful and celebratory."
    ),
    "dragon-fire": (
        "An eight-pointed spiky burst star burning like dragon's breath, white-hot "
        "core into molten gold, fierce orange, and deep ember-black points, with a "
        "fierce hot bloom of flame around it, fearsome and alive."
    ),
}


def get_api_key() -> str:
    if k := os.environ.get("AZURE_GPT_IMAGE_KEY"):
        return k
    return subprocess.check_output(
        ["bw", "get", "password", "Azure AI Foundry - GPT Image 1.5"],
        text=True,
    ).strip()


def generate(prompt: str, api_key: str, size: str, quality: str) -> bytes:
    body = json.dumps({
        "prompt": prompt,
        "n": 1,
        "size": size,
        "background": "transparent",
        "output_format": "png",
        "quality": quality,
    }).encode()
    req = urllib.request.Request(
        URL,
        data=body,
        headers={"api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=240) as resp:
        data = json.loads(resp.read())
    return base64.b64decode(data["data"][0]["b64_json"])


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "assets" / "stars"))
    p.add_argument("--only", help="Generate only this preset slug")
    p.add_argument("--size", default="1024x1024", choices=["1024x1024", "1024x1536", "1536x1024"])
    p.add_argument("--quality", default="high", choices=["low", "medium", "high"])
    p.add_argument("--force", action="store_true", help="Re-roll presets even if their PNG already exists")
    args = p.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.only and args.only not in PRESETS:
        print(f"Unknown preset: {args.only}\nKnown: {', '.join(PRESETS)}", file=sys.stderr)
        return 2

    presets = {args.only: PRESETS[args.only]} if args.only else PRESETS
    key = get_api_key()
    print(f"out: {out_dir}\nquality: {args.quality}, size: {args.size}, count: {len(presets)}\n")

    failed = []
    for i, (slug, desc) in enumerate(presets.items(), 1):
        prompt = PROMPT_PREFIX + desc + PROMPT_SUFFIX
        target = out_dir / f"{slug}.png"
        if target.exists() and not args.force:
            print(f"[{i}/{len(presets)}] {slug:<18} skip (exists; --force to re-roll)")
            continue
        print(f"[{i}/{len(presets)}] {slug:<18} ", end="", flush=True)
        t0 = time.time()
        try:
            png = generate(prompt, key, size=args.size, quality=args.quality)
            target.write_bytes(png)
            print(f"ok  {len(png)//1024:>4}KB  {time.time()-t0:5.1f}s  → {target.name}")
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")[:300]
            print(f"FAIL  HTTP {e.code}  {err}")
            failed.append(slug)
        except Exception as e:
            print(f"FAIL  {type(e).__name__}: {e}")
            failed.append(slug)

    if failed:
        print(f"\n{len(failed)} failed: {', '.join(failed)}")
        return 1
    print(f"\nAll {len(presets)} presets saved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
