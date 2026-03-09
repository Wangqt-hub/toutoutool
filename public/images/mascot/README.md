# 吉祥物图片资源

## 目录结构

```
mascot/
├── source/          # 源图（PNG，可含透明通道）
│   ├── hero.png     # 主视觉：引导页等大图，可有背景
│   └── figure.png   # 纯形象：导航/侧栏等，需透明背景（仅宝宝）
├── hero.webp       # 由脚本生成，用于 hero 场景
├── figure.webp     # 由脚本生成，用于 figure 场景
└── README.md
```

## 使用方式

1. **替换图片**：将新图放入 `source/` 对应文件
   - `hero.png`：主视觉，可带背景
   - `figure.png`：仅宝宝形象、透明背景（若不存在则用 hero.png 生成）

2. **生成 WebP**：运行 `npm run optimize:mascot`

3. **后续扩展**：提供更多同风格图片时，可扩展 `source/` 与脚本，在组件中按场景选用
