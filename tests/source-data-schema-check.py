#!/usr/bin/env python3
"""Validate curated article/album records, image files, and source links."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]


def source_root(path: Path) -> Path:
    return path.parent.parent if path.parent.name in {"articles", "entries"} else ROOT


def local_file(root: Path, relative: str) -> Path:
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"unsafe relative path: {relative}")
    result = root / path
    if not result.is_file():
        raise ValueError(f"image not found: {result}")
    return result


def verify_image(root: Path, relative: str, sha256: str | None, width: int | None, height: int | None) -> None:
    path = local_file(root, relative)
    if sha256 and hashlib.sha256(path.read_bytes()).hexdigest() != sha256:
        raise ValueError(f"image hash mismatch: {path}")
    if width and height:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(path)],
            capture_output=True,
            text=True,
            check=True,
        )
        stream = json.loads(result.stdout)["streams"][0]
        if (stream["width"], stream["height"]) != (width, height):
            raise ValueError(f"image dimensions mismatch: {path}")


def validate(paths: list[Path]) -> None:
    schemas = {
        "article": json.loads((ROOT / "schemas/wechat-article.v1.schema.json").read_text(encoding="utf-8")),
        "entry": json.loads((ROOT / "schemas/album-entry.v1.schema.json").read_text(encoding="utf-8")),
    }
    articles: dict[str, dict] = {}
    entries: dict[str, dict] = {}

    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = payload if isinstance(payload, list) else [payload]
        for record in records:
            kind = "article" if "captureStatus" in record else "entry"
            Draft202012Validator(schemas[kind], format_checker=FormatChecker()).validate(record)
            target = articles if kind == "article" else entries
            if record["id"] in target:
                raise ValueError(f"duplicate record ID: {record['id']}")
            record["_root"] = source_root(path)
            target[record["id"]] = record

            if kind == "article":
                slug = record["source"]["url"].split("/s/", 1)[1]
                if record["id"] != f"wechat:{slug}":
                    raise ValueError(f"article ID does not match URL: {path}")
                if record["theme"] and record["theme"]["date"] != record["publishedDate"]:
                    raise ValueError(f"theme date does not match article date: {path}")
                source_ids = [asset["id"] for asset in record["sourceImages"]]
                if len(source_ids) != len(set(source_ids)):
                    raise ValueError(f"duplicate source image ID: {path}")
                for asset in record["sourceImages"]:
                    verify_image(record["_root"], asset["localPath"], asset["sha256"], asset["width"], asset["height"])
            else:
                image_ids = [image["id"] for image in record["images"]]
                if len(image_ids) != len(set(image_ids)):
                    raise ValueError(f"duplicate work image ID: {path}")
                for image in record["images"]:
                    verify_image(record["_root"], image["path"], image.get("sha256"), image.get("width"), image.get("height"))
                if record["source"]["kind"] == "docx":
                    indexes = [image.get("sourceImageIndex") for image in record["images"]]
                    if indexes != record["source"]["sourceImageIndexes"]:
                        raise ValueError(f"Word image indexes do not match: {path}")
                elif any(not image.get("sourceImageId") or not image.get("crop") or not image.get("sha256") for image in record["images"]):
                    raise ValueError(f"WeChat work missing screenshot provenance: {path}")
        print(f"OK {path} ({len(records)} record(s))")

    for article in articles.values():
        related = [entry for entry in entries.values() if entry["source"]["kind"] == "wechat" and entry["source"]["articleId"] == article["id"]]
        related.sort(key=lambda entry: entry["source"]["position"])
        positions = [entry["source"]["position"] for entry in related]
        if positions != list(range(1, len(related) + 1)):
            raise ValueError(f"article work positions are not consecutive: {article['id']}")
        if article["captureStatus"] == "complete" and [entry["id"] for entry in related] != article["workIds"]:
            raise ValueError(f"article work IDs do not match extracted works: {article['id']}")
        source_images = {image["id"]: image for image in article["sourceImages"]}
        for entry in related:
            if entry["date"] != article["publishedDate"]:
                raise ValueError(f"work date does not match article: {entry['id']}")
            for image in entry["images"]:
                source = source_images.get(image["sourceImageId"])
                if source is None:
                    raise ValueError(f"work screenshot has no source image: {entry['id']}")
                crop = image["crop"]
                if crop["x"] + crop["width"] > source["width"] or crop["y"] + crop["height"] > source["height"]:
                    raise ValueError(f"screenshot crop exceeds source image: {entry['id']}")
                if image["width"] != crop["width"] or image["height"] != crop["height"]:
                    raise ValueError(f"screenshot dimensions do not match crop: {entry['id']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: source-data-schema-check.py RECORD.json [...]")
    validate([Path(name) for name in sys.argv[1:]])
