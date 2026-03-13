/**
 * AI 像素风格定义
 */

export interface PixelStyle {
  id: string;
  name: string;
  prompt: string;
}

export const PIXEL_STYLES: PixelStyle[] = [
  { 
    id: 'anime', 
    name: '动漫像素风', 
    prompt: 'pixel art, anime style, vibrant colors, clean lines, 16-bit aesthetic' 
  },
  { 
    id: 'chibi', 
    name: 'Q 版像素风', 
    prompt: 'pixel art, chibi style, cute, big head, small body, kawaii' 
  },
  { 
    id: 'stardew', 
    name: '星露谷像素风', 
    prompt: 'pixel art, Stardew Valley style, farming game aesthetic, cozy' 
  },
  { 
    id: 'pokemon', 
    name: '宝可梦像素风', 
    prompt: 'pixel art, Pokemon style, 16-bit, game boy aesthetic, nostalgic' 
  },
  { 
    id: 'minimalist', 
    name: '极简像素风', 
    prompt: 'pixel art, minimalist, simple colors, clean design, modern' 
  },
  { 
    id: 'retro', 
    name: '复古像素风', 
    prompt: 'pixel art, retro 8-bit, vintage game style, limited color palette' 
  },
  { 
    id: 'fantasy', 
    name: '奇幻像素风', 
    prompt: 'pixel art, fantasy style, magical, enchanted, mystical atmosphere' 
  },
  { 
    id: 'cyberpunk', 
    name: '赛博朋克像素风', 
    prompt: 'pixel art, cyberpunk, neon colors, futuristic, high tech' 
  }
];
