"""Extract photographed carving into transparent website ornaments.

Usage: python3 scripts/build-story-ornaments.py --leaf-source IMAGE --bone-source IMAGE
Requires Pillow and NumPy. Photographed contours and relief are retained;
leaf color and contrast are adjusted without changing its transparent mask.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
LEAF_CONTOUR = [
    (54, 34), (67, 33), (73, 38), (90, 33), (107, 39), (118, 51),
    (137, 49), (153, 54), (169, 56), (184, 68), (188, 83), (182, 93),
    (174, 98), (174, 113), (164, 126), (160, 137), (143, 149),
    (127, 156), (121, 163), (129, 170), (136, 178), (135, 188),
    (126, 197), (115, 199), (111, 208), (103, 216), (92, 220),
    (86, 229), (74, 236), (61, 237), (56, 231), (45, 227),
    (41, 217), (39, 205), (40, 193), (36, 186), (38, 170),
    (44, 156), (45, 144), (43, 135), (48, 126), (43, 118),
    (48, 109), (43, 102), (48, 91), (43, 82), (48, 75),
    (43, 67), (48, 56), (44, 52), (50, 44),
]
BONE_CONTOURS = [
    [(60, 124), (61, 113), (69, 105), (83, 97), (100, 93),
     (114, 95), (129, 101), (140, 112), (146, 127), (156, 141),
     (170, 148), (171, 156), (157, 164), (148, 161), (137, 154),
     (130, 146), (125, 133), (121, 123), (112, 114), (101, 108),
     (88, 107), (76, 111), (68, 119)],
    [(153, 166), (160, 163), (173, 169), (183, 184), (190, 203),
     (191, 220), (184, 236), (171, 246), (155, 253), (139, 256),
     (123, 250), (111, 242), (99, 229), (101, 225), (113, 234),
     (127, 241), (143, 244), (158, 239), (171, 230), (176, 216),
     (174, 202), (168, 190), (158, 181), (152, 175)],
    [(170, 143), (179, 142), (183, 150), (172, 163), (160, 177),
     (145, 186), (126, 198), (105, 207), (88, 219), (81, 224),
     (75, 220), (81, 211), (99, 199), (118, 189), (135, 177),
     (147, 160), (156, 149)],
]


def extract_leaf(source):
    image = Image.open(source).convert("RGBA")
    if image.size != (220, 256):
        raise ValueError("Leaf source must be the supplied 220 x 256 photograph")
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).polygon(LEAF_CONTOUR, fill=255)
    rgb = np.asarray(image, dtype=np.float32)
    matte = np.asarray(mask.filter(ImageFilter.MinFilter(3)), dtype=np.float32)
    red_spill = (rgb[..., 0] - rgb[..., 1] > 38) & (rgb[..., 0] > rgb[..., 1] * 1.3)
    matte[red_spill] = 0
    image.putalpha(Image.fromarray(np.uint8(matte)).filter(ImageFilter.GaussianBlur(0.45)))
    leaf = image.crop((30, 26, 198, 244))
    alpha = leaf.getchannel("A")
    photo = np.asarray(leaf.convert("RGB"), dtype=np.float32)
    luminance = photo @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    blurred = np.asarray(Image.fromarray(np.uint8(luminance)).filter(ImageFilter.GaussianBlur(1.1)), dtype=np.float32)
    # Sharpen the photographed veins before recoloring, never invent new ones.
    detail = luminance + (luminance - blurred) * 1.2
    low, high = np.percentile(detail[np.asarray(alpha) > 200], [1, 99])
    tone = np.clip((detail - low) / max(high - low, 1), 0, 1)[..., None]
    shadow = np.array([22, 55, 31], dtype=np.float32)
    middle = np.array([83, 133, 64], dtype=np.float32)
    highlight = np.array([202, 222, 160], dtype=np.float32)
    green = np.where(tone < 0.5,
                     shadow + (middle - shadow) * tone * 2,
                     middle + (highlight - middle) * (tone - 0.5) * 2)
    result = Image.fromarray(np.uint8(np.clip(green, 0, 255))).convert("RGBA")
    result.putalpha(alpha)
    return result


def extract_bone(source):
    image = Image.open(source).convert("RGB")
    if image.size != (824, 234):
        raise ValueError("Bone source must be the supplied 824 x 234 photograph")
    # Follow one complete photographed vertebra; do not threshold out faint relief.
    strip = image.transform(
        (360, 280), Image.Transform.QUAD,
        (205, 93, 202, 231, 375, 167, 369, 32), Image.Resampling.BICUBIC,
    )
    mask = Image.new("L", (strip.width * 4, strip.height * 4))
    draw = ImageDraw.Draw(mask)
    for contour in BONE_CONTOURS:
        draw.polygon([(x * 4, y * 4) for x, y in contour], fill=255)
    mask = mask.resize(strip.size, Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(0.35))
    result = strip.convert("RGBA")
    result.putalpha(mask)
    result = result.crop(mask.getbbox()).rotate(-38, Image.Resampling.BICUBIC, expand=True)
    result = result.crop(result.getchannel("A").getbbox())
    padded = Image.new("RGBA", (result.width + 28, result.height + 28))
    padded.alpha_composite(result, (14, 14))
    return padded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--leaf-source", required=True, type=Path)
    parser.add_argument("--bone-source", required=True, type=Path)
    parser.add_argument("--output", default=ROOT / "assets/brand-story", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    leaf = extract_leaf(args.leaf_source)
    bone = extract_bone(args.bone_source)
    assets = {"grape-leaf-cutout": leaf, "snake-bone-cutout": bone}
    for name, image in assets.items():
        target = args.output / (name + ".png")
        image.save(target, optimize=True)
        print(f"Saved {target.name}: {image.width} x {image.height}")


if __name__ == "__main__":
    main()
