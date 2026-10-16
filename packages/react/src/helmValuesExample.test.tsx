import type { RJSFSchema } from "@rjsf/utils";
import { setByPath, toPath, unsetByPath } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import type { JsonObject } from "a-form-core";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { normalizeFormSpec, parseYamlSpec, validateFormSpec } from "../../parser/src/index.js";
import { AForm } from "./AForm.js";

const parsed = parseYamlSpec(readFileSync(
  new URL("../../../examples/helm-values-production.a-form.yaml", import.meta.url),
  "utf8",
));
if (!parsed.value) throw new Error("The production Helm values example must parse.");
const spec = parsed.value;
const values: JsonObject = parse(readFileSync(
  new URL("../../../examples/helm-values-production.values.yaml", import.meta.url),
  "utf8",
));
const validate = (value: JsonObject) => validator.validateFormData(value, spec.schema as RJSFSchema).errors;

describe("production Helm values example", () => {
  it("is a valid AForm specification and accepts its companion values", () => {
    expect(parsed.diagnostics).toEqual([]);
    expect(validateFormSpec(spec)).toEqual([]);
    expect(validate(values)).toEqual([]);
  });

  it("renders nested objects, arrays, and read-only pipeline fields", () => {
    const html = renderToStaticMarkup(
      <AForm spec={normalizeFormSpec(spec)} value={values} />,
    );
    expect(html).toContain('data-a-form-field="worker.worker.env"');
    expect(html).toContain('data-a-form-field="worker.cronjob"');
    expect(html).toContain('data-a-form-field="service.annotations"');
    expect(html).toContain("SFTP_PASSWORD");
    expect(html).toMatch(/id="root\.worker\.worker\.image\.tag"[^>]*readOnly=""/);
    expect(html).toMatch(/id="root\.service\.annotations\.buildId"[^>]*readOnly=""/);
  });

  it.each([
    ["worker.worker.mode", "deployment"],
    ["worker.enabled", "true"],
    ["worker.worker.image.tag", "latest"],
    ["worker.worker.image.pullPolicy", "Always"],
    ["worker.worker.resources.requests.cpu", "100MB"],
    ["worker.worker.resources.limits.memory", "2GB"],
    ["worker.worker.env.0.value", 123],
    ["worker.worker.env.0.name", "APP-NAME"],
    ["worker.worker.securityContext.runAsNonRoot", false],
    ["worker.worker.securityContext.runAsUser", 0],
    ["worker.cronjob.schedule", "* * * * * *"],
    ["worker.cronjob.timeZone", "UTC"],
    ["worker.cronjob.concurrencyPolicy", "Allow"],
    ["worker.cronjob.activeDeadlineSeconds", 0],
    ["worker.cronjob.backoffLimit", -1],
    ["worker.cronjob.successfulJobsHistoryLimit", 1.5],
    ["worker.externalSecrets.enabled", false],
    ["worker.externalSecrets.secretStoreKind", "UnknownStore"],
    ["worker.externalSecrets.refreshInterval", "0h"],
    ["worker.externalSecrets.secrets.0.dataFrom.0.extract.key", ""],
    ["service.annotations.environment", "staging"],
    ["service.annotations.imageDigest", "sha256:invalid"],
    ["service.annotations.deployedAt", "not-a-timestamp"],
    ["service.annotations.buildId", "not-a-uuid"],
    ["service.annotations.commitSha", "not-a-commit"],
    ["service.annotations.coreVersion", "invalid"],
  ])("rejects invalid data at %s", (path, value) => {
    const candidate = structuredClone(values);
    setByPath(candidate, toPath(path), value);
    expect(validate(candidate).length).toBeGreaterThan(0);
  });

  it.each(["SFTP_PASSWORD", "VTEX_API_APP_KEY", "VTEX_API_APP_TOKEN", "WAKE_PASSWORD", "PRIVATE_KEY"])(
    "requires a Secret reference for %s",
    (name) => {
      const candidate = structuredClone(values);
      setByPath(candidate, ["worker", "worker", "env"], [{ name, value: "example-only" }]);
      expect(validate(candidate).length).toBeGreaterThan(0);
    },
  );

  it.each([
    { name: "LOG_LEVEL" },
    { name: "LOG_LEVEL", value: "INFO", valueFrom: { secretKeyRef: { name: "example", key: "LEVEL" } } },
    { name: "SFTP_PASSWORD", valueFrom: { secretKeyRef: { name: "example" } } },
  ])("rejects incomplete or ambiguous environment sources: %j", (entry) => {
    const candidate = structuredClone(values);
    setByPath(candidate, ["worker", "worker", "env"], [entry]);
    expect(validate(candidate).length).toBeGreaterThan(0);
  });

  it("requires the nested subchart structure and rejects unexpected root keys", () => {
    const candidate = structuredClone(values);
    unsetByPath(candidate, ["worker", "worker"]);
    setByPath(candidate, ["cronjob"], { schedule: "0 3 * * *" });
    const errors = validate(candidate);
    expect(errors.some(({ name }) => name === "required")).toBe(true);
    expect(errors.some(({ name }) => name === "additionalProperties")).toBe(true);
  });
});
