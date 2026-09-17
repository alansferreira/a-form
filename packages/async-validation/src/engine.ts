import type { AsyncValidationRuleSpec, JsonValue } from "a-form-core";
import type {
  AsyncValidationAdapterResponse,
  AsyncValidationIssue,
  AsyncValidationResult,
  RunAsyncValidationInput,
} from "./types.js";
import { AsyncValidationRegistry } from "./registry.js";

interface CacheEntry {
  readonly expiresAt: number;
  readonly response: AsyncValidationAdapterResponse;
}

function valueAtPath(value: JsonValue, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const segment of path.split(".")) {
    if (current === null || Array.isArray(current) || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function issueForFailure(rule: AsyncValidationRuleSpec, path: string, code: string, message: string): AsyncValidationIssue {
  return {
    code,
    message,
    path,
    severity: rule.failurePolicy === "warning" ? "warning" : "error",
  };
}

export class AsyncValidationEngine {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly active = new Map<string, AbortController>();

  constructor(
    private readonly registry: AsyncValidationRegistry,
    private readonly now: () => number = Date.now,
  ) {}

  async run(input: RunAsyncValidationInput): Promise<AsyncValidationResult> {
    const { rule, fieldPath, trigger } = input;
    const triggers = rule.triggers ?? ["blur", "submit"];
    if (!triggers.includes(trigger)) {
      return { status: "valid", valid: true, blocking: false, cached: false };
    }
    if (!rule.paths.includes(fieldPath)) {
      return { status: "valid", valid: true, blocking: false, cached: false };
    }

    const adapter = this.registry.get(rule.adapter);
    if (!adapter) {
      return this.unavailable(rule, fieldPath, "YF_ASYNC_ADAPTER_MISSING", `Adapter '${rule.adapter}' is not registered.`);
    }

    const dependencyValues = Object.fromEntries(
      (rule.dependsOn ?? []).map((path) => [path, valueAtPath(input.formData, path)]),
    );
    const cacheKey = JSON.stringify([rule.id, fieldPath, input.value, dependencyValues]);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) {
      return this.fromResponse(rule, cached.response, true);
    }

    const activeKey = `${rule.id}:${fieldPath}`;
    this.active.get(activeKey)?.abort();
    const controller = new AbortController();
    this.active.set(activeKey, controller);
    const timeoutMs = rule.timeoutMs ?? 5_000;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await adapter.validate({
        ruleId: rule.id,
        fieldPath,
        value: input.value,
        formData: input.formData,
        dependencyValues,
        trigger,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return timedOut
          ? this.unavailable(rule, fieldPath, "YF_ASYNC_TIMEOUT", `Validation timed out after ${timeoutMs} ms.`)
          : { status: "cancelled", valid: false, blocking: false, cached: false };
      }
      if ((rule.cacheTtlMs ?? 0) > 0) {
        this.cache.set(cacheKey, { expiresAt: this.now() + rule.cacheTtlMs!, response });
      }
      return this.fromResponse(rule, response, false);
    } catch (error) {
      if (controller.signal.aborted && !timedOut) {
        return { status: "cancelled", valid: false, blocking: false, cached: false };
      }
      return this.unavailable(
        rule,
        fieldPath,
        timedOut ? "YF_ASYNC_TIMEOUT" : "YF_ASYNC_UNAVAILABLE",
        timedOut
          ? `Validation timed out after ${timeoutMs} ms.`
          : error instanceof Error ? error.message : "Validation service is unavailable.",
      );
    } finally {
      clearTimeout(timeout);
      if (this.active.get(activeKey) === controller) {
        this.active.delete(activeKey);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  cancelAll(): void {
    this.active.forEach((controller) => controller.abort());
    this.active.clear();
  }

  private fromResponse(
    rule: AsyncValidationRuleSpec,
    response: AsyncValidationAdapterResponse,
    cached: boolean,
  ): AsyncValidationResult {
    const hasBlockingIssue = response.issues?.some(({ severity }) => severity === "error") ?? false;
    return {
      ...response,
      status: response.valid ? "valid" : "invalid",
      blocking: !response.valid && (hasBlockingIssue || rule.failurePolicy !== "warning"),
      cached,
    };
  }

  private unavailable(
    rule: AsyncValidationRuleSpec,
    path: string,
    code: string,
    message: string,
  ): AsyncValidationResult {
    return {
      status: "unavailable",
      valid: false,
      blocking: rule.failurePolicy !== "warning",
      cached: false,
      issues: [issueForFailure(rule, path, code, message)],
    };
  }
}