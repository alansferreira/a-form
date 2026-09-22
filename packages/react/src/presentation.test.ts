import { describe, expect, it } from "vitest";
import { PresentationAdapterRegistry } from "./presentation.js";

describe("PresentationAdapterRegistry", () => {
  it("registers and resolves adapters by id", () => {
    const registry = new PresentationAdapterRegistry();
    const adapter = { id: "custom" };

    registry.register(adapter);

    expect(registry.get("custom")).toBe(adapter);
    expect(registry.list()).toEqual([adapter]);
  });

  it("rejects duplicate ids", () => {
    const registry = new PresentationAdapterRegistry();
    registry.register({ id: "custom" });

    expect(() => registry.register({ id: "custom" })).toThrow(
      "Presentation adapter 'custom' already registered.",
    );
  });

  it("unregisters an adapter with the disposer returned by register", () => {
    const registry = new PresentationAdapterRegistry();
    const unregister = registry.register({ id: "custom" });

    unregister();

    expect(registry.get("custom")).toBeUndefined();
  });
});
