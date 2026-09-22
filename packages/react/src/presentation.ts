import type {
  FieldTemplateProps,
  RegistryFieldsType,
  RegistryWidgetsType,
  TemplatesType,
} from "@rjsf/utils";
import type { ComponentType, ReactNode } from "react";

export interface PanelTemplateProps {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly children?: ReactNode;
}

export type PresentationTemplates = Partial<Omit<TemplatesType, "FieldTemplate" | "ObjectFieldTemplate" | "ButtonTemplates">> & {
  readonly FieldTemplate?: ComponentType<FieldTemplateProps>;
  readonly PanelTemplate?: ComponentType<PanelTemplateProps>;
  readonly ButtonTemplates?: Partial<TemplatesType["ButtonTemplates"]>;
};

export interface PresentationAdapter {
  readonly id: string;
  readonly className?: string;
  readonly fields?: RegistryFieldsType;
  readonly widgets?: RegistryWidgetsType;
  readonly templates?: PresentationTemplates;
}

export interface PresentationConfig {
  readonly registry: PresentationAdapterRegistry;
  readonly adapterId: string;
}

export class PresentationAdapterRegistry {
  private readonly adapters = new Map<string, PresentationAdapter>();

  register(adapter: PresentationAdapter): () => void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Presentation adapter '${adapter.id}' already registered.`);
    }
    this.adapters.set(adapter.id, adapter);
    return () => {
      this.adapters.delete(adapter.id);
    };
  }

  get(id: string): PresentationAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): readonly PresentationAdapter[] {
    return [...this.adapters.values()];
  }
}
