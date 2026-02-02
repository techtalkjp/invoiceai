export type GoogleDeps = {
  getAccessToken: () => Promise<string>
  refreshToken: () => Promise<string>
}

export async function googleRequest<T>(
  url: string,
  deps: GoogleDeps,
  retry = true,
): Promise<T> {
  const token = await deps.getAccessToken()

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (response.status === 401 && retry) {
    // トークン期限切れ、リフレッシュして再試行
    console.log('Google トークンを更新中...')
    await deps.refreshToken()
    return googleRequest(url, deps, false)
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Google API Error: ${response.status} ${response.statusText}\n${errorBody}`,
    )
  }

  return response.json() as Promise<T>
}
