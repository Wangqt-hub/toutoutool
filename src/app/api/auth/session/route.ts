import { NextResponse } from "next/server";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { SESSION_HINT_COOKIE_NAME, buildSession } from "@/lib/auth/session";
import {
  createSessionCookieValue,
  getSessionCookieConfig,
  getSessionCookieName,
} from "@/lib/auth/server";
import {
  CloudBaseAuthError,
  getCloudBaseProfile,
} from "@/lib/server/cloudbase-auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      accessToken?: string;
      phone?: string;
    };
    const accessToken = String(payload.accessToken || "").trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "accessToken is required.",
        },
        { status: 400 }
      );
    }

    const profile = await getCloudBaseProfile({
      accessToken,
    });
    const phoneNumber =
      normalizePhoneNumber(profile.phone_number || "") ||
      normalizePhoneNumber(payload.phone || "") ||
      null;

    if (!profile.sub) {
      return NextResponse.json(
        {
          success: false,
          error: "CloudBase did not return a valid user id.",
        },
        { status: 502 }
      );
    }

    const session = buildSession({
      userId: profile.sub,
      phoneNumber,
    });
    const sessionToken = await createSessionCookieValue(session);
    const response = NextResponse.json({
      success: true,
      data: {
        userId: session.userId,
        phoneNumber: session.phoneNumber,
      },
    });
    const sessionCookieConfig = getSessionCookieConfig();

    response.cookies.set(
      getSessionCookieName(),
      sessionToken,
      sessionCookieConfig
    );

    response.cookies.set(SESSION_HINT_COOKIE_NAME, "1", {
      ...sessionCookieConfig,
      httpOnly: false,
    });

    return response;
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
        error:
          error instanceof Error ? error.message : "Failed to create session.",
      },
      { status: 500 }
    );
  }
}
