export interface PixelStyle {
  id: string;
  name: string;
  prompt: string;
}

import pixelStyles from "../../../cloudrun/toutoutool-ai/pixel-styles.json";

export const PIXEL_STYLES = pixelStyles as PixelStyle[];
