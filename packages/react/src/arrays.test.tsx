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
import type { AFormProps } from "./AForm.js";
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
      settings: {
        type: "object",
        properties: {
          entries: { type: "array", title: "Entries", minItems: 1, maxItems: 3, items: { type: "string", default: "new" } },
        },
      },
    },
  },
  layout: [{ type: "field", id: "entries", path: "settings.entries", span: { mobile: 12, tablet: 12, desktop: 12 }, align: "start" }],
};

const mounted: { root: ReturnType<typeof createRoot>; container: HTMLElement }[] = [];
afterEach(() => {
  mounted.forEach(({ root, container }) => {
    act(() => root.unmount());
    container.remove();
  });
  mounted.length = 0;
});

async function render(adapter?: PresentationAdapter, overrides: Partial<AFormProps> = {}, initial: JsonObject = { settings: { entries: ["first", "second"] } }) {
  const registry = new PresentationAdapterRegistry();
  if (adapter) registry.register(adapter);
  let latest = initial;
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <AForm
        spec={spec}
        {...overrides}
        value={value}
        onChange={(next) => { latest = next; setValue(next); }}
        {...(adapter ? { presentation: { registry, adapterId: adapter.id } } : {})}
      />
    );
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(<Harness />));
  const button = (suffix: string) => container.querySelector<HTMLButtonElement>(`[id="root.settings.entries${suffix}"]`);
  return { container, button, value: () => latest, field: () => container.querySelector<HTMLElement>('[data-a-form-field="settings.entries"]')! };
}

async function click(button: HTMLButtonElement | null) {
  expect(button).not.toBeNull();
  expect(button?.disabled).toBe(false);
  await act(async () => button!.click());
}

describe.each([
  ["default", undefined],
  ["bootstrap", BootstrapAdapter],
  ["material", MaterialAdapter],
  ["tailwind", TailwindAdapter],
  ["neobrutalism", NeobrutalismAdapter],
] as const)("array controls with %s", (_name, adapter) => {
  it("adds, reorders and removes items without submitting, and marks structural edits", async () => {
    const { button, value, field } = await render(adapter);
    expect(field().hasAttribute("data-edited")).toBe(false);
    expect(button(".0__moveUp")?.disabled).toBe(true);
    expect(button(".1__moveDown")?.disabled).toBe(true);
    await click(button("__add"));
    expect(value()).toEqual({ settings: { entries: ["first", "second", "new"] } });
    expect(field().dataset.edited).toBe("true");
    expect(button("__add")).toBeNull();
    await click(button(".2__remove"));
    expect(value()).toEqual({ settings: { entries: ["first", "second"] } });
    expect(field().hasAttribute("data-edited")).toBe(false);
    await click(button("__add"));

    await click(button(".0__moveDown"));
    expect(value()).toEqual({ settings: { entries: ["second", "first", "new"] } });
    await click(button(".2__moveUp"));
    expect(value()).toEqual({ settings: { entries: ["second", "new", "first"] } });
    await click(button(".1__remove"));
    expect(value()).toEqual({ settings: { entries: ["second", "first"] } });
    await click(button(".0__remove"));
    expect(value()).toEqual({ settings: { entries: ["first"] } });
    expect(button(".0__remove")).toBeNull();
  });

  it("honors operation switches from ui:options", async () => {
    const { button } = await render(adapter, {
      spec: {
        ...spec,
        uiSchema: { settings: { entries: { "ui:options": { addable: false, removable: false, orderable: false } } } },
      },
    });
    expect(button("__add")).toBeNull();
    expect(button(".0__remove")).toBeNull();
    expect(button(".0__moveDown")).toBeNull();
    expect(button(".1__moveUp")).toBeNull();
  });

  it.each(["disabled", "readOnly"] as const)("does not allow mutations when %s", async (flag) => {
    const { container, value } = await render(adapter, { [flag]: true });
    const array = container.querySelector('[data-a-form-array="settings.entries"]')!;
    expect([...array.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect(value()).toEqual({ settings: { entries: ["first", "second"] } });
  });

  it("supports arrays of objects containing nested arrays", async () => {
    const objectSpec: NormalizedFormSpec = {
      ...spec,
      schema: {
        type: "object",
        properties: {
          settings: {
            type: "object",
            properties: {
              entries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", default: "new" },
                    tags: { type: "array", items: { type: "string", default: "tag" } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const { button, value } = await render(adapter, { spec: objectSpec }, {
      settings: { entries: [{ name: "first", tags: ["a", "b"] }, { name: "second", tags: [] }] },
    });
    await click(button(".0.tags__add"));
    expect(value()).toMatchObject({ settings: { entries: [{ name: "first", tags: ["a", "b", "tag"] }, { name: "second" }] } });
    await click(button(".0.tags.0__moveDown"));
    expect(value()).toMatchObject({ settings: { entries: [{ tags: ["b", "a", "tag"] }, { name: "second" }] } });
    await click(button(".0.tags.1__remove"));
    expect(value()).toMatchObject({ settings: { entries: [{ tags: ["b", "tag"] }, { name: "second" }] } });
    await click(button(".1__moveUp"));
    expect(value()).toEqual({ settings: { entries: [{ name: "second", tags: [] }, { name: "first", tags: ["b", "tag"] }] } });
  });
});
