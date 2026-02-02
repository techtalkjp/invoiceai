import { auth } from '~/lib/auth'
import type { Route } from './+types/$'

export async function loader({ request }: Route.LoaderArgs) {
  return await auth.handler(request)
}

export async function action({ request }: Route.ActionArgs) {
  return await auth.handler(request)
}
