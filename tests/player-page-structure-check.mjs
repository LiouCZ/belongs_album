import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "player.html"), "utf8");

assert.match(html, /<main class="player-album" id="playerAlbum">/);
assert.match(html, /id="collectionSpotlight"/);
assert.match(html, /id="collectionFilter"/);
assert.doesNotMatch(html, /id="yearFilter"/);
