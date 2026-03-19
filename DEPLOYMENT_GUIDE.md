# 拼豆工具 - 快速部署指南

## 🚀 5 分钟快速部署

### 前置要求

- Node.js >= 18
- npm 或 yarn
- Supabase 账号（免费）

---

## 步骤 1：克隆和安装

```bash
# 进入项目目录
cd toutoutool

# 安装依赖
npm install
```

---

## 步骤 2：配置 Supabase

### 2.1 创建数据库表

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 点击 **New Query**
5. 复制并粘贴 `supabase/migrations/create-bead-patterns.sql` 的全部内容
6. 点击 **Run** 执行

✅ 成功提示：你会看到 "拼豆工具数据库迁移完成！" 的消息

### 2.2 创建 Storage Bucket

1. 在 Supabase Dashboard，进入 **Storage**
2. 点击 **New bucket**
3. 填写：
   - Name: `bead-patterns`
   - Public: ❌ 不勾选（设为私有）
4. 点击 **Create bucket**

### 2.3 配置 Storage 策略

1. 在 Storage 页面，点击刚创建的 `bead-patterns` bucket
2. 进入 **Policies** 标签
3. 点击 **New policy**
4. 选择 **Create a policy from scratch**
5. 添加以下策略：

**策略 1：用户上传自己的文件**
```sql
Name: Users can upload their own patterns
Policy type: INSERT
Target roles: authenticated
Check expression: 
bucket_id = 'bead-patterns' AND 
(storage.foldername(name))[1] = auth.uid()::text
```

**策略 2：用户查看自己的文件**
```sql
Name: Users can view their own patterns
Policy type: SELECT
Target roles: authenticated
Using expression: 
bucket_id = 'bead-patterns' AND 
(storage.foldername(name))[1] = auth.uid()::text
```

**策略 3：用户删除自己的文件**
```sql
Name: Users can delete their own patterns
Policy type: DELETE
Target roles: authenticated
Using expression: 
bucket_id = 'bead-patterns' AND 
(storage.foldername(name))[1] = auth.uid()::text
```

---

## 步骤 3：配置环境变量

### 3.1 获取 Supabase 密钥

1. 在 Supabase Dashboard，进入 **Settings** -> **API**
2. 复制以下两个值：
   - Project URL
   - anon public key

### 3.2 创建/更新 `.env.local`

在项目根目录创建 `.env.local` 文件：

```env
# Supabase 配置（必填）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI 功能（可选）
# 如果需要 AI 生成功能，去 https://dashscope.console.aliyun.com/ 申请
DASHSCOPE_API_KEY=your-dashscope-api-key
```

---

## 步骤 4：启动和测试

```bash
# 启动开发服务器
npm run dev
```

访问 http://localhost:3000/tools/bead

### 测试清单

✅ **图片上传测试**
- [ ] 上传图片成功
- [ ] 预览显示正常
- [ ] 错误提示正确（如文件过大）

✅ **参数设置测试**
- [ ] 选择不同的网格大小
- [ ] 选择不同的颜色数量
- [ ] 切换色卡品牌
- [ ] 保持宽高比选项生效

✅ **图纸生成测试**
- [ ] 生成速度 < 2 秒
- [ ] 预览显示正确
- [ ] 色号可以显示/隐藏
- [ ] 统计报告准确

✅ **拼豆编辑器测试**
- [ ] 缩放功能正常
- [ ] 拖拽流畅
- [ ] 点击高亮同色豆子
- [ ] 右键标记完成
- [ ] 进度条更新
- [ ] CSV 导出成功

---

## 步骤 5：生产环境部署

### Vercel 部署（推荐）

1. 安装 Vercel CLI
```bash
npm i -g vercel
```

2. 登录 Vercel
```bash
vercel login
```

3. 部署
```bash
vercel --prod
```

4. 设置环境变量
   - 在 Vercel Dashboard 中添加 `.env.local` 中的变量

### 其他平台

- **Netlify**: 连接 GitHub 仓库，设置环境变量
- **Railway**: 一键部署模板
- **自建服务器**: `npm run build && npm start`

---

## 🔧 故障排查

### 问题 1：图片无法上传

**症状**: 点击上传没反应

**解决**:
- 检查文件大小是否超过 5MB
- 确认文件格式是 JPG/PNG/WebP
- 查看浏览器控制台错误信息

### 问题 2：生成的图纸空白

**症状**: 点击生成后预览区域空白

**解决**:
- 检查浏览器是否支持 Canvas API
- 尝试更换图片
- 查看控制台是否有错误

### 问题 3：色卡库加载失败

**症状**: 颜色数量为空或报错

**解决**:
- 检查 `color_library.json` 文件是否存在
- 确认 JSON 格式正确
- 重启开发服务器

### 问题 4：Supabase 连接失败

**症状**: 保存功能报错

**解决**:
- 检查 `.env.local` 配置是否正确
- 确认 Supabase 项目状态正常
- 检查数据库表是否创建成功

---

## 📊 性能优化建议

### 开发环境

- 使用 React DevTools 检查重渲染
- 开启 Source Map 便于调试
- 使用 ESLint 检查代码质量

### 生产环境

1. **启用缓存**
   ```next.config.mjs
   module.exports = {
    headers: async () => [
       {
         source: '/api/:path*',
        headers: [
           { key: 'Cache-Control', value: 'public, max-age=3600' }
         ]
       }
     ]
   }
   ```

2. **图片优化**
   - 使用 Next.js Image 组件
   - 启用 WebP 格式
   - 配置 CDN

3. **代码分割**
   - 动态导入大型组件
   - 移除未使用的依赖

---

## 🎯 下一步

部署完成后，你可以：

1. **邀请用户测试** - 分享链接给朋友
2. **收集反馈** - 了解用户需求
3. **持续迭代** - 根据反馈改进功能
4. **添加新功能** - AI 生成、图纸导入等

---

## 💡 使用技巧

### 给开发者

- 代码有详细的 JSDoc 注释
- 每个工具函数都有类型定义
- 组件采用原子设计模式
- 遵循 React 最佳实践

### 给最终用户

- 新手建议从 32×32 网格开始
- 选择 24 色平衡复杂度和效果
- 使用"保持宽高比"避免变形
- 导出 CSV 用于购买豆子清单

---

## 🆘 获取帮助

如果遇到问题：

1. 查看本指南的故障排查部分
2. 阅读 `BEAD_TOOL_GUIDE.md`
3. 检查浏览器控制台错误
4. 查看 Supabase 日志

---

**🎉 部署完成！开始享受你的拼豆创作之旅吧！**
