import { deepEquals, getByPath } from "@rjsf/utils";
import type { JsonObject } from "a-form-core";
import { createElement, useState } from "react";
import type { CSSProperties } from "react";
import type { PresentationAdapter } from "./presentation.js";

interface FieldEdit {
  readonly original: unknown;
  readonly current: unknown;
}

export function useEditedFields(value?: JsonObject) {
  const [edits, setEdits] = useState<ReadonlyMap<string, FieldEdit>>(() => new Map());

  return {
    editedPaths: [...edits].filter(([path, edit]) => !deepEquals(
      edit.original,
      value === undefined ? edit.current : getByPath(value, path.split(".")),
    )).map(([path]) => path),
    recordChange(path: string, previous: JsonObject, next: JsonObject): void {
      const segments = path.split(".");
      if (deepEquals(getByPath(previous, segments), getByPath(next, segments))) return;
      setEdits((current) => {
        const updated = new Map(current);
        for (let index = 1; index <= segments.length; index++) {
          const fieldSegments = segments.slice(0, index);
          const fieldPath = fieldSegments.join(".");
          if (!updated.has(fieldPath)) {
            updated.set(fieldPath, { original: getByPath(previous, fieldSegments), current: undefined });
          }
        }
        for (const [fieldPath, edit] of updated) {
          updated.set(fieldPath, { original: edit.original, current: getByPath(next, fieldPath.split(".")) });
        }
        return updated;
      });
    },
  };
}

export function EditedFieldStyles() {
  return createElement("style", null, `
    :is(.a-form-field, .a-form-inline-field).a-form-field-edited :is(input, select, textarea, label, .a-form-inline-read) {
      font-weight: var(--a-form-edited-font-weight, inherit);
    }
  `);
}

export function editedFieldStyle(adapter?: PresentationAdapter): CSSProperties & {
  readonly "--a-form-edited-font-weight": NonNullable<CSSProperties["fontWeight"]>;
} {
  const style: CSSProperties = {
    fontWeight: 700,
    ...adapter?.editedFieldStyle,
  };
  return { ...style, "--a-form-edited-font-weight": style.fontWeight ?? 700 };
}
