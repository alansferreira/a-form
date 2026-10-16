import { getTemplate, getUiOptions, TranslatableString } from "@rjsf/utils";
import type { ArrayFieldItemTemplateProps, IconButtonProps } from "@rjsf/utils";

function actionButton(labelKey: TranslatableString) {
  return function ActionButton(props: IconButtonProps) {
    const label = props.registry.translateString(labelKey);
    return (
      <button
        id={props.id}
        type="button"
        className={`a-form-action-button ${props.className ?? ""}`}
        title={props.title ?? label}
        aria-label={props["aria-label"] ?? label}
        disabled={props.disabled}
        onClick={props.onClick}
        style={{ minHeight: "2rem", padding: ".375rem .625rem", fontFamily: "inherit", fontSize: "inherit", ...props.style }}
      >
        {label}
      </button>
    );
  };
}

export const defaultActionButtons = {
  AddButton: actionButton(TranslatableString.AddButton),
  CopyButton: actionButton(TranslatableString.CopyButton),
  MoveUpButton: actionButton(TranslatableString.MoveUpButton),
  MoveDownButton: actionButton(TranslatableString.MoveDownButton),
  RemoveButton: actionButton(TranslatableString.RemoveButton),
};

export function ArrayFieldItemTemplate(props: ArrayFieldItemTemplateProps) {
  const ItemButtons = getTemplate("ArrayFieldItemButtonsTemplate", props.registry, getUiOptions(props.uiSchema));
  return (
    <div className={`a-form-array-item ${props.className}`} style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", marginBottom: "1rem" }}>
      <div style={{ flex: "1 1 16rem", minWidth: 0 }}>{props.children}</div>
      {props.hasToolbar && (
        <div className="a-form-array-actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "start", gap: ".25rem" }}>
          <ItemButtons {...props.buttonsProps} />
        </div>
      )}
    </div>
  );
}
