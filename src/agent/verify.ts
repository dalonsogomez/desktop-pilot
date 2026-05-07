export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export async function verifyAfterAct(
  beforeBase64: string,
  afterBase64: string,
  expected: string,
  client: { verify: (a: string, b: string, expected: string) => Promise<VerifyResult> }
): Promise<VerifyResult> {
  if (beforeBase64 === afterBase64) {
    return { ok: false, reason: "no-change-detected" };
  }
  return client.verify(beforeBase64, afterBase64, expected);
}
