// @vitest-environment jsdom

import type { JsonObject, NormalizedFormSpec } from "a-form-core";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BootstrapAdapter } from "../../presentation-bootstrap/src/index.js";
import { MaterialAdapter } from "../../presentation-material/src/index.js";
import { NeobrutalismAdapter } from "../../presentation-neobrutalism/src/index.js";
import { TailwindAdapter } from "../../presentation-tailwind/src/index.js";
import { AForm } from "./AForm.js";
import { AInlineForm } from "./AInlineForm.js";
import { PresentationAdapterRegistry } from "./presentation.js";
import type { PresentationAdapter } from "./presentation.js";

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = false; });

const spec: NormalizedFormSpec = {
  version: "1",
  schema: {
    type: "object",
    properties: {
      name: { type: "string", title: "Name", default: "Ana" },
      email: { type: "string", title: "Email" },
    },
  },
  layout: ["name", "email"].map((path) => ({
    type: "field",
    id: path,
    path,
    span: { mobile: 12, tablet: 6, desktop: 6 },
    align: "start",
  })),
  inline: { template: "<div>{{name}} {{email}}</div>" },
};

const mounted: { root: ReturnType<typeof createRoot>; container: HTMLElement }[] = [];
afterEach(() => {
  mounted.forEach(({ root, container }) => {
    act(() => root.unmount());
    container.remove();
  });
  mounted.length = 0;
});

async function render(
  inline: boolean,
  adapter?: PresentationAdapter,
  commitMode: "field" | "form" = "field",
  nested = false,
) {
  const registry = new PresentationAdapterRegistry();
  if (adapter) registry.register(adapter);
  const presentationProps = adapter ? { presentation: { registry, adapterId: adapter.id } } : {};
  const formSpec: NormalizedFormSpec = nested ? {
    ...spec,
    schema: { type: "object", properties: { customer: spec.schema } },
    layout: spec.layout.map((node) => node.type === "field" ? { ...node, path: `customer.${node.path}` } : node),
    inline: { template: "<div>{{customer.name}} {{customer.email}}</div>" },
  } : spec;
  const formValue = (name: string, email: string): JsonObject => nested ? { customer: { name, email } } : { name, email };
  function Harness() {
    const [value, setValue] = useState<JsonObject>(formValue("Ana", "ana@example.com"));
    return (
      <>
        {inline
          ? <AInlineForm spec={formSpec} value={value} onChange={setValue} commitMode={commitMode} {...presentationProps} />
          : <AForm spec={formSpec} value={value} onChange={setValue} {...presentationProps} />}
        <button type="button" data-reset onClick={() => setValue(formValue("Ana", "other@example.com"))}>Reset</button>
      </>
    );
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(<Harness />));
  const field = (path: string) => {
    const element = container.querySelector<HTMLElement>(
      `[${inline ? "data-a-form-inline-field" : "data-a-form-field"}="${nested ? `customer.${path}` : path}"]`,
    );
    if (!element) throw new Error(`Field ${path} not found.`);
    return element;
  };
  return { container, field };
}

async function inputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function edit(field: HTMLElement, inline: boolean, value: string, key = "Enter") {
  if (inline) await act(async () => field.querySelector<HTMLButtonElement>(".a-form-inline-read")!.click());
  const input = field.querySelector<HTMLInputElement>("input")!;
  await inputValue(input, value);
  if (inline) await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
] as const)("edited fields (inline: %s, nested: %s)", (inline, nested) => {
  it.each([
    ["default", undefined],
    ["bootstrap", BootstrapAdapter],
    ["material", MaterialAdapter],
    ["tailwind", TailwindAdapter],
    ["neobrutalism", NeobrutalismAdapter],
  ] as const)("highlights changes and clears reverted values with %s", async (_name, adapter) => {
    const { field } = await render(inline, adapter, "field", nested);
    expect(field("name").hasAttribute("data-edited")).toBe(false);
    expect(field("email").hasAttribute("data-edited")).toBe(false);

    await edit(field("name"), inline, "Bia");
    expect(field("name").dataset.edited).toBe("true");
    expect(field("name").classList.contains("a-form-field-edited")).toBe(true);
    expect(field("name").style.outline).toBe("");
    expect(field("name").style.fontWeight).toBe(String(adapter?.editedFieldStyle?.fontWeight ?? 700));
    expect(field("email").hasAttribute("data-edited")).toBe(false);

    await edit(field("name"), inline, "Ana");
    expect(field("name").hasAttribute("data-edited")).toBe(false);
    expect(field("name").style.outline).toBe("");
    expect(field("name").style.fontWeight).toBe("");
  });

  it("supports adapter overrides without replacing input focus styles", async () => {
    const { field } = await render(inline, {
      id: "custom",
      editedFieldStyle: { outline: "3px dashed purple", outlineOffset: "5px", borderRadius: "8px" },
    }, "field", nested);
    await edit(field("name"), inline, "Bia");
    expect(field("name").style.outline).toBe("3px dashed purple");
    expect(field("name").style.outlineOffset).toBe("5px");
    expect(field("name").querySelector("input")?.style.outline ?? "").toBe("");
  });

  it("does not mark external updates and removes the highlight on reset", async () => {
    const { container, field } = await render(inline, undefined, "field", nested);
    await edit(field("name"), inline, "Bia");
    await act(async () => container.querySelector<HTMLButtonElement>("[data-reset]")!.click());
    expect(field("name").hasAttribute("data-edited")).toBe(false);
    expect(field("email").hasAttribute("data-edited")).toBe(false);
  });
});

describe("inline edit confirmation", () => {
  it.each(["field", "form"] as const)("marks confirmed edits only in %s mode", async (commitMode) => {
    const { field } = await render(true, TailwindAdapter, commitMode);
    await edit(field("name"), true, "Bia", "Escape");
    expect(field("name").hasAttribute("data-edited")).toBe(false);
    await edit(field("name"), true, "Bia");
    expect(field("name").dataset.edited).toBe("true");
    await edit(field("name"), true, "Ana", "Escape");
    expect(field("name").dataset.edited).toBe("true");
  });
});

describe("normal edit tracking", () => {
  it("preserves uncontrolled values and does not mark schema defaults", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => root.render(<AForm spec={spec} />));
    const field = container.querySelector<HTMLElement>('[data-a-form-field="name"]')!;
    const input = field.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("Ana");
    expect(field.hasAttribute("data-edited")).toBe(false);
    await inputValue(input, "Bia");
    expect(field).toBe(container.querySelector('[data-a-form-field="name"]'));
    expect(field.querySelector<HTMLInputElement>("input")?.value).toBe("Bia");
    expect(field.dataset.edited).toBe("true");
    await inputValue(field.querySelector<HTMLInputElement>("input")!, "Ana");
    expect(field.hasAttribute("data-edited")).toBe(false);
  });
});
