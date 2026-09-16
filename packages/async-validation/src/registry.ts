import type { AsyncValidationAdapter } from "./types.js";

export class AsyncValidationRegistry {
  private readonly adapters = new Map<string, AsyncValidationAdapter>();

  register(adapter: AsyncValidationAdapter): () => void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Async validation adapter '${adapter.id}' is already registered.`);
    }
    this.adapters.set(adapter.id, adapter);
    return () => this.adapters.delete(adapter.id);
  }

  get(id: string): AsyncValidationAdapter | undefined {
    return this.adapters.get(id);
  }
}