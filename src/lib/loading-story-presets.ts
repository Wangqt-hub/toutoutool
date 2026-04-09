export interface LoadingStorySlide {
  id: string;
  eyebrow: string;
  tag: string;
  status: string;
  headline: string;
  body: string;
  image: string;
  alt: string;
  accent: string;
  accentSoft: string;
  glow: string;
}

export interface LoadingStoryPreset {
  name: string;
  summary: string;
  loopLabel: string;
  notes: string;
  slides: LoadingStorySlide[];
}

const generalSlides: LoadingStorySlide[] = [
  {
    id: "general-01",
    eyebrow: "Scene 01",
    tag: "预热",
    status: "页面预热中",
    headline: "先把小舞台收拾好",
    body: "标题、按钮和留白会先安顿好，再把真正内容轻轻推上来。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑的表情",
    accent: "#F3CDBB",
    accentSoft: "#FFF2EA",
    glow: "rgba(233, 154, 107, 0.22)"
  },
  {
    id: "general-02",
    eyebrow: "Scene 02",
    tag: "欢迎",
    status: "欢迎动画播放中",
    headline: "欢迎回来，今天也顺着来",
    body: "用熟悉的表情先接住用户，页面还没齐，也不会显得突然。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心大笑的表情",
    accent: "#F6D9A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 189, 88, 0.24)"
  },
  {
    id: "general-03",
    eyebrow: "Scene 03",
    tag: "检查",
    status: "流程检查中",
    headline: "看看这一步要拿什么",
    body: "适合放在登录校验、参数判断、草稿恢复这类有思考感的节点。",
    image: "/loading-lab/emoji-heads/emoji_04.png",
    alt: "托腮思考的表情",
    accent: "#D7E6C7",
    accentSoft: "#F5F9EF",
    glow: "rgba(137, 177, 107, 0.22)"
  },
  {
    id: "general-04",
    eyebrow: "Scene 04",
    tag: "排队",
    status: "资源准备中",
    headline: "本地资源已经排好队",
    body: "图标、提示文案和下一屏素材都能提前到位，轮播切换会更稳。",
    image: "/loading-lab/emoji-heads/emoji_05.png",
    alt: "戴墨镜的酷表情",
    accent: "#C9DDF6",
    accentSoft: "#EFF6FF",
    glow: "rgba(111, 157, 219, 0.2)"
  },
  {
    id: "general-05",
    eyebrow: "Scene 05",
    tag: "衔接",
    status: "过场准备中",
    headline: "视觉过场已经准备接棒",
    body: "当你需要把上一页和下一页柔和地接起来，这种轻量轮播会比骨架屏更有记忆点。",
    image: "/loading-lab/emoji-heads/emoji_07.png",
    alt: "眨眼吐舌的表情",
    accent: "#F7D1DD",
    accentSoft: "#FFF0F4",
    glow: "rgba(226, 126, 153, 0.18)"
  },
  {
    id: "general-06",
    eyebrow: "Scene 06",
    tag: "等待",
    status: "后台处理中",
    headline: "后台在安静做事",
    body: "适合放在真正的异步阶段，告诉用户系统还在线，而且没有卡住。",
    image: "/loading-lab/emoji-heads/emoji_06.png",
    alt: "打瞌睡的表情",
    accent: "#D9D5F5",
    accentSoft: "#F5F2FF",
    glow: "rgba(151, 138, 223, 0.18)"
  },
  {
    id: "general-07",
    eyebrow: "Scene 07",
    tag: "缓冲",
    status: "复杂内容处理中",
    headline: "如果这次内容稍多，就再等半秒",
    body: "偶尔出现的小等待，也能被表情接住，不至于让人误以为页面失灵。",
    image: "/loading-lab/emoji-heads/emoji_03.png",
    alt: "委屈难过的表情",
    accent: "#E3D7CE",
    accentSoft: "#FAF4F0",
    glow: "rgba(170, 131, 104, 0.16)"
  },
  {
    id: "general-08",
    eyebrow: "Scene 08",
    tag: "冲刺",
    status: "最后收尾中",
    headline: "最后一小段，我帮你催一下",
    body: "把最慢的一瞬间做成可感知的情绪切换，等待会显得更短。",
    image: "/loading-lab/emoji-heads/emoji_02.png",
    alt: "哭泣流泪的表情",
    accent: "#F6C9BE",
    accentSoft: "#FFF1EC",
    glow: "rgba(232, 137, 120, 0.24)"
  }
];

const aiSlides: LoadingStorySlide[] = [
  {
    id: "ai-01",
    eyebrow: "Prompt 01",
    tag: "理解",
    status: "正在读懂你的需求",
    headline: "先把你的意思吃透",
    body: "提示词、上下文和语气要求会先过一遍，结果会更像你想要的方向。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑的表情",
    accent: "#F7D7BA",
    accentSoft: "#FFF5EA",
    glow: "rgba(232, 159, 104, 0.18)"
  },
  {
    id: "ai-02",
    eyebrow: "Prompt 02",
    tag: "拆解",
    status: "正在拆解提示词",
    headline: "把需求拆成可执行片段",
    body: "适合放在长提示词、图像分析或多步骤任务的最前面。",
    image: "/loading-lab/emoji-heads/emoji_04.png",
    alt: "托腮思考的表情",
    accent: "#D8E8CB",
    accentSoft: "#F3FAEE",
    glow: "rgba(132, 177, 114, 0.22)"
  },
  {
    id: "ai-03",
    eyebrow: "Prompt 03",
    tag: "打磨",
    status: "正在挑选表达方式",
    headline: "结构、语气和重点开始排位",
    body: "把 AI 的“正在思考”做成可见的过程，会比空白等待更让人安心。",
    image: "/loading-lab/emoji-heads/emoji_05.png",
    alt: "戴墨镜的酷表情",
    accent: "#D2E2F9",
    accentSoft: "#EEF6FF",
    glow: "rgba(109, 158, 232, 0.2)"
  },
  {
    id: "ai-04",
    eyebrow: "Prompt 04",
    tag: "起稿",
    status: "第一版草稿生成中",
    headline: "第一版草稿已经开写",
    body: "这时轮播可以继续走，但文案会告诉用户结果不是停住，而是在成形。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心大笑的表情",
    accent: "#F6DB9E",
    accentSoft: "#FFF8E2",
    glow: "rgba(236, 197, 99, 0.24)"
  },
  {
    id: "ai-05",
    eyebrow: "Prompt 05",
    tag: "运转",
    status: "模型正在处理中",
    headline: "模型正在咕噜咕噜转",
    body: "适合放在真正耗时的 AI 节点，让等待看起来像是在被认真消化。",
    image: "/loading-lab/emoji-heads/emoji_06.png",
    alt: "打瞌睡的表情",
    accent: "#DED7F8",
    accentSoft: "#F6F2FF",
    glow: "rgba(156, 138, 224, 0.2)"
  },
  {
    id: "ai-06",
    eyebrow: "Prompt 06",
    tag: "复杂",
    status: "复杂请求加长处理中",
    headline: "这次要求有点多，我多想一会",
    body: "当任务确实会慢一点，先说清楚比纯粹旋转等待更友好。",
    image: "/loading-lab/emoji-heads/emoji_03.png",
    alt: "委屈难过的表情",
    accent: "#E9D9CF",
    accentSoft: "#FBF4EE",
    glow: "rgba(173, 137, 108, 0.16)"
  },
  {
    id: "ai-07",
    eyebrow: "Prompt 07",
    tag: "长文本",
    status: "正在收束长内容",
    headline: "长文本我继续抱着跑",
    body: "大段内容、复杂表格或多图处理时，这一帧会显得格外贴切。",
    image: "/loading-lab/emoji-heads/emoji_02.png",
    alt: "哭泣流泪的表情",
    accent: "#F7CCC0",
    accentSoft: "#FFF2EE",
    glow: "rgba(236, 140, 118, 0.22)"
  },
  {
    id: "ai-08",
    eyebrow: "Prompt 08",
    tag: "交付",
    status: "结果即将出现",
    headline: "好啦，马上把结果递给你",
    body: "最后用轻松一点的表情收口，能把 AI 结果的出现做得更有期待感。",
    image: "/loading-lab/emoji-heads/emoji_07.png",
    alt: "眨眼吐舌的表情",
    accent: "#F7D2DE",
    accentSoft: "#FFF1F6",
    glow: "rgba(227, 124, 160, 0.2)"
  }
];

const transitionSlides: LoadingStorySlide[] = [
  {
    id: "transition-01",
    eyebrow: "Transition 01",
    tag: "退场",
    status: "上一屏轻退中",
    headline: "上一页先轻轻往后退",
    body: "适合用于点击进入详情、切换工具页、切换步骤页时的第一拍。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心大笑的表情",
    accent: "#F5D8A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 185, 84, 0.22)"
  },
  {
    id: "transition-02",
    eyebrow: "Transition 02",
    tag: "补位",
    status: "下一屏补位中",
    headline: "下一页在背后慢慢补位",
    body: "把过场说成一个动作，用户会知道系统正在切，而不是突然空白。",
    image: "/loading-lab/emoji-heads/emoji_04.png",
    alt: "托腮思考的表情",
    accent: "#D6E8D2",
    accentSoft: "#F4FAF0",
    glow: "rgba(130, 176, 114, 0.2)"
  },
  {
    id: "transition-03",
    eyebrow: "Transition 03",
    tag: "同步",
    status: "视觉同步中",
    headline: "标题、按钮和节奏一起同步",
    body: "不需要大动画，只要文字和表情有节奏地轮换，页面就会显得更完整。",
    image: "/loading-lab/emoji-heads/emoji_05.png",
    alt: "戴墨镜的酷表情",
    accent: "#CBDEF7",
    accentSoft: "#EEF6FF",
    glow: "rgba(111, 158, 220, 0.18)"
  },
  {
    id: "transition-04",
    eyebrow: "Transition 04",
    tag: "缓冲",
    status: "切场缓冲中",
    headline: "先让用户知道系统还在线",
    body: "当数据、图片或复杂组件尚未齐全，这句说明能把焦虑感压下来。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑的表情",
    accent: "#F3CDBC",
    accentSoft: "#FFF3EB",
    glow: "rgba(234, 157, 114, 0.18)"
  },
  {
    id: "transition-05",
    eyebrow: "Transition 05",
    tag: "填充",
    status: "数据填充中",
    headline: "等内容把留白慢慢填满",
    body: "如果目标页内容较重，可以让这段动画接住最慢的那一截。",
    image: "/loading-lab/emoji-heads/emoji_06.png",
    alt: "打瞌睡的表情",
    accent: "#DDD7F7",
    accentSoft: "#F5F2FF",
    glow: "rgba(152, 141, 227, 0.2)"
  },
  {
    id: "transition-06",
    eyebrow: "Transition 06",
    tag: "接口",
    status: "接口等待中",
    headline: "如果接口慢一点，也别让情绪断掉",
    body: "比起生硬的转圈，这种表情轮播更像是在陪用户一起等。",
    image: "/loading-lab/emoji-heads/emoji_03.png",
    alt: "委屈难过的表情",
    accent: "#E7D8CC",
    accentSoft: "#FAF4EF",
    glow: "rgba(173, 137, 105, 0.16)"
  },
  {
    id: "transition-07",
    eyebrow: "Transition 07",
    tag: "陪等",
    status: "等待情绪接管中",
    headline: "这一秒有点长，就让表情替你说话",
    body: "把等待做成情绪化的过场，会让站点更有自己的个性。",
    image: "/loading-lab/emoji-heads/emoji_02.png",
    alt: "哭泣流泪的表情",
    accent: "#F7CBBE",
    accentSoft: "#FFF2ED",
    glow: "rgba(232, 139, 118, 0.22)"
  },
  {
    id: "transition-08",
    eyebrow: "Transition 08",
    tag: "登场",
    status: "目标页面就位中",
    headline: "切过去吧，结果到了",
    body: "最后一帧用轻松一点的表情收口，很适合接正式内容的登场。",
    image: "/loading-lab/emoji-heads/emoji_07.png",
    alt: "眨眼吐舌的表情",
    accent: "#F7D0DF",
    accentSoft: "#FFF0F6",
    glow: "rgba(225, 125, 157, 0.18)"
  }
];

export const loadingStoryPresets = {
  general: {
    name: "通用轻加载",
    summary:
      "适合登录恢复、页面预热、模块切换等通用场景，用柔和情绪把短等待变得更自然。",
    loopLabel: "全屏加载预览",
    notes: "推荐先看这一组，最接近通用站内加载或过场的感觉。",
    slides: generalSlides
  },
  ai: {
    name: "AI 生成中",
    summary:
      "把“模型正在思考”做成可感知的连续过程，适合文本生成、图像处理或复杂分析任务。",
    loopLabel: "AI 生成预览",
    notes: "这一组更适合耗时稍长的任务，文案会更像系统在认真处理。",
    slides: aiSlides
  },
  transition: {
    name: "结果页过场",
    summary:
      "更偏过场动线，适合从列表进入详情、从表单进入结果页，或者从步骤 A 平滑切到步骤 B。",
    loopLabel: "结果过场预览",
    notes: "这一组强调“切页”而不是“等待”，更适合站内过渡体验。",
    slides: transitionSlides
  }
} satisfies Record<string, LoadingStoryPreset>;

export type LoadingStoryPresetKey = keyof typeof loadingStoryPresets;
