import type { AsyncValidationRuleSpec } from "jsfl-core";
import { describe, expect, it, vi } from "vitest";
import { AsyncValidationEngine, AsyncValidationRegistry } from "./index.js";

const rule: AsyncValidationRuleSpec = {
  id: "email-available",
  adapter: "customer-api",
  paths: ["email"],
  triggers: ["blur", "submit"],
  timeoutMs: 25,
  cacheTtlMs: 1000,
};

describe("AsyncValidationEngine", () => {
  it("caches successful adapter responses", async () => {
    const validate = vi.fn().mockResolvedValue({ valid: true });
    const registry = new AsyncValidationRegistry();
    registry.register({ id: "customer-api", validate });
    const engine = new AsyncValidationEngine(registry, () => 100);
    const input = { rule, fieldPath: "email", value: "a@example.com", formData: { email: "a@example.com" }, trigger: "blur" } as const;

    expect((await engine.run(input)).cached).toBe(false);
    expect((await engine.run(input)).cached).toBe(true);
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it("cancels an obsolete validation for the same field", async () => {
    const registry = new AsyncValidationRegistry();
    registry.register({
      id: "customer-api",
      validate: ({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        setTimeout(() => resolve({ valid: true }), 10);
      }),
    });
    const engine = new AsyncValidationEngine(registry);
    const first = engine.run({ rule, fieldPath: "email", value: "a", formData: { email: "a" }, trigger: "blur" });
    const second = engine.run({ rule, fieldPath: "email", value: "ab", formData: { email: "ab" }, trigger: "blur" });

    expect((await first).status).toBe("cancelled");
    expect((await second).status).toBe("valid");
  });

  it("blocks submit when an adapter is unavailable by default", async () => {
    const engine = new AsyncValidationEngine(new AsyncValidationRegistry());
    const result = await engine.run({ rule, fieldPath: "email", value: "a", formData: { email: "a" }, trigger: "submit" });

    expect(result.status).toBe("unavailable");
    expect(result.blocking).toBe(true);
    expect(result.issues?.[0]?.code).toBe("YF_ASYNC_ADAPTER_MISSING");
  });
});