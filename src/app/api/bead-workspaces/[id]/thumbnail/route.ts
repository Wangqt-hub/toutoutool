import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { downloadCloudBaseObject } from "@/lib/server/cloudbase-storage";
import { eq, getCloudBaseRdbFirstRow } from "@/lib/server/cloudbase-rdb";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

type ThumbnailRow = {
  id: string;
  thumbnail_path: string | null;
  updated_at: string;
};

function buildThumbnailEtag(row: ThumbnailRow) {
  return `"${Buffer.from(
    `workspace-thumb:${row.id}:${row.updated_at}:${row.thumbnail_path || "none"}`
  ).toString("base64url")}"`;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const row = await getCloudBaseRdbFirstRow<ThumbnailRow>("bead_workspaces", {
      user_id: eq(session.userId),
      id: eq(context.params.id),
      select: "id,thumbnail_path,updated_at",
    });

    if (!row || !row.thumbnail_path) {
      return NextResponse.json(
        {
          success: false,
          error: "Workspace thumbnail not found.",
        },
        { status: 404 }
      );
    }

    const etag = buildThumbnailEtag(row);

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    const file = await downloadCloudBaseObject(row.thumbnail_path);

    return new NextResponse(file.buffer, {
      headers: {
        "Content-Type": file.contentType,
        ETag: etag,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load workspace thumbnail.",
      },
      { status: 500 }
    );
  }
}
