import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { callCloudBaseFunction } from "@/lib/server/cloudbase-functions";

type ProfileResponse = {
  subscriptionTier: "free" | "premium";
};

export async function GET() {
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

    const data = await callCloudBaseFunction<ProfileResponse>("toutoutool-user", {
      action: "getProfile",
      userId: session.userId,
      phoneNumber: session.phoneNumber,
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
          error instanceof Error ? error.message : "Failed to load profile.",
      },
      { status: 500 }
    );
  }
}
