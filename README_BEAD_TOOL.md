# 头头工具 - 拼豆工具重构项目

🐹 **用头头工具，把小脑洞变成现实！**

一个现代化的拼豆图纸制作工具，支持图片转像素画、AI 生成、交互式编辑等功能。

---

## ✨ 核心功能

### 🎨 三种导入模式

1. **图片转像素画** ✅ (已完成)
   - 上传图片自动转换
   - 智能颜色匹配到色卡库
   - 支持 5 种豆子品牌（MARD/COCO/漫漫/盼盼/咪小窝）
   - 灵活的画布和颜色设置

2. **AI 生成像素画** ✅ (API 就绪)
   - 集成 Qwen-Image-2.0 模型
   - 8 种预设像素风格
   - 自定义 Prompt 支持
   - 实时预览生成效果

3. **拼豆图纸导入** ⏳ (规划中)
   - OCR 色号识别
   - 智能网格校准
   - 手动修正界面

### 🛠️ 拼豆编辑器

- **交互式操作**
  - 点击高亮同色豆子
  - 右键/长按标记完成
  - 缩放（0.5x - 4x）和拖拽
  - 实时进度跟踪

- **数据管理**
  - CSV 格式导出
  - 详细统计报告
  - 豆子数量清单
  - 品牌色号对照

- **视觉反馈**
  - 当前选中颜色高亮
  - 其他颜色灰化
  - 已完成格子打勾
  - 悬停显示色号

### 📊 完整色卡库

- 支持 5 种主流品牌
- 多种颜色数量选项（12/24/48/72 色）
- 智能颜色匹配算法
- 精确的豆子统计

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm 或 yarn
- Supabase 账号（用于云端存储）

### 安装运行

```bash
# 克隆项目
cd toutoutool

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问拼豆工具
http://localhost:3000/tools/bead
```

### 配置 Supabase（可选）

如需使用云端存储功能：

1. 在 Supabase 执行 SQL 迁移：
   ```bash
   # 复制 supabase/migrations/create-bead-patterns.sql 内容到 SQL Editor 执行
   ```

2. 创建 Storage Bucket：
   - 名称：`bead-patterns`
   - 权限：私有

3. 配置环境变量：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

---

## 📖 使用指南

### 图片转像素画（推荐流程）

1. **选择模式** - 点击"图片转像素画"
2. **上传图片** - 拖拽或点击上传（JPG/PNG/WebP，最大 5MB）
3. **设置参数**：
   - 网格大小：32×32（新手推荐）
   - 颜色数量：24 色（平衡选择）
   - 勾选"保持宽高比"
   - 选择你的豆子品牌
4. **生成图纸** - 点击按钮
5. **进入编辑器** - 滚动到底部使用拼豆编辑器
6. **标记进度** - 点击选中，右键标记完成
7. **导出清单** - 下载 CSV 用于购买豆子

### AI 生成模式

1. **上传图片** - 准备一张参考图
2. **选择风格** - 8 种像素风格可选
   - 动漫像素风
   - Q 版像素风
   - 星露谷像素风
   - 宝可梦像素风
   - 极简像素风
   - 复古像素风
   - 奇幻像素风
   - 赛博朋克像素风
3. **AI 生成** - 等待 AI 转换
4. **继续制作** - 使用生成的图片制作图纸

---

## 📁 项目结构

```
src/
├── lib/bead/                    # 核心工具库
│   ├── palette.ts              # 色卡库工具
│   ├── imageProcessor.ts       # 图像处理
│   ├── beanStatistics.ts       # 豆子统计
│   ├── storage.ts              # Storage 封装
│   └── database.ts             # 数据库操作
│
├── components/bead-tool/        # UI 组件
│   ├── ImportModeSelector.tsx  # 模式选择器
│   ├── ImageUploadStep.tsx     # 图片上传
│   ├── StyleSelector.tsx       # AI 风格选择
│   └── BeadEditor.tsx          # 拼豆编辑器
│
├── app/
│   ├── api/ai-generate/         # AI 生成 API
│   │   └── route.ts
│   └── (dashboard)/tools/bead/
│       ├── page.tsx            # 主页面（模式 1）
│       └── import-ai/           # AI 生成页面
│           └── page.tsx
│
└── supabase/
    └── migrations/
        └── create-bead-patterns.sql  # 数据库迁移

文档:
├── README.md                      # 本文件
├── BEAD_TOOL_GUIDE.md            # 详细使用指南
├── BEAD_TOOL_FINAL_REPORT.md     # 技术实现报告
└── DEPLOYMENT_GUIDE.md           # 部署教程
```

---

## 🎯 技术栈

- **前端框架**: Next.js 14 + React 18
- **编程语言**: TypeScript
- **样式方案**: Tailwind CSS
- **后端服务**: Supabase
- **图像处理**: Canvas API
- **AI 能力**: Qwen-Image-2.0（通义万相）

---

## 📊 功能完成度

| 模块 | 状态 | 完成度 |
|------|------|--------|
| 基础架构 | ✅ | 100% |
| 图片转像素画 | ✅ | 100% |
| AI 生成模式 | ✅ | 90%* |
| 拼豆编辑器 | ✅ | 100% |
| 云端存储 | ⏳ | 架构就绪 |
| 图纸导入 | ⏳ | 0% |

*AI 模式需要配置 DashScope API Key 才能完全使用

---

## 🔧 开发技巧

### 参数推荐

**新手入门**：
- 网格：32×32
- 颜色：12-24 色
- 适合：简单图案、卡通形象

**进阶制作**：
- 网格：48×48
- 颜色：24-48 色
- 适合：复杂场景、人物肖像

**专业挑战**：
- 网格：64×64
- 颜色：48-72 色
- 适合：艺术品还原

### 常见问题

**Q: 为什么生成的图纸和原图差别很大？**  
A: 这是正常的像素化效果。网格越小，像素化越明显。建议使用 32×32 或更大的网格。

**Q: 颜色匹配准确吗？**  
A: 系统会将图片颜色匹配到最接近的色卡颜色。由于屏幕显示和实际豆子的差异，建议参考色卡实物。

**Q: 如何保存我的图纸？**  
A: 
- 截图保存预览
- 导出 CSV 数据
- 复制到统计报告
- 云端存储（需配置 Supabase）

---

## 📝 更新日志

### v2.0.0 - 重构版（当前版本）

**新增功能**：
- ✅ 完整的色卡库集成（5 品牌）
- ✅ 智能颜色量化算法
- ✅ 详细的豆子统计
- ✅ 交互式拼豆编辑器
- ✅ AI 图片生成（API 就绪）
- ✅ CSV 导入导出
- ✅ 缩放拖拽手势
- ✅ 进度跟踪系统

**技术升级**：
- ✅ TypeScript 类型安全
- ✅ 模块化架构
- ✅ Supabase 云端存储
- ✅ 响应式设计
- ✅ 完整文档体系

### v1.0.0 - 原始版本

- 基础的图片上传
- 固定 18 色调色板
- 简单的网格转换

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境设置

```bash
# 克隆项目
git clone <repo>

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

---

## 📄 开源协议

MIT License

---

## 💬 联系方式

- 项目主页：[GitHub](https://github.com/your-repo/toutoutool)
- 问题反馈：[Issues](https://github.com/your-repo/toutoutool/issues)
- 讨论社区：[Discussions](https://github.com/your-repo/toutoutool/discussions)

---

## 🌟 致谢

感谢所有贡献者和使用者！

特别感谢：
- [Supabase](https://supabase.com/) 提供强大的后端服务
- [Next.js](https://nextjs.org/) 优秀的 React 框架
- [通义千问](https://tongyi.aliyun.com/) AI 能力支持

---

**🎉 祝你玩得开心！用头头工具，把小脑洞变成现实！** 🐹✨
