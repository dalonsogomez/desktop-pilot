import { describe, expect, it } from "vitest";
import { VERSION } from "@/index";

describe("sanity", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
