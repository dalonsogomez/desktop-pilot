import { execa } from "execa";

export async function setSecret(service: string, account: string, value: string): Promise<void> {
  await execa("security", [
    "add-generic-password",
    "-s", service,
    "-a", account,
    "-w", value,
    "-U",
  ]);
}

export async function getSecret(service: string, account: string): Promise<string> {
  const { stdout } = await execa("security", [
    "find-generic-password",
    "-s", service,
    "-a", account,
    "-w",
  ]);
  return stdout.trim();
}

export async function deleteSecret(service: string, account: string): Promise<void> {
  await execa("security", [
    "delete-generic-password",
    "-s", service,
    "-a", account,
  ]);
}
