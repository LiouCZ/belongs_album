# 作品图片水印

公开作品照使用已审校的版权水印版本；原始照片不覆盖。已有 `BELONGS OFFICIAL`、`BELONGS B&K` 或官方圆形沙漏版权印记的照片不重复盖章，也不重新压缩。

## 范围与备份

- 只读取 `data/items.js`、`data/curated-official.js`、`data/player-items.js` 引用的作品大图和缩略图。品牌故事复用这些图片时同步生效。
- Logo、二维码、插画、动画图层、装饰素材和视频封面不处理。
- 水印为右下角白色 `BELONGS B&K`，带细暗描边，不加底板，不缩放、裁切或调色。带外框的照片可在审校清单中用 `watermarkBounds` 指定实际照片区域。
- 本次原图备份在网站目录外的 `/Users/loveling/Belongs/.album_backups/watermarks-2026-11-20/originals/`，按原相对路径保存。不要上传该目录。
- `album_source` 里的原始图片、尺寸、SHA-256 和作品记录保持不变；不要把公开水印图片反写到源目录。

## 新增或替换图片

先按正常流程更新源数据，运行 `node scripts/build-official-album.mjs`。构建会按原图哈希复用已审校的公开水印文件，不依赖 Word；原图或路径发生变化时，旧判断不继承，必须重新审校。

本地安装的 Sharp 应可从项目解析，或通过 `BELONGS_IMAGE_MODULE_DIR` 指向包含 Sharp 的 `node_modules`。自动识别使用 macOS Vision，需要本机 Swift 工具链。

```sh
node scripts/image-watermarks.mjs --audit ../.album_backups/watermark-audit.json
```

识别只提供初判。目视检查所有 `review` 和准备 `add` 的图片，尤其是浅色、被裁切的文字水印，以及位于外框内部的圆形版权印记；不要把作品表面的金属刻字当成照片水印。将结果保存为审校后的清单：已有印记用 `existing`，确实无印记用 `add`。同画幅缩略图需同步判断，裁切封面需单独核对。

从源照片新生成的缩略图不包含后来加到公开大图上的水印。审校脚本会单独识别这类缩略图，而非继承大图的 `added` 状态；已完成的缩略图仍按文件哈希复用，避免重复加印。

```sh
node scripts/image-watermarks.mjs --apply ../.album_backups/watermark-audit.json ../.album_backups/watermark-originals
node scripts/image-watermarks.mjs --check
```

处理先校验全部哈希和尺寸、生成全部成品并备份，再替换公开文件。未解决的审校、过期的原图哈希、站内备份和不规范方向的图片都会拒绝处理。最终清单保存在 `data/image-watermarks.json`；重复应用该清单不会再次叠加。清单和水印公开图片都须随网站保留，原图备份则单独保管。

发布前必须运行 `--check`，新图、改图或缺少审校记录都会报错。只使用统一的 `build-official-album.mjs` 重建官方画册，不直接调用旧的单载荷构建器覆盖图片。水印标示版权归属，不会从技术上阻止复制。

## 检查

```sh
node tests/image-watermarks-check.mjs
node tests/image-watermarks-build-check.mjs
node tests/image-watermarks-content-check.mjs
node tests/image-watermarks-browser-check.mjs
node tests/official-source-build-check.mjs
```

内容检查可额外设置 `BELONGS_WATERMARK_BACKUP` 为本次站外备份的 `originals` 目录，逐个核对原图备份哈希。页面直接打开 `index.html` 即可，不需要 Python 服务。
