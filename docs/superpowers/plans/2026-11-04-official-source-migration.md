# Official Source Migration Implementation Plan

**Goal:** Migrate historical official captions and images to the existing article/entry JSON format, with no Word dependency after the one-time conversion.

**Architecture:** The one-time importer verifies all image identities against Word and preserves the old export as an immutable backup. Historical entries and existing WeChat entries share `album_source/entries/`; a single build command regenerates the two existing browser payloads from this source folder. Keeping public image IDs and paths preserves story references and static-file compatibility.

**Tech Stack:** Python standard library, lxml/Pillow for the one-time Word audit, JSON Schema, Node.js and existing Playwright checks.

**Approved Design:** User approved the migration proposed in this conversation on 2026-11-04.

## Constraints

- Preserve the 1011 historical image identities and bytes, thumbnails, and all archived original text.
- Use only explicit Word publication boundaries for recovered dates; unresolved dates remain null.
- Consolidate only known narrative fragments checked against their Word section; preserve distinct works.
- Keep source provenance and review notes; do not manufacture article links, themes or image-to-work certainty.
- Keep the existing palette, layout and unpublished typography/footer changes. Do not commit or publish.

## Task 1: One-Time Migration

- [x] Add `tests/legacy-source-migration-check.py` covering inline dates, text after images, unknown dates, image mismatches and overwrite protection.
- [x] Run the test with the bundled Python and verify it fails before the importer exists.
- [x] Add `scripts/migrate-legacy-source.py`; extend the existing entry schema for empty legacy descriptions, optional year, thumbnail metadata and stable legacy indices.
- [x] Verify all 1011 Word image hashes, save a byte-for-byte export backup, copy large images/thumbnails, write year entry files and an auditable migration report.
- [x] Re-run the importer tests and validate every generated entry.

## Task 2: Word-Free Rebuild

- [x] Add `tests/official-source-build-check.mjs` covering a clean build, exact legacy IDs/assets, idempotence, unsafe paths and hash failures.
- [x] Verify the test fails before the new builder exists.
- [x] Add `scripts/build-official-album.mjs`; export the existing curated builder as a reusable function with explicit source/output roots.
- [x] Rebuild the existing `data/items.*` and curated payloads exclusively from canonical JSON and images. Preserve browser grouping, chronological insertion and story source IDs.
- [x] Run cold builds into a temporary empty directory with no Word or prior generated items present.

## Task 3: Maintenance and Regression

- [x] Document canonical directories, review boundaries, backup procedure and the single build command in `docs/source-data-v1.md`; update the maintenance skill to use that procedure.
- [x] Check known repaired articles, all image paths and metadata, grid/list ordering, categories, search and carousels on desktop/mobile.
- [x] Run all Node regression scripts, Python migration/schema checks and `git diff --check`.
- [x] Report counts, remaining review flags and the fact that these changes are local/unpublished.

## Verification

- All 21 Node regression scripts passed, including clean JSON-only rebuilds, source quote freshness, official/player pages, typography, pagination and VIP export.
- All 5 one-time migration fixtures passed; every canonical record, image hash, thumbnail hash and actual image dimension passed validation.
- Desktop (1440px) and mobile (390px) screenshots checked: 760 groups / 1053 images, no horizontal overflow; restored long captions keep images and carousel controls within the desktop dialog.
- Historical source: 718 entries / 1011 images; 19 descriptions remain empty and all historical entries retain `needs_review` pending per-work manual verification. Existing 42 WeChat works remain intact.
- Source records live outside the public repository and must be backed up with it. No commit, push or GitHub Pages deployment performed.
