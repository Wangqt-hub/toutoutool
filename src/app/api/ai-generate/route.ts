/**
 * AI 图片生成 API Route
 * 使用 Qwen-Image-2.0（通义万相）进行图生图
 */

import { NextRequest, NextResponse } from 'next/server';
import { PIXEL_STYLES } from '@/lib/bead/pixelStyles';

export async function POST(request: NextRequest) {
  try {
   const { imageUrl, styleId, customPrompt } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: '缺少图片 URL' },
        { status: 400 }
      );
    }

    // 检查是否有 API Key
   const apiKey = process.env.DASHSCOPE_API_KEY;
    
    // 如果没有配置 API Key，返回模拟数据用于测试
    if (!apiKey) {
     console.warn('未配置 DASHSCOPE_API_KEY，返回模拟数据');
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 返回原图 URL（实际使用时应该调用真实的 AI API）
      return NextResponse.json({
        success: true,
        data: {
         imageUrl: imageUrl, // 实际应返回 AI 生成的图片 URL
          style: PIXEL_STYLES.find(s => s.id === styleId)?.name || '自定义',
          message: '演示模式：未配置 API Key，返回原图。请在 .env.local 中配置 DASHSCOPE_API_KEY'
        }
      });
    }

    // 获取风格提示词
   const selectedStyle = PIXEL_STYLES.find(s => s.id === styleId);
   const finalPrompt = customPrompt || selectedStyle?.prompt || 'pixel art style';

    // 调用通义万相 API
   const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation', {
      method: 'POST',
     headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'disable' // 同步调用
      },
      body: JSON.stringify({
        model: 'wanx-v1',
        input: {
         image: imageUrl,
          prompt: finalPrompt
        },
       parameters: {
          style: '<auto>',
          size: '1024*1024',
         n: 1,
          seed: Math.floor(Math.random() * 1000000)
        }
      })
    });

    if (!response.ok) {
     const errorData = await response.json();
      throw new Error(errorData.message || 'AI 生成失败');
    }

   const result = await response.json();

    // 提取生成的图片 URL
   const generatedImageUrl = result.output?.results?.[0]?.url;

    if (!generatedImageUrl) {
      throw new Error('未获取到生成的图片 URL');
    }

    return NextResponse.json({
      success: true,
      data: {
       imageUrl: generatedImageUrl,
        style: selectedStyle?.name || '自定义',
        prompt: finalPrompt
      }
    });

  } catch (error) {
   console.error('AI 生成错误:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message: 'AI 生成失败，请稍后再试',
        success: false
      },
      { status: 500 }
    );
  }
}
