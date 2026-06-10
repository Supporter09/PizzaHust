function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const E2E_BASE_URL = requireEnv("E2E_BASE_URL");
export const E2E_API_URL = requireEnv("E2E_API_URL");
export const E2E_ADMIN_PHONE = requireEnv("E2E_ADMIN_PHONE");
export const E2E_ADMIN_PASSWORD = requireEnv("E2E_ADMIN_PASSWORD");