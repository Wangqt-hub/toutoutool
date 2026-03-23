import { mapPixelsToClusteredGrid } from "../src/lib/bead/imageProcessor";
import { findClosestColor, getPalette, hexToRgb } from "../src/lib/bead/palette";

type RGB = {
  r: number;
  g: number;
  b: number;
};

function createPixels(width: number, height: number, color: RGB): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color.r;
    pixels[index + 1] = color.g;
    pixels[index + 2] = color.b;
    pixels[index + 3] = 255;
  }

  return pixels;
}

function setPixel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RGB
) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }

  const index = (y * width + x) * 4;
  pixels[index] = color.r;
  pixels[index + 1] = color.g;
  pixels[index + 2] = color.b;
  pixels[index + 3] = 255;
}

function fillRect(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  color: RGB
) {
  for (let row = y; row < y + rectHeight; row += 1) {
    for (let col = x; col < x + rectWidth; col += 1) {
      setPixel(pixels, width, height, col, row, color);
    }
  }
}

function getLuminance(color: RGB): number {
  return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

function drawGlyph(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  cellSize: number,
  color: RGB
) {
  const inset = Math.max(2, Math.round(cellSize * 0.2));
  const stroke = Math.max(1, Math.round(cellSize * 0.12));
  const charWidth = Math.max(4, Math.round(cellSize * 0.22));
  const charHeight = Math.max(7, Math.round(cellSize * 0.54));
  const gap = Math.max(2, Math.round(cellSize * 0.1));
  const left = x + inset;
  const top = y + inset;

  fillRect(pixels, width, height, left, top, stroke, charHeight, color);
  fillRect(
    pixels,
    width,
    height,
    left + charWidth,
    top,
    stroke,
    charHeight,
    color
  );
  fillRect(
    pixels,
    width,
    height,
    left,
    top + Math.round(charHeight * 0.48),
    charWidth + stroke,
    stroke,
    color
  );

  const secondLeft = left + charWidth + stroke + gap;
  fillRect(
    pixels,
    width,
    height,
    secondLeft,
    top,
    charWidth + stroke,
    stroke,
    color
  );
  fillRect(
    pixels,
    width,
    height,
    secondLeft + charWidth,
    top,
    stroke,
    charHeight,
    color
  );
  fillRect(
    pixels,
    width,
    height,
    secondLeft,
    top + Math.round(charHeight * 0.48),
    charWidth + stroke,
    stroke,
    color
  );
}

const palette = getPalette(48);
const sampleIndices = [2, 9, 17, 24, 31]
  .map((index) => Math.min(index, palette.length - 1))
  .filter((value, index, array) => array.indexOf(value) === index);
const paletteRgb = sampleIndices.map((index) => hexToRgb(palette[index].hex));
const rows = 8;
const cols = 10;
const cellSize = 18;
const width = cols * cellSize;
const height = rows * cellSize;
const pixels = createPixels(width, height, { r: 248, g: 246, b: 238 });
const expected: number[][] = Array.from({ length: rows }, (_, row) =>
  Array.from({ length: cols }, (_, col) => {
    return (row * 2 + col * 3) % paletteRgb.length;
  })
);

for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const paletteIndex = expected[row][col];
    const x = col * cellSize;
    const y = row * cellSize;

    const fill = paletteRgb[paletteIndex];
    fillRect(pixels, width, height, x, y, cellSize, cellSize, fill);

    const glyphColor =
      getLuminance(fill) > 170
        ? { r: 30, g: 30, b: 34 }
        : { r: 245, g: 245, b: 245 };
    drawGlyph(pixels, width, height, x, y, cellSize, glyphColor);
  }
}

const grid = mapPixelsToClusteredGrid(
  pixels,
  width,
  height,
  cols,
  rows,
  palette
);

let mismatches = 0;

for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const expectedIndex = expected[row][col];
    const actual = grid[row][col];
    const targetIndex = findClosestColor(paletteRgb[expectedIndex], palette);
    if (actual !== targetIndex) {
      mismatches += 1;
    }
  }
}

if (mismatches === 0) {
  console.log("PASS clustered-grid-dominant-color");
} else {
  console.log(`FAIL clustered-grid-dominant-color: ${mismatches} mismatches`);
  process.exitCode = 1;
}
