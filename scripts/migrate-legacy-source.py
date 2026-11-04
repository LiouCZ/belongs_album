"""One-time, hash-checked migration from the historical export and Word to JSON."""

import argparse
import hashlib
import io
import json
import re
import shutil
from collections import defaultdict
from datetime import date
from pathlib import Path
from zipfile import ZipFile

from lxml import etree
from PIL import Image, ImageOps


SITE = Path(__file__).resolve().parents[1]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"w": W, "a": A, "r": R}
NUMBER_MARKS = {mark: f"{index}." for marks in ["➊➋➌➍➎➏➐➑➒➓", "❶❷❸❹❺❻❼❽❾❿", "①②③④⑤⑥⑦⑧⑨⑩"]
                for index, mark in enumerate(marks, 1)}
DATE_PREFIX = re.compile(r"^(20\d{2})年(\d{1,2})月(\d{1,2})日(.*)$")
VOLUME_TITLE = re.compile(r"^Belongs\s*20\d{2}年作品集$", re.IGNORECASE)

# These article boundaries were previously checked against the original Word.
NARRATIVES = {
    ("2021-06-06", "侘寂之美"): (148, 156),
    ("2021-06-11", "马"): (168, 171),
    ("2021-09-02", "信使"): (246, 248),
    ("2022-01-14", "你好,2022"): (386, 394),
}


def clean_text(text):
    text = text.replace("\u200b", "").replace("\xa0", " ")
    for mark, replacement in NUMBER_MARKS.items():
        text = text.replace(mark, replacement)
    return " ".join(text.split())


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def safe_file(root, relative):
    target = (root / relative).resolve()
    if Path(relative).is_absolute() or not target.is_relative_to(root.resolve()):
        raise ValueError(f"unsafe asset path: {relative}")
    if not target.is_file():
        raise ValueError(f"missing asset: {relative}")
    return target


def read_word(document, old_items):
    """Keep text/image order within a paragraph; some next-work titles follow a drawing."""
    events = []
    image_index = 0
    with ZipFile(document) as archive:
        relationships = etree.fromstring(archive.read("word/_rels/document.xml.rels"))
        targets = {}
        for relation in relationships:
            if relation.get("Type", "").endswith("/image"):
                target = relation.get("Target", "")
                targets[relation.get("Id")] = target.lstrip("/") if target.startswith("/") else f"word/{target}"
        body = etree.fromstring(archive.read("word/document.xml")).find("w:body", NS)
        for paragraph_index, paragraph in enumerate(body):
            if paragraph.tag != f"{{{W}}}p":
                continue
            text = []

            def flush():
                value = clean_text("".join(text))
                if value:
                    events.append({"paragraph": paragraph_index, "text": value})
                text.clear()

            for node in paragraph.iter():
                if node.tag == f"{{{W}}}t":
                    text.append(node.text or "")
                elif node.tag == f"{{{A}}}blip":
                    target = targets.get(node.get(f"{{{R}}}embed"))
                    if not target:
                        continue
                    raw = archive.read(target)
                    try:
                        with Image.open(io.BytesIO(raw)) as image:
                            dimensions = ImageOps.exif_transpose(image).size
                    except (OSError, ValueError):
                        continue
                    if min(dimensions) < 120:
                        continue
                    flush()
                    image_index += 1
                    old = old_items[image_index - 1] if image_index <= len(old_items) else None
                    if old is None or old["sourceIndex"] != image_index or not old["id"].endswith(hashlib.sha1(raw).hexdigest()[:10]):
                        raise ValueError(f"image identity mismatch at Word image {image_index}")
                    events.append({"paragraph": paragraph_index, "imageIndex": image_index})
            flush()
    if image_index != len(old_items):
        raise ValueError(f"image identity mismatch: Word has {image_index}, export has {len(old_items)}")
    return events


def match_captions(events, old_items):
    sections = []
    current = None
    pending = []
    active = []
    active_images = []
    matched = {}
    recovered_tails = []

    def retain_trailing_text():
        if not pending or not active_images:
            return
        tail = "\n".join(line["text"] for line in pending)
        for index in active_images:
            work = matched[index]
            work["description"] = "\n".join(part for part in [work["description"], tail] if part)
            work["paragraphIndexes"] = sorted(set(work["paragraphIndexes"] + [line["paragraph"] for line in pending]))
        recovered_tails.append({"imageIndexes": active_images[:], "paragraphIndexes": [line["paragraph"] for line in pending]})

    for event in events:
        if "text" in event:
            text = event["text"]
            found = DATE_PREFIX.fullmatch(text)
            if found:
                retain_trailing_text()
                published = date(*map(int, found.group(1, 2, 3))).isoformat()
                current = {"date": published, "title": "", "events": [], "images": []}
                sections.append(current)
                pending, active = [], []
                active_images = []
                text = found[4].strip()
            if not text or VOLUME_TITLE.fullmatch(text):
                continue
            value = {"text": text, "paragraph": event["paragraph"]}
            pending.append(value)
            if current is not None:
                if not current["title"]:
                    current["title"] = text
                current["events"].append(value)
        else:
            index = event["imageIndex"]
            if pending:
                active = pending
                active_images = []
            lines = [line["text"] for line in active]
            old = old_items[index - 1]
            matched[index] = {
                "date": current["date"] if current else None,
                "title": lines[0] if lines else old["title"],
                "description": "\n".join(lines[1:]) if lines else old["caption"],
                "articleTitle": current["title"] if current else "",
                "paragraphIndexes": sorted({event["paragraph"], *(line["paragraph"] for line in active)}),
            }
            active_images.append(index)
            if current is not None:
                current["images"].append(index)
                current["events"].append(event)
            pending = []

    retain_trailing_text()
    restored = []
    for section in sections:
        bounds = NARRATIVES.get((section["date"], section["title"]))
        if bounds is None:
            continue
        first, last = bounds
        selected = [index for index in section["images"] if first <= index <= last]
        if selected != list(range(first, last + 1)):
            raise ValueError(f"known narrative image boundary mismatch: {section['title']}")
        end = next(index for index, event in enumerate(section["events"]) if event.get("imageIndex") == last)
        narrative = section["events"] if last == section["images"][-1] else section["events"][:end + 1]
        lines = [event["text"] for event in narrative if "text" in event]
        for index in selected:
            matched[index].update(title=section["title"], description="\n\n".join(lines[1:]),
                                  paragraphIndexes=sorted({event["paragraph"] for event in narrative}))
        restored.append({"date": section["date"], "title": section["title"], "imageIndexes": selected})
    return matched, restored, len(sections), recovered_tails


def image_record(site, old):
    large = safe_file(site, old["image"])
    thumbnail = safe_file(site, old["thumb"])
    with Image.open(large) as image:
        width, height = image.size
    with Image.open(thumbnail) as image:
        thumb_width, thumb_height = image.size
    if (width, height, thumb_width, thumb_height) != (old["largeWidth"], old["largeHeight"], old["thumbWidth"], old["thumbHeight"]):
        raise ValueError(f"export image dimensions mismatch: {old['id']}")
    return {
        "id": old["id"], "path": old["image"], "sha256": digest(large.read_bytes()),
        "width": width, "height": height, "sourceImageIndex": old["sourceIndex"],
        "thumbnail": {"path": old["thumb"], "sha256": digest(thumbnail.read_bytes()), "width": thumb_width, "height": thumb_height},
        "legacy": {"index": old["index"], "originalWidth": old["width"], "originalHeight": old["height"]},
    }


def migrate(snapshot, document, source, asset_root=None):
    if (source / "legacy-manifest.json").exists() or (source / "migrations/legacy-v1.json").exists() or list((source / "entries").glob("legacy-*.json")):
        raise ValueError("already migrated: edit canonical JSON instead of importing Word again")
    if (source / "backups/legacy-v1").exists():
        raise ValueError("existing migration backup must be preserved")
    raw_snapshot = snapshot.read_bytes()
    payload = json.loads(raw_snapshot)
    old_items = payload["items"]
    if len({item["id"] for item in old_items}) != len(old_items):
        raise ValueError("duplicate export image IDs")
    site = asset_root or snapshot.parent.parent
    events = read_word(document, old_items)
    matched, restored, section_count, recovered_tails = match_captions(events, old_items)
    entries = {}
    changes = []
    for old in old_items:
        match = matched[old["sourceIndex"]]
        year = match["date"][:4] if match["date"] else old["year"]
        group_key = tuple(re.sub(r"\s+", "", str(part)).lower() for part in
                          [year, match["date"], match["title"], match["description"]])
        if group_key not in entries:
            entries[group_key] = {
                "schemaVersion": 1, "id": f"legacy:{old['id']}",
                "source": {"kind": "docx", "document": document.name, "sourceImageIndexes": [],
                           "articleTitle": match["articleTitle"], "paragraphIndexes": []},
                "date": match["date"], "year": year, "title": match["title"], "description": match["description"],
                "images": [], "reviewStatus": "needs_review",
                "reviewNotes": "图片身份及文档日期段落已自动核对；尚未逐件人工复核。document 仅记录历史来源，后续构建不读取 Word。",
            }
        entry = entries[group_key]
        entry["images"].append(image_record(site, old))
        entry["source"]["sourceImageIndexes"].append(old["sourceIndex"])
        entry["source"]["paragraphIndexes"] = sorted(set(entry["source"]["paragraphIndexes"] + match["paragraphIndexes"]))
        display_date = f"{int(match['date'][:4])}年{int(match['date'][5:7])}月{int(match['date'][8:])}日" if match["date"] else year
        fields = [field for field, new in [("date", display_date), ("year", year), ("title", match["title"]),
                                           ("caption", match["description"])] if old[field] != new]
        if fields:
            changes.append({"imageId": old["id"], "entryId": entry["id"], "fields": fields})

    # All Word identities and exported files are checked before any canonical writes.
    backup = source / "backups/legacy-v1"
    backup.mkdir(parents=True)
    shutil.copyfile(snapshot, backup / "items.json")
    if snapshot.with_suffix(".js").exists():
        shutil.copyfile(snapshot.with_suffix(".js"), backup / "items.js")
    years = defaultdict(list)
    for entry in entries.values():
        years[entry["year"]].append(entry)
        for image in entry["images"]:
            for relative in [image["path"], image["thumbnail"]["path"]]:
                destination = source / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                if destination.exists() and digest(destination.read_bytes()) != digest((site / relative).read_bytes()):
                    raise ValueError(f"source asset already differs: {relative}")
                shutil.copyfile(site / relative, destination)
    (source / "entries").mkdir(exist_ok=True)
    for year, records in sorted(years.items()):
        (source / f"entries/legacy-{year}.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    manifest = {"schemaVersion": 1, "legacyFiles": [f"entries/legacy-{year}.json" for year in sorted(years)],
                "requiredImageIds": [item["id"] for item in old_items]}
    (source / "legacy-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    report = {
        "schemaVersion": 1, "snapshot": "backups/legacy-v1/items.json", "snapshotSha256": digest(raw_snapshot),
        "originalDocument": document.name, "documentSha256": digest(document.read_bytes()),
        "images": len(old_items), "entries": len(entries), "publicationSections": section_count,
        "years": {year: {"entries": len(records), "images": sum(len(entry["images"]) for entry in records)} for year, records in sorted(years.items())},
        "missingDates": [entry["id"] for entry in entries.values() if entry["date"] is None],
        "emptyDescriptions": [entry["id"] for entry in entries.values() if not entry["description"]],
        "restoredNarratives": restored, "retainedTrailingText": recovered_tails, "changes": changes,
        "notes": "原导出图文逐字备份；原图指现有网站的大图版本，不冒充 Word 原始分辨率。未推测公众号原文链接或末尾主题。全部记录保留 needs_review，不能将自动迁移视为逐件人工校对。",
    }
    (source / "migrations").mkdir(exist_ok=True)
    (source / "migrations/legacy-v1.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"migrated images={len(old_items)} entries={len(entries)} dateSections={section_count} missingDates={len(report['missingDates'])}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, default=SITE / "data/items.json")
    parser.add_argument("--document", type=Path, default=SITE.parent / "Belongs2021-2026公众号合集.docx")
    parser.add_argument("--source", type=Path, default=SITE.parent / "album_source")
    parser.add_argument("--asset-root", type=Path, help="Existing public site when auditing a saved export snapshot")
    arguments = parser.parse_args()
    migrate(arguments.snapshot.resolve(), arguments.document.resolve(), arguments.source.resolve(),
            arguments.asset_root.resolve() if arguments.asset_root else None)
