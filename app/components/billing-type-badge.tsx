import { Badge } from '~/components/ui/badge'

export function BillingTypeBadge({ billingType }: { billingType: string }) {
  return (
    <Badge variant="outline">
      {billingType === 'time' ? '時間制' : '固定'}
    </Badge>
  )
}
