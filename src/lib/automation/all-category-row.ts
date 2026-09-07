export const ALL_CATEGORY_ID = "__all__";

export type CategoryAutomationRuleSettings = {
  sendHour: number | null;
  sendMinute: number | null;
  smsEnabled: boolean;
  smsTemplateId: string | null;
  whatsappEnabled: boolean;
  whatsappTemplateId: string | null;
  emailEnabled: boolean;
  emailTemplateId: string | null;
  callEnabled: boolean;
};

export type CategoryAutomationDisplayRow = CategoryAutomationRuleSettings & {
  id: string | null;
  categoryId: string;
  categoryName: string;
  contactCount: number;
};

export function ruleSettingsEqual(
  a: CategoryAutomationRuleSettings,
  b: CategoryAutomationRuleSettings,
): boolean {
  return (
    a.sendHour === b.sendHour &&
    a.sendMinute === b.sendMinute &&
    a.smsEnabled === b.smsEnabled &&
    a.smsTemplateId === b.smsTemplateId &&
    a.whatsappEnabled === b.whatsappEnabled &&
    a.whatsappTemplateId === b.whatsappTemplateId &&
    a.emailEnabled === b.emailEnabled &&
    a.emailTemplateId === b.emailTemplateId &&
    a.callEnabled === b.callEnabled
  );
}

/** Synthetic All row - edits apply the same route to every real group. */
export function buildAllCategoryRow(
  rows: CategoryAutomationDisplayRow[],
): CategoryAutomationDisplayRow {
  const totalContacts = rows.reduce((sum, row) => sum + row.contactCount, 0);
  const first = rows[0];
  const uniform = Boolean(
    first && rows.every((row) => ruleSettingsEqual(row, first)),
  );

  return {
    id: null,
    categoryId: ALL_CATEGORY_ID,
    categoryName: "All",
    contactCount: totalContacts,
    sendHour: uniform ? first!.sendHour : null,
    sendMinute: uniform ? first!.sendMinute : null,
    smsEnabled: uniform ? first!.smsEnabled : false,
    smsTemplateId: uniform ? first!.smsTemplateId : null,
    whatsappEnabled: uniform ? first!.whatsappEnabled : false,
    whatsappTemplateId: uniform ? first!.whatsappTemplateId : null,
    emailEnabled: uniform ? first!.emailEnabled : false,
    emailTemplateId: uniform ? first!.emailTemplateId : null,
    callEnabled: uniform ? first!.callEnabled : false,
  };
}

export function applyAllCategoryPatch<T extends CategoryAutomationRuleSettings>(
  rows: T[],
  patch: Partial<CategoryAutomationRuleSettings>,
): T[] {
  return rows.map((row) => ({ ...row, ...patch }));
}

export function categoryGroupsDiffer(
  rows: CategoryAutomationRuleSettings[],
): boolean {
  if (rows.length <= 1) {
    return false;
  }
  return !rows.every((row) => ruleSettingsEqual(row, rows[0]!));
}
