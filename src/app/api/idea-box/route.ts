import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { callCloudBaseFunction } from "@/lib/server/cloudbase-functions";

export async function POST(request: Request) {
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

    const payload = (await request.json()) as Record<string, unknown>;
    const data = await callCloudBaseFunction("toutoutool-user", {
      action: "createIdeaBox",
      userId: session.userId,
      phoneNumber: session.phoneNumber,
      payload,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit idea.",
      },
      { status: 500 }
    );
  }
}
