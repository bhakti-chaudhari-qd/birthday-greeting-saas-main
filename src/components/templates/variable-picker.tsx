import {
  BUILTIN_TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_LABELS,
  type SupportedTemplateVariable,
} from "@/lib/templates/variables";
import { getTemplatesDict } from "@/lib/i18n/dictionaries/templates";
import { useLocale } from "@/lib/i18n/use-locale";

export type TemplateVariableOption = {
  key: string;
  label: string;
};

export function VariablePicker({
  customVariables,
  onSelect,
}: {
  customVariables: TemplateVariableOption[];
  onSelect: (variable: string) => void;
}) {
  const dict = getTemplatesDict(useLocale()).variablePicker;

  return (
    <select
      className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary"
      value=""
      onChange={(event) => onSelect(event.target.value)}
    >
      <option value="">{dict.addVariable}</option>
      <optgroup label={dict.builtinFields}>
        {BUILTIN_TEMPLATE_VARIABLES.map((variable) => (
          <option key={variable} value={variable}>
            {TEMPLATE_VARIABLE_LABELS[variable as SupportedTemplateVariable]}{" "}
            {`{{${variable}}}`}
          </option>
        ))}
      </optgroup>
      {customVariables.length > 0 ? (
        <optgroup label={dict.customFields}>
          {customVariables.map((variable) => (
            <option key={variable.key} value={variable.key}>
              {variable.label} {`{{${variable.key}}}`}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
