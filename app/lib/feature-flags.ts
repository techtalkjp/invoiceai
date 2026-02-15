export const FEATURE_FLAGS = {
  signup_enabled: {
    description: '新規ユーザー登録の許可/不許可を制御します',
  },
} as const

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS
