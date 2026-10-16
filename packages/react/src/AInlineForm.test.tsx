// @vitest-environment jsdom

import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "a-form-async-validation";
import type { JsonObject, NormalizedFormSpec } from "a-form-core";
import type { WidgetProps } from "@rjsf/utils";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AInlineForm } from "./AInlineForm.js";
import type { AInlineFormProps } from "./AInlineForm.js";
import { PresentationAdapterRegistry } from "./presentation.js";

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
    required: ["email"],
    properties: {
      name: { type: "string", title: "Name" },
      email: { type: "string", title: "Email", minLength: 3 },
      plan: { type: "string", title: "Plan", enum: ["free", "pro"] },
      active: { type: "boolean", title: "Active" },
    },
  },
  uiSchema: { plan: { "ui:enumNames": ["Free tier", "Pro tier"] } },
  layout: [],
  inline: {
    template: "<p class=\"intro\" onclick=\"alert(1)\">Hello <strong>{{name}}</strong>, mail {{email}} on {{plan}} ({{active}})</p><script>alert(1)</script>",
  },
};

const mounted: { root: ReturnType<typeof createRoot>; container: HTMLElement }[] = [];

afterEach(() => {
  mounted.forEach(({ root, container }) => {
    act(() => root.unmount());
    container.remove();
  });
  mounted.length = 0;
});

async function render(props: AInlineFormProps) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(<AInlineForm {...props} />));
  return container;
}

function field(container: HTMLElement, path: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-a-form-inline-field="${path}"]`);
  if (!element) throw new Error(`field ${path} not rendered`);
  return element;
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

async function click(target: HTMLElement) {
  await act(async () => target.click());
}

describe("AInlineForm", () => {
  it("renders a sanitized template with formatted read views", async () => {
    const container = await render({
      spec,
      value: { name: "Ana", plan: "pro", active: true },
      onDiagnostic: () => {},
    });

    const paragraph = container.querySelector("p");
    expect(paragraph?.className).toBe("intro");
    expect(paragraph?.getAttribute("onclick")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("strong [data-a-form-inline-field=\"name\"]")?.textContent).toBe("Ana");
    expect(field(container, "plan").textContent).toBe("Pro tier");
    expect(field(container, "active").textContent).toBe("Yes");
    expect(field(container, "email").querySelector(".a-form-inline-read-empty")?.textContent).toBe("Click to edit");
  });

  it("reports template diagnostics and renders unknown placeholders as text", async () => {
    const onDiagnostic = vi.fn();
    const container = await render({ spec, template: "<div>{{missing}} <img src=x onerror=alert(1)></div>", onDiagnostic });

    expect(container.textContent).toContain("{{missing}}");
    expect(container.querySelector("img")).toBeNull();
    expect(onDiagnostic.mock.calls[0]![0].map(({ code }: { code: string }) => code)).toEqual(["YF_INLINE_TAG", "YF_INLINE_PATH"]);
  });

  it("throws when neither the prop nor the spec provides a template", () => {
    const { inline: _inline, ...withoutInline } = spec;
    void _inline;
    expect(() => AInlineForm({ spec: withoutInline })).toThrow(/requires a template/);
  });

  it("commits a field on Enter and restores the value on Escape", async () => {
    const onCommit = vi.fn();
    const onChange = vi.fn();
    const container = await render({ spec, template: "{{name}}", value: { name: "Ana" }, onCommit, onChange });

    await click(field(container, "name").querySelector("button")!);
    let input = field(container, "name").querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("Ana");
    await typeInto(input, "Bia");
    await press(input, "Escape");
    expect(field(container, "name").textContent).toBe("Ana");
    expect(document.activeElement).toBe(field(container, "name").querySelector("button"));
    expect(onCommit).not.toHaveBeenCalled();

    await click(field(container, "name").querySelector("button")!);
    input = field(container, "name").querySelector<HTMLInputElement>("input")!;
    await typeInto(input, "Bia");
    await press(input, "Enter");
    expect(onCommit).toHaveBeenCalledWith({ path: "name", value: "Bia", formData: { name: "Bia" } });
    expect(onChange).toHaveBeenCalledWith({ name: "Bia" });
  });

  it("keeps the editor open when sync validation fails", async () => {
    const onCommit = vi.fn();
    const container = await render({ spec, template: "{{email}}", onCommit });

    await click(field(container, "email").querySelector("button")!);
    const input = field(container, "email").querySelector<HTMLInputElement>("input")!;
    await typeInto(input, "ab");
    await press(input, "Enter");

    expect(onCommit).not.toHaveBeenCalled();
    expect(field(container, "email").dataset.state).toBe("edit");
    expect(field(container, "email").hasAttribute("data-edited")).toBe(false);
  });

  it("blocks the commit on blocking async issues and commits on warnings", async () => {
    const registry = new AsyncValidationRegistry();
    registry.register({
      id: "api",
      validate: async ({ value }) => value === "taken@x.io"
        ? { valid: false, issues: [{ code: "TAKEN", message: "Email taken.", path: "email", severity: "error" }] }
        : { valid: false, issues: [{ code: "ODD", message: "Unusual domain.", path: "email", severity: "warning" }] },
    });
    const asyncSpec: NormalizedFormSpec = {
      ...spec,
      validations: { async: [{ id: "email", adapter: "api", paths: ["email"], failurePolicy: "warning" }] },
    };
    const onCommit = vi.fn();
    const container = await render({
      spec: asyncSpec,
      template: "{{email}}",
      asyncValidation: { engine: new AsyncValidationEngine(registry) },
      onCommit,
    });

    await click(field(container, "email").querySelector("button")!);
    const input = field(container, "email").querySelector<HTMLInputElement>("input")!;
    await typeInto(input, "taken@x.io");
    await click(field(container, "email").querySelector<HTMLButtonElement>(".a-form-inline-confirm")!);
    expect(onCommit).not.toHaveBeenCalled();
    expect(field(container, "email").dataset.state).toBe("edit");
    expect(field(container, "email").textContent).toContain("Email taken.");
    expect(field(container, "email").hasAttribute("data-edited")).toBe(false);

    await typeInto(field(container, "email").querySelector<HTMLInputElement>("input")!, "ana@odd.io");
    await click(field(container, "email").querySelector<HTMLButtonElement>(".a-form-inline-confirm")!);
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ value: "ana@odd.io" }));
    expect(field(container, "email").querySelector(".a-form-inline-issue-warning")?.textContent).toBe("Unusual domain.");
  });

  it("collects edits and validates everything on submit in form mode", async () => {
    const onSubmit = vi.fn();
    const onCommit = vi.fn();
    const container = await render({ spec, template: "{{name}}", commitMode: "form", onSubmit, onCommit });
    const form = container.querySelector("form")!;

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelector(".a-form-inline-errors")?.textContent).toContain("email");

    await click(field(container, "name").querySelector("button")!);
    await typeInto(field(container, "name").querySelector<HTMLInputElement>("input")!, "Ana");
    await press(field(container, "name").querySelector<HTMLInputElement>("input")!, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(field(container, "name").textContent).toBe("Ana");
  });

  it("uses the presentation adapter widgets in edit mode", async () => {
    const registry = new PresentationAdapterRegistry();
    registry.register({
      id: "custom",
      className: "custom-presentation",
      widgets: {
        TextWidget: (props: WidgetProps) => (
          <input
            data-custom-widget="text"
            id={props.id}
            value={String(props.value ?? "")}
            onChange={(event) => props.onChange(event.target.value)}
          />
        ),
      },
    });
    const container = await render({
      spec,
      template: "{{name}}",
      value: { name: "Ana" } as JsonObject,
      presentation: { registry, adapterId: "custom" },
    });

    expect(container.querySelector(".a-form-inline.custom-presentation")).not.toBeNull();
    await click(field(container, "name").querySelector("button")!);
    expect(field(container, "name").querySelector("[data-custom-widget=\"text\"]")).not.toBeNull();
  });

  it("shows the label of a selected async option in the read view", async () => {
    const optionSpec: NormalizedFormSpec = {
      ...spec,
      schema: { type: "object", properties: { country: { type: "string", title: "Country" } } },
      uiSchema: {
        country: {
          "ui:widget": "asyncOptions",
          "ui:options": { source: [{ id: "BR", name: "Brazil" }], valueKey: "id", labelKey: "name" },
        },
      },
    };
    const onCommit = vi.fn();
    const container = await render({ spec: optionSpec, template: "{{country}}", value: { country: "BR" }, onCommit });

    expect(field(container, "country").textContent).toBe("Brazil");
  });

  it("loads the template through a sync or async function receiving spec.inline.template", async () => {
    const syncLoader = vi.fn((reference: string) => `<p>{{${reference}}}</p>`);
    const syncContainer = await render({
      spec: { ...spec, inline: { template: "name" } },
      template: syncLoader,
      value: { name: "Ana" },
    });
    expect(syncLoader).toHaveBeenCalledWith("name");
    expect(field(syncContainer, "name").textContent).toBe("Ana");

    let release!: (html: string) => void;
    const asyncLoader = vi.fn((_reference: string) => new Promise<string>((resolve) => { release = resolve; }));
    const container = await render({
      spec: { ...spec, inline: { template: "templates/contract.html" } },
      template: asyncLoader,
      value: { email: "a@b.io" },
    });
    expect(asyncLoader).toHaveBeenCalledWith("templates/contract.html");
    expect(container.querySelector(".a-form-inline-loading")?.getAttribute("aria-busy")).toBe("true");

    await act(async () => release("<p>Mail: {{email}}</p>"));
    expect(field(container, "email").textContent).toBe("a@b.io");
    expect(asyncLoader).toHaveBeenCalledTimes(1);
  });

  it("reports a failing template loader", async () => {
    const onDiagnostic = vi.fn();
    const container = await render({
      spec,
      template: async () => { throw new Error("not found"); },
      onDiagnostic,
    });

    expect(container.querySelector(".a-form-inline-load-error")).not.toBeNull();
    expect(onDiagnostic.mock.calls[0]![0]).toMatchObject([{ code: "YF_INLINE_TEMPLATE_LOAD" }]);
  });
});
