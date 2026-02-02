import { adminClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL ?? 'http://localhost:5173',
  plugins: [organizationClient(), adminClient()],
})

export const { signIn, signOut, signUp, useSession, organization, admin } =
  authClient
