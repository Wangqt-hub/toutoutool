import {
  applyGridSizeOverride,
  detectGridGeometryFromPixels,
  recognizePatternColorsFromPixels,
} from "../src/lib/bead/patternImport";
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

function drawPseudoCode(
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
    top + Math.round(charHeight * 0.45),
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
    top + Math.round(charHeight * 0.45),
    charWidth + stroke,
    stroke,
    color
  );
}

function drawGrid(options: {
  rows: number;
  cols: number;
  cellSize: number;
  margin: number;
  expected: (number | null)[][];
  paletteRgb: RGB[];
}) {
  const minorLine = 1;
  const width = options.margin * 2 + options.cols * options.cellSize + (options.cols + 1) * minorLine;
  const height =
    options.margin * 2 + options.rows * options.cellSize + (options.rows + 1) * minorLine;
  const pixels = createPixels(width, height, { r: 250, g: 247, b: 238 });

  for (let col = 0; col <= options.cols; col += 1) {
    const gridX = options.margin + col * (options.cellSize + minorLine);
    fillRect(
      pixels,
      width,
      height,
      gridX,
      options.margin,
      1,
      height - options.margin * 2,
      { r: 216, g: 210, b: 196 }
    );
  }

  for (let row = 0; row <= options.rows; row += 1) {
    const gridY = options.margin + row * (options.cellSize + minorLine);
    fillRect(
      pixels,
      width,
      height,
      options.margin,
      gridY,
      width - options.margin * 2,
      1,
      { r: 216, g: 210, b: 196 }
    );
  }

  for (let row = 0; row < options.rows; row += 1) {
    for (let col = 0; col < options.cols; col += 1) {
      const paletteIndex = options.expected[row][col];
      const x = options.margin + 1 + col * (options.cellSize + 1);
      const y = options.margin + 1 + row * (options.cellSize + 1);

      if (paletteIndex === null) {
        continue;
      }

      const fill = options.paletteRgb[paletteIndex];
      fillRect(
        pixels,
        width,
        height,
        x,
        y,
        options.cellSize,
        options.cellSize,
        fill
      );

      const glyph =
        getLuminance(fill) > 165
          ? { r: 34, g: 34, b: 40 }
          : { r: 245, g: 245, b: 245 };
      drawPseudoCode(pixels, width, height, x, y, options.cellSize, glyph);
    }
  }

  return { pixels, width, height };
}

const palette = getPalette(48);
const samplePaletteIndices = [2, 8, 14, 22, 31]
  .map((index) => Math.min(index, palette.length - 1))
  .filter((value, index, all) => all.indexOf(value) === index);
const paletteRgb = samplePaletteIndices.map((index) => hexToRgb(palette[index].hex));
const rows = 10;
const cols = 12;
const expected: (number | null)[][] = Array.from({ length: rows }, (_, row) =>
  Array.from({ length: cols }, (_, col) => {
    if ((row + col) % 7 === 0) {
      return null;
    }

    return (row * 3 + col * 2) % paletteRgb.length;
  })
);

const grid = drawGrid({
  rows,
  cols,
  cellSize: 18,
  margin: 8,
  expected,
  paletteRgb,
});
const geometry = applyGridSizeOverride(
  detectGridGeometryFromPixels(grid),
  rows,
  cols
);
const result = recognizePatternColorsFromPixels({
  pixels: grid.pixels,
  width: grid.width,
  height: grid.height,
  brand: "MARD",
  colorCount: 48,
  geometry,
});

let mismatches = 0;

for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const expectedIndex = expected[row][col];
    const actual = result.cells[row][col];

    if (expectedIndex === null) {
      if (actual.state !== "empty") {
        mismatches += 1;
      }
      continue;
    }

    const expectedPaletteIndex = findClosestColor(paletteRgb[expectedIndex], result.palette);
    if (actual.state !== "filled" || actual.paletteIndex !== expectedPaletteIndex) {
      mismatches += 1;
    }
  }
}

if (mismatches === 0) {
  console.log("PASS color-recognition-with-glyphs");
} else {
  console.log(`FAIL color-recognition-with-glyphs: ${mismatches} mismatches`);
  process.exitCode = 1;
}
