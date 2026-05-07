import { describe, expect, it } from "vitest";
import { setSecret, getSecret, deleteSecret } from "@/storage/keychain";

const TEST_SERVICE = "ai.desktop-pilot.test";
const TEST_ACCOUNT = "test-user";

describe("keychain", () => {
  it("stores, retrieves, and deletes a secret roundtrip", async () => {
    const value = `secret-${Date.now()}`;
    await setSecret(TEST_SERVICE, TEST_ACCOUNT, value);
    const got = await getSecret(TEST_SERVICE, TEST_ACCOUNT);
    expect(got).toBe(value);
    await deleteSecret(TEST_SERVICE, TEST_ACCOUNT);
    await expect(getSecret(TEST_SERVICE, TEST_ACCOUNT)).rejects.toThrow();
  });
});
