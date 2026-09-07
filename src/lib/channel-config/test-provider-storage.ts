export const TEST_PROVIDER_STORAGE_CREDENTIALS = {
  username: "__test_provider__",
  password: "__test_provider__",
} as const;

export function isTestProviderStorageCredentialUsername(username: string): boolean {
  return username === TEST_PROVIDER_STORAGE_CREDENTIALS.username;
}
