import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function isSupportedProtocol(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");

  if (!target) {
    return NextResponse.json(
      { error: "Missing image url." },
      { status: 400 }
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(target);
  } catch {
    return NextResponse.json(
      { error: "Invalid image url." },
      { status: 400 }
    );
  }

  if (!isSupportedProtocol(parsedUrl)) {
    return NextResponse.json(
      { error: "Unsupported image url protocol." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(parsedUrl, {
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream image request failed with ${upstream.status}.` },
        { status: upstream.status }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await upstream.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to proxy image.",
      },
      { status: 500 }
    );
  }
}
