import { getTemplate, getUiOptions } from "@rjsf/utils";
import type { FieldTemplateProps } from "@rjsf/utils";
import type { PresentationAdapter } from "a-form-react";

function FieldTemplate(props: FieldTemplateProps) {
  const options = getUiOptions(props.uiSchema);
  const WrapIfAdditionalTemplate = getTemplate("WrapIfAdditionalTemplate", props.registry, options);
  const isCheckbox = options.widget === "checkbox" || props.schema.type === "boolean";

  return (
    <WrapIfAdditionalTemplate {...props}>
      {props.displayLabel && !isCheckbox && (
        <label className="a-form-tailwind-label" htmlFor={props.id}>
          {props.label}
          {props.required ? <span className="a-form-tailwind-required"> *</span> : null}
        </label>
      )}
      {props.displayLabel ? props.description : null}
      {props.children}
      {!props.hideError && props.errors}
      {props.help}
    </WrapIfAdditionalTemplate>
  );
}

export const TailwindAdapter: PresentationAdapter = {
  id: "tailwind",
  className: "a-form-tailwind",
  templates: { FieldTemplate },
};

export { FieldTemplate as TailwindFieldTemplate };
