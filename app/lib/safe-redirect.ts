/**
 * callbackURL が安全な相対パスかどうかを検証し、安全ならそのまま返す。
 * 外部URLやプロトコル付きURLの場合は fallback を返す。
 */
export function getSafeCallbackURL(
  url: string | null,
  fallback: string,
): string {
  if (!url) return fallback

  // 相対パスのみ許可: "/" で始まり、"//" で始まらない（プロトコル相対URL排除）
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }

  return fallback
}
