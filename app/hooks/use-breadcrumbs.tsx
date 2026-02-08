import { Fragment } from 'react'
import { Link, useMatches } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'

interface BreadcrumbEntry {
  label: string
  to?: string | undefined
}

type BreadcrumbResult = BreadcrumbEntry | BreadcrumbEntry[]

function isBreadcrumbHandle(
  handle: unknown,
): handle is { breadcrumb: (data: unknown) => BreadcrumbResult } {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'breadcrumb' in handle &&
    typeof (handle as Record<string, unknown>).breadcrumb === 'function'
  )
}

export function useBreadcrumbs() {
  const matches = useMatches()

  const items: (BreadcrumbEntry & { isCurrentPage: boolean })[] = []
  const breadcrumbMatches = matches.filter((match) =>
    isBreadcrumbHandle(match.handle),
  )

  for (const match of breadcrumbMatches) {
    if (!isBreadcrumbHandle(match.handle)) continue
    const result = match.handle.breadcrumb(match.data)
    const entries = Array.isArray(result) ? result : [result]
    for (const entry of entries) {
      items.push({ ...entry, isCurrentPage: false })
    }
  }

  // 最後のアイテムを現在のページとしてマーク
  if (items.length > 0) {
    const last = items[items.length - 1]
    if (last) last.isCurrentPage = true
  }

  function Breadcrumbs() {
    if (items.length === 0) return null

    return (
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, idx) => (
            <Fragment key={item.to ?? item.label}>
              {idx > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {item.isCurrentPage || !item.to ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return { Breadcrumbs, items }
}
