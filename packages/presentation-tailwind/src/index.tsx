import { getTemplate, getUiOptions } from "@rjsf/utils";
import type { FieldTemplateProps } from "@rjsf/utils";
import type { PresentationAdapter, SeparatorTemplateProps } from "a-form-react";

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

function SeparatorTemplate({ id, title, description }: SeparatorTemplateProps) {
  return (
    <div className="a-form-tailwind-separator" role="separator" aria-orientation="horizontal" aria-label={title}>
      <span className="a-form-tailwind-separator-line" aria-hidden="true" />
      <span className="a-form-tailwind-separator-content">
        <span className="a-form-tailwind-separator-title" id={`a-form-separator-title-${id}`}>{title}</span>
        {description && <span className="a-form-tailwind-separator-description">{description}</span>}
      </span>
      <span className="a-form-tailwind-separator-line" aria-hidden="true" />
    </div>
  );
}

export const TailwindAdapter: PresentationAdapter = {
  id: "tailwind",
  className: "a-form-tailwind",
  templates: { FieldTemplate, SeparatorTemplate },
};

export { FieldTemplate as TailwindFieldTemplate };
