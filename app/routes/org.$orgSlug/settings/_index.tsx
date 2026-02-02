import { redirect } from 'react-router'
import type { Route } from './+types/_index'

export function loader({ params }: Route.LoaderArgs) {
  return redirect(`/org/${params.orgSlug}/settings/general`)
}
