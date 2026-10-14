import type { ErrorSchema } from "@rjsf/utils";
import type {
  AsyncValidationEngine,
  AsyncValidationIssue,
  AsyncValidationResult,
  AsyncValidationStatus,
} from "a-form-async-validation";
import type {
  AsyncValidationRuleSpec,
  AsyncValidationTrigger,
  JsonObject,
  JsonValue,
} from "a-form-core";
import { useEffect, useRef, useState } from "react";

export interface AFormAsyncValidationEvent {
  readonly ruleId: string;
  readonly fieldPath: string;
  readonly trigger: AsyncValidationTrigger;
  readonly result: AsyncValidationResult;
}

export interface AFormAsyncValidationOptions {
  readonly engine: AsyncValidationEngine;
  readonly onResult?: (event: AFormAsyncValidationEvent) => void;
}

export interface AsyncFieldState {
  readonly status: AsyncValidationStatus;
  readonly issues: readonly AsyncValidationIssue[];
  readonly blocking: boolean;
}

interface ValidationRecord {
  readonly fieldPath: string;
  readonly result: AsyncValidationResult;
}

export interface AsyncValidationController {
  readonly asyncFields: Readonly<Record<string, AsyncFieldState>>;
  readonly extraErrors: ErrorSchema;
  readonly isPending: boolean;
  /** Schedules `change` rules whose paths or dependencies differ between both values. */
  handleChange(previousValue: JsonObject, nextValue: JsonObject): void;
  /** Runs every rule targeting `fieldPath` with the first of `triggers` each rule accepts. */
  runField(fieldPath: string, triggers: readonly AsyncValidationTrigger[], formData: JsonObject): Promise<readonly AsyncValidationResult[]>;
  /** Runs submit (or change) rules for every path; resolves `true` when a blocking result was found. */
  runSubmit(formData: JsonObject): Promise<boolean>;
  /** Drops results, pending state and scheduled runs for a field. */
  clearField(fieldPath: string): void;
}

export function valueAtPath(value: JsonValue, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const segment of path.split(".")) {
    if (current === null || Array.isArray(current) || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

function appliesToTrigger(rule: AsyncValidationRuleSpec, trigger: AsyncValidationTrigger): boolean {
  return (rule.triggers ?? ["blur", "submit"]).includes(trigger);
}

function addError(errorSchema: ErrorSchema, path: string, message: string): void {
  let current = errorSchema;
  for (const segment of path.split(".")) {
    current[segment] ??= {};
    current = current[segment] as ErrorSchema;
  }
  current.__errors = [...(current.__errors ?? []), message];
}

function omitKeys<T>(record: Readonly<Record<string, T>>, keep: (key: string, value: T) => boolean): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => keep(key, value)));
}

export function useAsyncValidation(
  rules: readonly AsyncValidationRuleSpec[],
  options: AFormAsyncValidationOptions | undefined,
): AsyncValidationController {
  const [records, setRecords] = useState<Readonly<Record<string, ValidationRecord>>>({});
  const [pending, setPending] = useState<Readonly<Record<string, string>>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const requestVersions = useRef(new Map<string, number>());

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    options?.engine.cancelAll();
  }, [options?.engine]);

  const recordKey = (rule: AsyncValidationRuleSpec, fieldPath: string) => `${rule.id}:${fieldPath}`;

  const clearTimer = (key: string): void => {
    const timer = timers.current.get(key);
    if (!timer) return;
    clearTimeout(timer);
    timers.current.delete(key);
  };

  const runRule = async (
    rule: AsyncValidationRuleSpec,
    fieldPath: string,
    trigger: AsyncValidationTrigger,
    formData: JsonObject,
  ): Promise<AsyncValidationResult | undefined> => {
    if (!options) return undefined;
    const key = recordKey(rule, fieldPath);
    const version = (requestVersions.current.get(key) ?? 0) + 1;
    requestVersions.current.set(key, version);
    setPending((current) => ({ ...current, [key]: fieldPath }));
    setRecords((current) => omitKeys(current, (recordId) => recordId !== key));

    const result = await options.engine.run({
      rule,
      fieldPath,
      value: valueAtPath(formData, fieldPath),
      formData,
      trigger,
    });
    if (requestVersions.current.get(key) !== version) return result;

    setPending((current) => omitKeys(current, (pendingId) => pendingId !== key));
    if (result.status !== "cancelled") {
      setRecords((current) => ({ ...current, [key]: { fieldPath, result } }));
      options.onResult?.({ ruleId: rule.id, fieldPath, trigger, result });
    }
    return result;
  };

  const scheduleChangeRule = (rule: AsyncValidationRuleSpec, fieldPath: string, formData: JsonObject): void => {
    const key = recordKey(rule, fieldPath);
    clearTimer(key);
    const debounceMs = rule.debounceMs ?? 0;
    if (debounceMs === 0) {
      void runRule(rule, fieldPath, "change", formData);
      return;
    }
    setPending((current) => ({ ...current, [key]: fieldPath }));
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      void runRule(rule, fieldPath, "change", formData);
    }, debounceMs));
  };

  const runField: AsyncValidationController["runField"] = async (fieldPath, triggers, formData) => {
    const runs = rules.flatMap((rule) => {
      if (!rule.paths.includes(fieldPath)) return [];
      const trigger = triggers.find((candidate) => appliesToTrigger(rule, candidate));
      if (!trigger) return [];
      clearTimer(recordKey(rule, fieldPath));
      return [runRule(rule, fieldPath, trigger, formData)];
    });
    const results = await Promise.all(runs);
    return results.filter((result): result is AsyncValidationResult => result !== undefined);
  };

  const asyncFields: Record<string, AsyncFieldState> = {};
  Object.values(records).forEach(({ fieldPath, result }) => {
    const previous = asyncFields[fieldPath];
    asyncFields[fieldPath] = {
      status: result.status,
      issues: [...(previous?.issues ?? []), ...(result.issues ?? [])],
      blocking: result.blocking || (previous?.blocking ?? false),
    };
  });
  Object.values(pending).forEach((fieldPath) => {
    asyncFields[fieldPath] = {
      status: "pending",
      issues: asyncFields[fieldPath]?.issues ?? [],
      blocking: asyncFields[fieldPath]?.blocking ?? false,
    };
  });

  const extraErrors: ErrorSchema = {};
  Object.values(records).forEach(({ fieldPath, result }) => {
    if (!result.blocking) return;
    const messages = result.issues?.map(({ message }) => message) ?? ["Async validation failed."];
    messages.forEach((message) => addError(extraErrors, fieldPath, message));
  });

  return {
    asyncFields,
    extraErrors,
    isPending: Object.keys(pending).length > 0,
    handleChange(previousValue, nextValue) {
      for (const rule of rules) {
        if (!appliesToTrigger(rule, "change")) continue;
        const watchedPaths = [...rule.paths, ...(rule.dependsOn ?? [])];
        const changed = watchedPaths.some((path) => (
          valueAtPath(previousValue, path) !== valueAtPath(nextValue, path)
        ));
        if (!changed) continue;
        for (const fieldPath of rule.paths) {
          scheduleChangeRule(rule, fieldPath, nextValue);
        }
      }
    },
    runField,
    async runSubmit(formData) {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      setPending({});
      const results = await Promise.all(rules.filter((rule) => (
        appliesToTrigger(rule, "submit") || appliesToTrigger(rule, "change")
      )).flatMap((rule) => {
        const trigger = appliesToTrigger(rule, "submit") ? "submit" : "change";
        return rule.paths.map((fieldPath) => runRule(rule, fieldPath, trigger, formData));
      }));
      return results.some((result) => result?.blocking);
    },
    clearField(fieldPath) {
      for (const rule of rules) {
        if (!rule.paths.includes(fieldPath)) continue;
        const key = recordKey(rule, fieldPath);
        clearTimer(key);
        requestVersions.current.set(key, (requestVersions.current.get(key) ?? 0) + 1);
      }
      setPending((current) => omitKeys(current, (_, path) => path !== fieldPath));
      setRecords((current) => omitKeys(current, (_, record) => record.fieldPath !== fieldPath));
    },
  };
}
