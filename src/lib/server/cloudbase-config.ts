function readEnvValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getCloudBaseEnvId() {
  return readEnvValue("CLOUDBASE_ENV_ID");
}

export function getCloudBaseRegion() {
  return process.env.CLOUDBASE_REGION?.trim() || "ap-shanghai";
}

export function getCloudBaseServerApiKey() {
  return readEnvValue("CLOUDBASE_SERVER_API_KEY");
}

export function getCloudBaseClientId() {
  return process.env.CLOUDBASE_AUTH_CLIENT_ID?.trim() || getCloudBaseEnvId();
}

export function getCloudBaseAuthBaseUrl() {
  return `https://${getCloudBaseEnvId()}.${getCloudBaseRegion()}.tcb-api.tencentcloudapi.com/auth/v1`;
}

export function getCloudBaseApiBaseUrl() {
  return `https://${getCloudBaseEnvId()}.api.tcloudbasegateway.com/v1`;
}

export function getCloudBaseAIServiceName() {
  return process.env.CLOUDBASE_AI_SERVICE_NAME?.trim() || "toutoutool-ai";
}

export function getCloudBaseStorageBucket() {
  return readEnvValue("CLOUDBASE_STORAGE_BUCKET");
}

export function getInternalApiSecret() {
  return readEnvValue("INTERNAL_API_SECRET");
}
