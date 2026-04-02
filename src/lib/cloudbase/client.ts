"use client";

import cloudbase from "@cloudbase/js-sdk";

let cloudbaseApp: ReturnType<typeof cloudbase.init> | null = null;

const publicCloudBaseEnvId = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID?.trim();
const publicCloudBaseRegion =
  process.env.NEXT_PUBLIC_CLOUDBASE_REGION?.trim() || "ap-shanghai";
const publicCloudBaseAccessKey =
  process.env.NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY?.trim();

function getRequiredPublicEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getCloudBaseApp() {
  if (!cloudbaseApp) {
    cloudbaseApp = cloudbase.init({
      env: getRequiredPublicEnv(
        publicCloudBaseEnvId,
        "NEXT_PUBLIC_CLOUDBASE_ENV_ID"
      ),
      region: publicCloudBaseRegion,
      accessKey: getRequiredPublicEnv(
        publicCloudBaseAccessKey,
        "NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY"
      ),
      auth: {
        detectSessionInUrl: true,
      },
    });
  }

  return cloudbaseApp;
}

export function getCloudBaseAuth() {
  return getCloudBaseApp().auth;
}
