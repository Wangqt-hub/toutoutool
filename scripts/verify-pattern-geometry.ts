import { detectGridGeometryFromPixels } from "../src/lib/bead/patternImport";

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

function drawPseudoCode(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  cellSize: number,
  color: RGB
) {
  const inset = Math.max(2, Math.round(cellSize * 0.22));
  const stroke = Math.max(1, Math.round(cellSize * 0.12));
  const half = Math.max(2, Math.round(cellSize * 0.46));
  const charGap = Math.max(2, Math.round(cellSize * 0.1));
  const charWidth = Math.max(4, Math.round(cellSize * 0.24));
  const charHeight = Math.max(6, Math.round(cellSize * 0.52));
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

  const secondLeft = left + charWidth + stroke + charGap;
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
    Math.round(charHeight * 0.54),
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
  fillRect(
    pixels,
    width,
    height,
    secondLeft,
    top + charHeight - stroke,
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
  baseColor: RGB;
  minorLineColor: RGB;
  majorLineColor?: RGB;
  majorEvery?: number;
  filledCell: (row: number, col: number) => RGB | null;
  glyphColor?: RGB;
}) {
  const minorLine = 1;
  const width = options.margin * 2 + options.cols * options.cellSize + (options.cols + 1) * minorLine;
  const height =
    options.margin * 2 + options.rows * options.cellSize + (options.rows + 1) * minorLine;
  const pixels = createPixels(width, height, options.baseColor);
  const majorEvery = options.majorEvery ?? 0;

  for (let col = 0; col <= options.cols; col += 1) {
    const gridX = options.margin + col * (options.cellSize + minorLine);
    const isMajor = majorEvery > 0 && col % majorEvery === 0;
    const thickness = isMajor ? 2 : 1;
    fillRect(
      pixels,
      width,
      height,
      gridX,
      options.margin,
      thickness,
      height - options.margin * 2,
      isMajor && options.majorLineColor ? options.majorLineColor : options.minorLineColor
    );
  }

  for (let row = 0; row <= options.rows; row += 1) {
    const gridY = options.margin + row * (options.cellSize + minorLine);
    const isMajor = majorEvery > 0 && row % majorEvery === 0;
    const thickness = isMajor ? 2 : 1;
    fillRect(
      pixels,
      width,
      height,
      options.margin,
      gridY,
      width - options.margin * 2,
      thickness,
      isMajor && options.majorLineColor ? options.majorLineColor : options.minorLineColor
    );
  }

  for (let row = 0; row < options.rows; row += 1) {
    for (let col = 0; col < options.cols; col += 1) {
      const fill = options.filledCell(row, col);
      const x = options.margin + 1 + col * (options.cellSize + 1);
      const y = options.margin + 1 + row * (options.cellSize + 1);

      if (!fill) {
        continue;
      }

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

      if (options.glyphColor) {
        drawPseudoCode(
          pixels,
          width,
          height,
          x,
          y,
          options.cellSize,
          options.glyphColor
        );
      }
    }
  }

  return { pixels, width, height };
}

function verifyCase(name: string, input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}, expected: { rows: number; cols: number }) {
  const geometry = detectGridGeometryFromPixels(input);
  const result = {
    rows: geometry.rowCount,
    cols: geometry.colCount,
  };

  const pass = result.rows === expected.rows && result.cols === expected.cols;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${name}: expected ${expected.rows}x${expected.cols}, got ${result.rows}x${result.cols}`
  );

  if (!pass) {
    process.exitCode = 1;
  }
}

const denseCase = drawGrid({
  rows: 44,
  cols: 44,
  cellSize: 17,
  margin: 6,
  baseColor: { r: 251, g: 248, b: 238 },
  minorLineColor: { r: 226, g: 219, b: 205 },
  filledCell: (row, col) => {
    const inFigure =
      (row - 21) * (row - 21) * 1.15 + (col - 22) * (col - 22) < 180 ||
      (row > 28 && row < 38 && Math.abs(col - 22) < 8);

    if (!inFigure) {
      return { r: 250, g: 247, b: 235 };
    }

    const palette = [
      { r: 33, g: 33, b: 42 },
      { r: 242, g: 182, b: 76 },
      { r: 234, g: 101, b: 113 },
      { r: 91, g: 131, b: 197 },
      { r: 238, g: 232, b: 218 },
    ];

    return palette[(row + col) % palette.length];
  },
  glyphColor: { r: 42, g: 42, b: 42 },
});

const sparseCase = drawGrid({
  rows: 78,
  cols: 58,
  cellSize: 15,
  margin: 8,
  baseColor: { r: 255, g: 255, b: 255 },
  minorLineColor: { r: 224, g: 223, b: 232 },
  majorLineColor: { r: 196, g: 189, b: 233 },
  majorEvery: 10,
  filledCell: (row, col) => {
    const head = (row - 16) * (row - 16) / 180 + (col - 28) * (col - 28) / 220 < 1;
    const body = row >= 26 && row <= 52 && Math.abs(col - 29) <= 7;
    const leftArm = row >= 28 && row <= 49 && Math.abs(col - (16 + Math.floor((row - 28) * 0.2))) <= 3;
    const rightArm = row >= 28 && row <= 49 && Math.abs(col - (42 - Math.floor((row - 28) * 0.15))) <= 3;
    const leftLeg = row >= 50 && row <= 76 && Math.abs(col - (24 - Math.floor((row - 50) * 0.2))) <= 4;
    const rightLeg = row >= 50 && row <= 76 && Math.abs(col - (34 + Math.floor((row - 50) * 0.18))) <= 4;
    const inFigure = head || body || leftArm || rightArm || leftLeg || rightLeg;

    if (!inFigure) {
      return null;
    }

    const palette = [
      { r: 30, g: 32, b: 42 },
      { r: 248, g: 224, b: 108 },
      { r: 208, g: 183, b: 166 },
      { r: 103, g: 108, b: 122 },
      { r: 166, g: 184, b: 92 },
      { r: 245, g: 242, b: 236 },
    ];

    return palette[(row * 3 + col * 2) % palette.length];
  },
  glyphColor: { r: 28, g: 28, b: 32 },
});

verifyCase("dense-coded-grid", denseCase, { rows: 44, cols: 44 });
verifyCase("sparse-grid-with-empty-margin", sparseCase, { rows: 78, cols: 58 });

const textOnlyCase = (() => {
  const rows = 44;
  const cols = 44;
  const cellSize = 17;
  const margin = 6;
  const width = margin * 2 + cols * cellSize;
  const height = margin * 2 + rows * cellSize;
  const pixels = createPixels(width, height, { r: 251, g: 248, b: 238 });

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const inFigure =
        (row - 21) * (row - 21) * 1.15 + (col - 22) * (col - 22) < 180 ||
        (row > 28 && row < 38 && Math.abs(col - 22) < 8);
      const x = margin + col * cellSize;
      const y = margin + row * cellSize;

      if (inFigure) {
        const palette = [
          { r: 33, g: 33, b: 42 },
          { r: 242, g: 182, b: 76 },
          { r: 234, g: 101, b: 113 },
          { r: 91, g: 131, b: 197 },
          { r: 238, g: 232, b: 218 },
        ];

        fillRect(
          pixels,
          width,
          height,
          x + 1,
          y + 1,
          cellSize - 2,
          cellSize - 2,
          palette[(row + col) % palette.length]
        );
      }

      drawPseudoCode(
        pixels,
        width,
        height,
        x,
        y,
        cellSize,
        { r: 42, g: 42, b: 42 }
      );
    }
  }

  return { pixels, width, height };
})();

verifyCase("text-only-coded-grid", textOnlyCase, { rows: 44, cols: 44 });
