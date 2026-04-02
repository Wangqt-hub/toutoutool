import { NextResponse } from "next/server";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import {
  CloudBaseAuthError,
  sendPhoneVerificationCode,
} from "@/lib/server/cloudbase-auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone?: string;
      deviceId?: string;
      intent?: "signin" | "signup";
    };
    const phoneNumber = normalizePhoneNumber(payload.phone || "");

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid mobile number is required.",
        },
        { status: 400 }
      );
    }

    const result = await sendPhoneVerificationCode({
      phoneNumber,
      deviceId: payload.deviceId,
      target: payload.intent === "signup" ? "ANY" : "USER",
    });

    return NextResponse.json({
      success: true,
      data: {
        verificationId: result.verification_id,
        expiresIn: result.expires_in,
        isUser: result.is_user,
      },
    });
  } catch (error) {
    if (error instanceof CloudBaseAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send code.",
      },
      { status: 500 }
    );
  }
}
