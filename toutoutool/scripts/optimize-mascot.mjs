#!/usr/bin/env node
/**
 * 吉祥物图片优化脚本
 * 将 source 目录下的 PNG 转为 WebP，输出到 mascot 目录
 *
 * 用法: npm run optimize:mascot
 *
 * 目录结构:
 *   public/images/mascot/source/hero.png  - 主视觉（引导页等大图，可有背景）
 *   public/images/mascot/source/figure.png - 纯形象（导航/侧栏等，需透明背景）
 *
 * 若 figure.png 不存在，则用 hero.png 生成 figure.webp。
 * 后续提供更多同风格图片时，替换 source 下对应文件后重新运行即可。
 */

import { readFile, writeFile, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_DIR = join(ROOT, "public", "images", "mascot", "source");
const OUT_DIR = join(ROOT, "public", "images", "mascot");

const SIZES = {
  hero: { width: 320, quality: 90 },
  figure: { width: 160, quality: 85 },
};

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function optimize() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("请先安装 sharp: npm install -D sharp");
    process.exit(1);
  }

  const heroPath = join(SOURCE_DIR, "hero.png");
  const figurePath = join(SOURCE_DIR, "figure.png");

  if (!(await exists(heroPath))) {
    console.error("缺少 source/hero.png，请将主视觉图放入 public/images/mascot/source/");
    process.exit(1);
  }

  const figureSource = (await exists(figurePath)) ? figurePath : heroPath;
  if (figureSource === heroPath) {
    console.log("未找到 figure.png，使用 hero.png 生成 figure.webp（后续可替换为透明背景版）");
  }

  const heroBuf = await readFile(heroPath);
  const figureBuf = await readFile(figureSource);

  const heroOut = join(OUT_DIR, "hero.webp");
  const figureOut = join(OUT_DIR, "figure.webp");

  await sharp(heroBuf)
    .resize(SIZES.hero.width, null, { withoutEnlargement: true })
    .webp({ quality: SIZES.hero.quality, alphaQuality: 100 })
    .toFile(heroOut);

  await sharp(figureBuf)
    .resize(SIZES.figure.width, null, { withoutEnlargement: true })
    .webp({ quality: SIZES.figure.quality, alphaQuality: 100 })
    .toFile(figureOut);

  console.log("已生成:", heroOut, figureOut);
}

optimize().catch((e) => {
  console.error(e);
  process.exit(1);
});
