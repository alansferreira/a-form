import type { AsyncValidationRuleSpec, AsyncValidationTrigger, JsonValue } from "jsfl-core";

export type AsyncValidationStatus = "idle" | "pending" | "valid" | "invalid" | "unavailable" | "cancelled";

export interface AsyncValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly severity: "error" | "warning" | "info";
}

export interface AsyncValidationRequest {
  readonly ruleId: string;
  readonly fieldPath: string;
  readonly value: JsonValue | undefined;
  readonly formData: JsonValue;
  readonly dependencyValues: Readonly<Record<string, JsonValue | undefined>>;
  readonly trigger: AsyncValidationTrigger;
  readonly signal: AbortSignal;
}

export interface AsyncValidationAdapterResponse {
  readonly valid: boolean;
  readonly issues?: readonly AsyncValidationIssue[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface AsyncValidationAdapter {
  readonly id: string;
  validate(request: AsyncValidationRequest): Promise<AsyncValidationAdapterResponse>;
}

export interface AsyncValidationResult extends AsyncValidationAdapterResponse {
  readonly status: Exclude<AsyncValidationStatus, "idle" | "pending">;
  readonly blocking: boolean;
  readonly cached: boolean;
}

export interface RunAsyncValidationInput {
  readonly rule: AsyncValidationRuleSpec;
  readonly fieldPath: string;
  readonly value: JsonValue | undefined;
  readonly formData: JsonValue;
  readonly trigger: AsyncValidationTrigger;
}