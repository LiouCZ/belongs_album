"""Exercise the one-time importer with isolated Word/image fixtures."""

import hashlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from lxml import etree
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


class LegacyMigrationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.site = self.root / "site"
        self.source = self.root / "album_source"
        self.snapshot = self.site / "data/items.json"
        self.snapshot.parent.mkdir(parents=True)

    def fixture(self, content):
        document = etree.Element(f"{{{W}}}document", nsmap={"w": W, "a": A, "r": R})
        body = etree.SubElement(document, f"{{{W}}}body")
        relationships = etree.Element("Relationships")
        raw_images = []
        items = []
        for index, color in enumerate(["red", "green", "blue"], 1):
            stream = io.BytesIO()
            Image.new("RGB", (180, 120), color).save(stream, format="PNG")
            raw = stream.getvalue()
            raw_images.append(raw)
            digest = hashlib.sha1(raw).hexdigest()[:10]
            image_id = f"2021-{index:03d}-{digest}"
            image = f"assets/images/2021/{image_id}.jpg"
            thumb = f"assets/thumbs/2021/{image_id}.jpg"
            for relative in [image, thumb]:
                target = self.site / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
            items.append(dict(id=image_id, year="2021", index=index, sourceIndex=index,
                              date="2021", title="old", caption="", image=image, thumb=thumb,
                              width=180, height=120, largeWidth=180, largeHeight=120,
                              thumbWidth=180, thumbHeight=120))
            etree.SubElement(relationships, "Relationship", Id=f"rId{index}", Target=f"media/image{index}.png",
                             Type=f"{R}/image")
        for chunks in content:
            paragraph = etree.SubElement(body, f"{{{W}}}p")
            for chunk in chunks:
                run = etree.SubElement(paragraph, f"{{{W}}}r")
                if isinstance(chunk, int):
                    etree.SubElement(run, f"{{{A}}}blip", {f"{{{R}}}embed": f"rId{chunk}"})
                else:
                    etree.SubElement(run, f"{{{W}}}t").text = chunk
        self.document = self.root / "historical.docx"
        with ZipFile(self.document, "w") as archive:
            archive.writestr("word/document.xml", etree.tostring(document))
            archive.writestr("word/_rels/document.xml.rels", etree.tostring(relationships))
            for index, raw in enumerate(raw_images, 1):
                archive.writestr(f"word/media/image{index}.png", raw)
        payload = dict(source="historical.docx", years=["2021"], count=3, items=items)
        self.snapshot.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf8")
        return items

    def run_import(self):
        return subprocess.run([sys.executable, str(ROOT / "scripts/migrate-legacy-source.py"),
                               "--snapshot", str(self.snapshot), "--document", str(self.document),
                               "--source", str(self.source)], text=True, capture_output=True)

    def entries(self):
        return [entry for path in sorted((self.source / "entries").glob("legacy-*.json"))
                for entry in json.loads(path.read_text())]

    def test_explicit_dates_and_inline_text_keep_every_image(self):
        old = self.fixture([["2021年12月31日"], ["冬日"], ["原文一"], [1],
                            ["2022年1月1日新年"], ["原文二"], [2, "羽翼"], ["原文三"], [3]])
        result = self.run_import()
        self.assertEqual(result.returncode, 0, result.stderr)
        entries = self.entries()
        self.assertEqual([(entry["date"], entry["title"], entry["description"]) for entry in entries],
                         [("2021-12-31", "冬日", "原文一"), ("2022-01-01", "新年", "原文二"),
                          ("2022-01-01", "羽翼", "原文三")])
        images = [image for entry in entries for image in entry["images"]]
        self.assertEqual([image["id"] for image in images], [item["id"] for item in old])
        for image, item in zip(images, old):
            self.assertEqual((self.source / image["path"]).read_bytes(), (self.site / item["image"]).read_bytes())
            self.assertEqual((self.source / image["thumbnail"]["path"]).read_bytes(), (self.site / item["thumb"]).read_bytes())
        backup = self.source / "backups/legacy-v1/items.json"
        self.assertEqual(backup.read_bytes(), self.snapshot.read_bytes())
        validation = subprocess.run([sys.executable, str(ROOT / "tests/source-data-schema-check.py"),
                                     *map(str, sorted((self.source / "entries").glob("legacy-*.json")))],
                                    text=True, capture_output=True)
        self.assertEqual(validation.returncode, 0, validation.stderr)

    def test_unknown_date_and_empty_caption_are_not_invented(self):
        self.fixture([["未知日期作品"], [1, 2, 3]])
        result = self.run_import()
        self.assertEqual(result.returncode, 0, result.stderr)
        entry = self.entries()[0]
        self.assertIsNone(entry["date"])
        self.assertEqual(entry["year"], "2021")
        self.assertEqual(entry["description"], "")
        self.assertEqual(entry["reviewStatus"], "needs_review")

    def test_text_after_images_survives_date_changes_and_end_of_document(self):
        self.fixture([["2021年12月31日"], ["飞越山海"], ["本期内容"], [1, 2],
                      ["1 -> 鹰盾，正面羽翼雕刻"], ["2 -> 马首，背面唐草"],
                      ["2022年1月1日"], ["腰带"], [3], ["定制尺寸：长100cm，宽3cm"]])
        result = self.run_import()
        self.assertEqual(result.returncode, 0, result.stderr)
        entries = self.entries()
        self.assertEqual(len(entries), 2)
        self.assertEqual(len(entries[0]["images"]), 2)
        self.assertIn("1 -> 鹰盾，正面羽翼雕刻", entries[0]["description"])
        self.assertIn("2 -> 马首，背面唐草", entries[0]["description"])
        self.assertEqual(entries[1]["description"], "定制尺寸：长100cm，宽3cm")

    def test_mismatched_word_image_aborts_before_creating_source(self):
        self.fixture([["2021年1月1日"], ["作品"], [1, 2, 3]])
        data = json.loads(self.snapshot.read_text())
        data["items"][0]["id"] = "2021-001-0000000000"
        self.snapshot.write_text(json.dumps(data))
        result = self.run_import()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("image identity mismatch", result.stderr)
        self.assertFalse((self.source / "entries").exists())

    def test_existing_canonical_records_are_not_overwritten(self):
        self.fixture([["2021年1月1日"], ["作品"], [1, 2, 3]])
        result = self.run_import()
        self.assertEqual(result.returncode, 0, result.stderr)
        before = {path: path.read_bytes() for path in (self.source / "entries").glob("legacy-*.json")}
        result = self.run_import()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already migrated", result.stderr)
        self.assertEqual(before, {path: path.read_bytes() for path in before})


if __name__ == "__main__":
    unittest.main()
