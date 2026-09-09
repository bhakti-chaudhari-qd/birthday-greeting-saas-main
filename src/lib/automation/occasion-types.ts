export const OccasionType = {
  BIRTHDAY: "BIRTHDAY",
  ANNIVERSARY: "ANNIVERSARY",
  CUSTOM: "CUSTOM",
} as const;

export type OccasionType = (typeof OccasionType)[keyof typeof OccasionType];