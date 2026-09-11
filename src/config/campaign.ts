/**
 * Campaign types the console supports, and the differences between them that the
 * tests have to account for.
 *
 * The UI never shows the type code — it shows a display name — so a test that
 * asserts on the dropdown option has to translate. The delivery flow also differs:
 * MR-DN runs three weekly cycles and has a cycle-date screen, BEDNET has a single
 * cycle and no cycle-date screen at all, and only MR-DN configures a referral
 * module in the mobile-app setup.
 */
export const CAMPAIGN_TYPES = ['BEDNET', 'MR-DN'] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

const DISPLAY_NAMES: Record<CampaignType, string> = {
  BEDNET: 'Bednet Distribution',
  'MR-DN': 'Seasonal Malaria Chemoprevention (SMC)',
};

export function displayName(type: CampaignType): string {
  return DISPLAY_NAMES[type] ?? type;
}

/** Whether this type's delivery flow includes the cycle-date screen. */
export function hasCycles(type: CampaignType): boolean {
  return type === 'MR-DN';
}

/** Whether the mobile-app setup offers a referral module for this type. */
export function hasReferralModule(type: CampaignType): boolean {
  return type === 'MR-DN';
}
