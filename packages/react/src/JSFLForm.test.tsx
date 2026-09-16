// @vitest-environment jsdom

import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "jsfl-async-validation";
import type { JsonObject, NormalizedFormSpec } from "jsfl-core";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { JSFLForm } from "./JSFLForm.js";

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

beforeAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

const spec: NormalizedFormSpec = {
  version: "1",
  schema: {
    type: "object",
    properties: {
      ignored: { type: "string" },
      email: { type: "string", title: "Email" },
      name: { type: "string", title: "Name" },
    },
  },
  layout: [{
    type: "row",
    id: "main",
    children: [{
      type: "column",
      id: "main-left",
      span: { mobile: 12, tablet: 6, desktop: 4 },
      children: [
        { type: "field", id: "name", path: "name" },
        { type: "field", id: "email", path: "email" },
      ],
    }],
  }],
};

const mountedRoots: ReturnType<typeof createRoot>[] = [];

afterEach(() => {
  mountedRoots.forEach((root) => act(() => root.unmount()));
  mountedRoots.length = 0;
  vi.useRealTimers();
});

describe("JSFLForm", () => {
  it("renders only layout fields with the selected span and JSFL order", () => {
    const html = renderToStaticMarkup(<JSFLForm spec={spec} viewport="desktop" />);

    expect(html).not.toContain("name=\"root_ignored\"");
    expect(html).toContain("data-jsfl-field=\"name\"");
    expect(html).toContain("data-jsfl-field=\"email\"");
    expect(html).toContain("grid-column:span 4");
    expect(html).toMatch(/data-jsfl-field="name" style="[^"]*order:0/);
    expect(html).toMatch(/data-jsfl-field="email" style="[^"]*order:1/);
  });

  it("runs blur and submit validation, displays issues, and blocks invalid submit", async () => {
    const asyncSpec: NormalizedFormSpec = {
      ...spec,
      validations: {
        async: [{
          id: "email-available",
          adapter: "customer-api",
          paths: ["email"],
          triggers: ["blur", "submit"],
        }],
      },
    };
    const registry = new AsyncValidationRegistry();
    const validate = vi.fn(async ({ value }: { value: unknown }) => value === "free@example.com"
      ? { valid: true }
      : {
          valid: false,
          issues: [{
            code: "EMAIL_TAKEN",
            message: "This email is already registered.",
            path: "email",
            severity: "error" as const,
          }],
        });
    registry.register({ id: "customer-api", validate });
    const engine = new AsyncValidationEngine(registry);
    const onSubmit = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    function Harness() {
      const [value, setValue] = useState<JsonObject>({ email: "taken@example.com" });
      return (
        <JSFLForm
          spec={asyncSpec}
          value={value}
          asyncValidation={{ engine }}
          onChange={setValue}
          onSubmit={onSubmit}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const input = container.querySelector<HTMLInputElement>("input");
    const form = container.querySelector<HTMLFormElement>("form");
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      input!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("This email is already registered.");

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(validate).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      valueSetter.call(input, "free@example.com");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("This email is already registered.");

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith({ email: "free@example.com" }, expect.anything());

    container.remove();
  });

  it("debounces change validation and reruns a rule when a dependency changes", async () => {
    vi.useFakeTimers();
    const asyncSpec: NormalizedFormSpec = {
      ...spec,
      validations: {
        async: [{
          id: "email-by-country",
          adapter: "customer-api",
          paths: ["email"],
          dependsOn: ["name"],
          triggers: ["change"],
          debounceMs: 50,
        }],
      },
    };
    const registry = new AsyncValidationRegistry();
    const validate = vi.fn(async () => ({ valid: true }));
    registry.register({ id: "customer-api", validate });
    const engine = new AsyncValidationEngine(registry);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    function Harness() {
      const [value, setValue] = useState<JsonObject>({ email: "hello@example.com", name: "BR" });
      return (
        <JSFLForm
          spec={asyncSpec}
          value={value}
          asyncValidation={{ engine }}
          onChange={setValue}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const nameInput = [...container.querySelectorAll<HTMLInputElement>("input")]
      .find((input) => input.id === "root.name");
    expect(nameInput).toBeDefined();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      valueSetter.call(nameInput, "US");
      nameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(validate).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLButtonElement>(".jsfl-submit")?.disabled).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0]![0].dependencyValues).toEqual({ name: "US" });
    expect(container.querySelector<HTMLButtonElement>(".jsfl-submit")?.disabled).toBe(false);

    container.remove();
  });
});