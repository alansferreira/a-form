import { describe, expect, it } from "vitest";
import { resolveAsyncOptions } from "./widgets.js";

describe("resolveAsyncOptions", () => {
  it("maps a static list of objects using valueKey/labelKey", () => {
    const items = resolveAsyncOptions(
      [{ id: "BR", name: "Brazil" }, { id: "CR", name: "Costa Rica" }],
      { valueKey: "id", labelKey: "name" },
    );
    expect(items).toEqual([
      { value: "BR", label: "Brazil" },
      { value: "CR", label: "Costa Rica" },
    ]);
  });

  it("defaults to value/label keys when none are given", () => {
    const items = resolveAsyncOptions([{ value: "a", label: "A" }], {});
    expect(items).toEqual([{ value: "a", label: "A" }]);
  });

  it("renders a Mustache item template for the label", () => {
    const items = resolveAsyncOptions(
      [{ id: "SP", name: "São Paulo", state: "SP" }],
      { valueKey: "id", itemTemplate: "{{item.name}} ({{item.state}})" },
    );
    expect(items).toEqual([{ value: "SP", label: "São Paulo (SP)" }]);
  });

  it("returns an empty list for non-array sources", () => {
    expect(resolveAsyncOptions(undefined, {})).toEqual([]);
    expect(resolveAsyncOptions("https://example.com", {})).toEqual([]);
  });

  it("falls back to the raw item when it isn't an object", () => {
    expect(resolveAsyncOptions(["BR", "CR"], {})).toEqual([
      { value: "BR", label: "BR" },
      { value: "CR", label: "CR" },
    ]);
  });
});
