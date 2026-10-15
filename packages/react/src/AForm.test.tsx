// @vitest-environment jsdom

import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "a-form-async-validation";
import type { JsonObject, NormalizedFormSpec } from "a-form-core";
import type { WidgetProps } from "@rjsf/utils";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AForm } from "./AForm.js";
import type { AFormViewport } from "./AForm.js";
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
    properties: {
      ignored: { type: "string" },
      email: { type: "string", title: "Email" },
      name: { type: "string", title: "Name" },
    },
  },
  layout: [
    { type: "field", id: "name", path: "name", span: { mobile: 12, tablet: 6, desktop: 4 }, align: "start" },
    { type: "field", id: "email", path: "email", span: { mobile: 12, tablet: 6, desktop: 4 }, align: "start" },
  ],
};

const mountedRoots: ReturnType<typeof createRoot>[] = [];

afterEach(() => {
  mountedRoots.forEach((root) => act(() => root.unmount()));
  mountedRoots.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AForm", () => {
  it.each([
    ["mobile", 12],
    ["tablet", 6],
    ["desktop", 4],
    ["auto", 12],
    [undefined, 4],
  ] as const)("renders %s spans without browser measurements", (viewport, span) => {
    const html = renderToStaticMarkup(
      <AForm spec={spec} {...(viewport ? { viewport } : {})} />,
    );
    expect(html).toContain(`grid-column:span ${span}`);
  });

  it("responds to form width in auto mode and disconnects in manual mode", () => {
    let resize: (width: number) => void = () => {
      throw new Error("ResizeObserver has not been created.");
    };
    const observe = vi.fn();
    const disconnect = vi.fn();
    const observerConstructor = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
        observerConstructor();
        resize = (width) => callback([{ contentRect: { width } }]);
      }
      observe = observe;
      disconnect = disconnect;
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    mountedRoots.push(root);
    const render = (viewport: AFormViewport) => act(() => {
      root.render(<AForm spec={spec} viewport={viewport} value={{ name: "Ana" }} />);
    });
    const field = () => container.querySelector<HTMLElement>('[data-a-form-field="name"]');
    render("auto");
    expect(observe).toHaveBeenCalledWith(container.querySelector("form"));

    for (const [width, span] of [[0, 12], [767, 12], [768, 6], [1023, 6], [1024, 4], [1400, 4], [500, 12]] as const) {
      act(() => resize(width));
      expect(field()?.style.gridColumn).toBe(`span ${span}`);
      expect(container.querySelector<HTMLInputElement>('input[name="root.name"]')?.value).toBe("Ana");
    }
    expect(observerConstructor).toHaveBeenCalledTimes(1);

    for (const [viewport, span] of [["desktop", 4], ["tablet", 6], ["mobile", 12]] as const) {
      render(viewport);
      expect(field()?.style.gridColumn).toBe(`span ${span}`);
    }
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(observerConstructor).toHaveBeenCalledTimes(1);

    render("auto");
    act(() => resize(1024));
    expect(field()?.style.gridColumn).toBe("span 4");
    expect(observerConstructor).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
    mountedRoots.pop();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("renders only layout fields with the selected span and AForm order", () => {
    const html = renderToStaticMarkup(<AForm spec={spec} viewport="desktop" />);

    expect(html).not.toContain("name=\"root_ignored\"");
    expect(html).toContain("data-a-form-field=\"name\"");
    expect(html).toContain("data-a-form-field=\"email\"");
    expect(html).toContain("grid-column:span 4");
    expect(html).toMatch(/data-a-form-field="name" style="[^"]*order:0/);
    expect(html).toMatch(/data-a-form-field="email" style="[^"]*order:1/);
  });

  it("uses a registered presentation widget without changing AForm layout", () => {
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

    const html = renderToStaticMarkup(
      <AForm
        spec={spec}
        presentation={{ registry, adapterId: "custom" }}
      />,
    );

    expect(html).toContain('data-custom-widget="text"');
    expect(html).toContain('class="custom-presentation"');
    expect(html).toContain('data-a-form-field="name"');
    expect(html).toContain("grid-column:span 4");
  });

  it("hugs the grid's right edge when a field is align: end", () => {
    const alignedSpec: NormalizedFormSpec = {
      ...spec,
      layout: [
        { type: "field", id: "name", path: "name", span: { mobile: 12, tablet: 12, desktop: 6 }, align: "start" },
        { type: "field", id: "email", path: "email", span: { mobile: 12, tablet: 12, desktop: 3 }, align: "end" },
      ],
    };

    const html = renderToStaticMarkup(<AForm spec={alignedSpec} viewport="desktop" />);

    expect(html).toMatch(/data-a-form-field="name" style="[^"]*grid-column:span 6/);
    expect(html).toMatch(/data-a-form-field="email" style="[^"]*grid-column:span 3 \/ -1/);
  });

  it("renders a titled separator before independent fields", () => {
    const separatorSpec: NormalizedFormSpec = {
      ...spec,
      layout: [
        { type: "separator", id: "contact", title: "Contact info" },
        { type: "field", id: "email", path: "email", span: { mobile: 12, tablet: 12, desktop: 12 }, align: "start" },
      ],
    };

    const html = renderToStaticMarkup(<AForm spec={separatorSpec} viewport="desktop" />);

    expect(html).toContain('class="a-form-separator-title" id="a-form-separator-title-contact">Contact info');
    expect(html.indexOf('class="a-form-separator-item"')).toBeLessThan(html.indexOf('data-a-form-field="email"'));
    expect(html).not.toContain("data-a-form-panel");
  });

  it("renders ui:helpTemplate interpolated against the whole form's data", () => {
    const templatedSpec: NormalizedFormSpec = {
      ...spec,
      uiSchema: { email: { "ui:helpTemplate": "We'll email {{name}} at this address." } },
    };

    const html = renderToStaticMarkup(<AForm spec={templatedSpec} viewport="desktop" value={{ name: "Ana" }} />);

    expect(html).toContain("We&#x27;ll email Ana at this address.");
  });

  it("renders the default date/time/range widgets via ui:widget", () => {
    const widgetSpec: NormalizedFormSpec = {
      ...spec,
      schema: {
        type: "object",
        properties: {
          birthday: { type: "string", title: "Birthday" },
          score: { type: "number", title: "Score" },
        },
      },
      uiSchema: {
        birthday: { "ui:widget": "date" },
        score: { "ui:widget": "range", "ui:options": { min: 0, max: 10, step: 1 } },
      },
      layout: [
        { type: "field", id: "birthday", path: "birthday", span: { mobile: 12, tablet: 12, desktop: 6 }, align: "start" },
        { type: "field", id: "score", path: "score", span: { mobile: 12, tablet: 12, desktop: 6 }, align: "start" },
      ],
    };

    const html = renderToStaticMarkup(<AForm spec={widgetSpec} viewport="desktop" />);

    expect(html).toContain('type="date"');
    expect(html).toMatch(/max="10" min="0" step="1" type="range"/);
  });

  it("renders the default asyncOptions widget with a static source list", () => {
    const widgetSpec: NormalizedFormSpec = {
      ...spec,
      schema: {
        type: "object",
        properties: { country: { type: "string", title: "Country" } },
      },
      uiSchema: {
        country: {
          "ui:widget": "asyncOptions",
          "ui:options": { source: [{ id: "BR", name: "Brazil" }], valueKey: "id", labelKey: "name" },
        },
      },
      layout: [
        { type: "field", id: "country", path: "country", span: { mobile: 12, tablet: 12, desktop: 12 }, align: "start" },
      ],
    };

    const html = renderToStaticMarkup(<AForm spec={widgetSpec} viewport="desktop" />);

    expect(html).toContain('<option value="Brazil"');
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
        <AForm
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
        <AForm
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
    expect(container.querySelector<HTMLButtonElement>(".a-form-submit")?.disabled).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0]![0].dependencyValues).toEqual({ name: "US" });
    expect(container.querySelector<HTMLButtonElement>(".a-form-submit")?.disabled).toBe(false);

    container.remove();
  });
});