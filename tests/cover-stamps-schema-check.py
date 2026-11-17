import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

root = Path(__file__).resolve().parents[1]
schema = json.loads((root / "schemas/album-entry.v1.schema.json").read_text())
entry = json.loads((root.parent / "album_source/entries/upload-2026-custom-gold-opal-coin.json").read_text())[0]
validator = Draft202012Validator(schema)
for stamps in [[], ["gold"], ["antique"], ["gold", "antique"]]:
    value = copy.deepcopy(entry)
    value["coverStamps"] = stamps
    value["coverStampPosition"] = "top-right"
    validator.validate(value)
for invalid in [["typo"], ["gold", "gold"], "gold", None]:
    value = copy.deepcopy(entry)
    value["coverStamps"] = invalid
    assert not validator.is_valid(value), f"invalid stamps accepted: {invalid}"
value = copy.deepcopy(entry)
value.pop("coverStamps", None)
value.pop("coverStampPosition", None)
validator.validate(value)
value["coverStampPosition"] = "middle"
assert not validator.is_valid(value), "unknown corners must be rejected"
print("PASS cover stamp schema and unmarked-record compatibility")
