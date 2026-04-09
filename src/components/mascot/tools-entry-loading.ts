import type { LoadingStorySlide } from "@/lib/loading-story-presets";

export const toolsEntryLoadingSlides: LoadingStorySlide[] = [
  {
    id: "dashboard-loading-01",
    eyebrow: "Tools",
    tag: "工具页",
    status: "工具入口准备中",
    headline: "正在整理工具入口",
    body: "常用入口和页面层级正在就位。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静表情",
    accent: "#F3CDBB",
    accentSoft: "#FFF2EA",
    glow: "rgba(233, 154, 107, 0.22)"
  },
  {
    id: "dashboard-loading-02",
    eyebrow: "Tools",
    tag: "资源",
    status: "工具资源对齐中",
    headline: "正在接入工具资源",
    body: "入口卡片、导航信息和会话数据正在对齐。",
    image: "/loading-lab/emoji-heads/emoji_05.png",
    alt: "酷酷表情",
    accent: "#C9DDF6",
    accentSoft: "#EFF6FF",
    glow: "rgba(111, 157, 219, 0.2)"
  },
  {
    id: "dashboard-loading-03",
    eyebrow: "Tools",
    tag: "完成",
    status: "工具页即将就绪",
    headline: "马上带你进入工具页",
    body: "最后一点点收尾完成后就会显示完整内容。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心表情",
    accent: "#F6D9A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 189, 88, 0.24)"
  }
];

export const TOOLS_ENTRY_AUTOPLAY_MS = 4400;
export const TOOLS_ENTRY_MIN_DISPLAY_MS = 2500;
export const TOOLS_ENTRY_FADE_MS = 240;
