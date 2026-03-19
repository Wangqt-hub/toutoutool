import { NextRequest, NextResponse } from "next/server";
import { PIXEL_STYLES } from "@/lib/bead/pixelStyles";

export const runtime = "nodejs";

type ParsedPayload = {
  imageInput: string | null;
  previewImageUrl: string | null;
  styleId: string;
  customPrompt: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function parseRequestPayload(
  request: NextRequest
): Promise<ParsedPayload> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const image = formData.get("image");
    const styleId = String(formData.get("styleId") || "");
    const customPrompt = String(formData.get("customPrompt") || "");

    if (!(image instanceof File) || image.size === 0) {
      return {
        imageInput: null,
        previewImageUrl: null,
        styleId,
        customPrompt,
      };
    }

    const dataUrl = await fileToDataUrl(image);

    return {
      imageInput: dataUrl,
      previewImageUrl: dataUrl,
      styleId,
      customPrompt,
    };
  }

  const { imageUrl, styleId, customPrompt } = await request.json();

  return {
    imageInput: typeof imageUrl === "string" ? imageUrl : null,
    previewImageUrl: typeof imageUrl === "string" ? imageUrl : null,
    styleId: typeof styleId === "string" ? styleId : "",
    customPrompt: typeof customPrompt === "string" ? customPrompt : "",
  };
}

async function readDashScopeError(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return "AI generation failed.";
  }

  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.code || text;
  } catch {
    return text;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageInput, previewImageUrl, styleId, customPrompt } =
      await parseRequestPayload(request);

    if (!imageInput) {
      return NextResponse.json(
        { error: "Missing image input.", success: false },
        { status: 400 }
      );
    }

    if (imageInput.startsWith("blob:")) {
      return NextResponse.json(
        {
          error:
            "AI endpoint cannot read browser blob URLs. Re-upload the image and try again.",
          success: false,
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
    const selectedStyle = PIXEL_STYLES.find((style) => style.id === styleId);
    const finalPrompt =
      customPrompt.trim() || selectedStyle?.prompt || "pixel art style";

    if (!apiKey) {
      console.warn("DASHSCOPE_API_KEY is not configured. Returning preview.");

      await new Promise((resolve) => setTimeout(resolve, 800));

      return NextResponse.json({
        success: true,
        data: {
          imageUrl: previewImageUrl,
          style: selectedStyle?.name || "Custom",
          message:
            "Demo mode: DASHSCOPE_API_KEY is not available. Returning the original image preview. Add the key to .env.local and restart the dev server.",
        },
      });
    }

    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "wan2.6-image",
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { text: finalPrompt },
                  { image: imageInput },
                ],
              },
            ],
          },
          parameters: {
            size: "1K",
            watermark: false,
            prompt_extend: true,
            seed: Math.floor(Math.random() * 1000000),
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await readDashScopeError(response));
    }

    const result = await response.json();
    const generatedImageUrl = result.output?.choices?.[0]?.message?.content?.find(
      (item: { type?: string; image?: string }) => item.type === "image"
    )?.image;

    if (!generatedImageUrl) {
      throw new Error("No generated image returned from DashScope.");
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: generatedImageUrl,
        style: selectedStyle?.name || "Custom",
        prompt: finalPrompt,
      },
    });
  } catch (error) {
    console.error("AI generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI generation failed. Please try again later.",
        success: false,
      },
      { status: 500 }
    );
  }
}
