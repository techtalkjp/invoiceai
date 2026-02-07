import { useCallback, useEffect } from 'react'
import { useTimesheetStore } from './store'

/**
 * タイムシートの選択操作を管理するフック。
 * - グローバルな mouse/touch イベントリスナー
 * - ドラッグ中の自動スクロール
 * - 選択解除（テーブル外クリック用）
 * - mouseUp ハンドラ（テーブル内用）
 */
export function useTimesheetSelection() {
  // グローバルな mouseup/mousemove/touch イベント + 自動スクロール
  useEffect(() => {
    let scrollAnimationId: number | null = null

    const cancelScroll = () => {
      if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId)
        scrollAnimationId = null
      }
    }

    const handleGlobalMouseUp = () => {
      useTimesheetStore.getState().setIsDragging(false)
      cancelScroll()
    }

    const updateSelectionFromY = (y: number) => {
      const rows = Array.from(
        document.querySelectorAll('[data-date]'),
      ) as HTMLElement[]
      if (rows.length === 0) return

      let closestRow: HTMLElement | null = null
      let closestDistance = Number.POSITIVE_INFINITY

      for (const row of rows) {
        const rect = row.getBoundingClientRect()
        const rowCenterY = rect.top + rect.height / 2
        const distance = Math.abs(y - rowCenterY)

        if (y < rect.top && rows.indexOf(row) === 0) {
          closestRow = row
          break
        }
        if (y > rect.bottom && rows.indexOf(row) === rows.length - 1) {
          closestRow = row
          break
        }
        if (distance < closestDistance) {
          closestDistance = distance
          closestRow = row
        }
      }

      if (closestRow) {
        const date = closestRow.dataset.date
        if (date) {
          useTimesheetStore.getState().extendSelection(date)
        }
      }
    }

    const startAutoScroll = (y: number) => {
      const scrollThreshold = 80
      const scrollSpeed = 15
      const viewportHeight = window.innerHeight

      cancelScroll()

      const autoScroll = () => {
        let scrolled = false
        if (y < scrollThreshold) {
          window.scrollBy(0, -scrollSpeed)
          scrolled = true
        } else if (y > viewportHeight - scrollThreshold) {
          window.scrollBy(0, scrollSpeed)
          scrolled = true
        }

        if (scrolled && useTimesheetStore.getState().isDragging) {
          updateSelectionFromY(y)
          scrollAnimationId = requestAnimationFrame(autoScroll)
        }
      }

      if (y < scrollThreshold || y > viewportHeight - scrollThreshold) {
        scrollAnimationId = requestAnimationFrame(autoScroll)
      }
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const { isDragging, dragStartDate } = useTimesheetStore.getState()
      if (!isDragging || !dragStartDate) return

      startAutoScroll(e.clientY)
      updateSelectionFromY(e.clientY)
    }

    const handleGlobalTouchEnd = () => {
      useTimesheetStore.getState().setIsDragging(false)
      cancelScroll()
    }

    const handleGlobalTouchMove = (e: TouchEvent) => {
      const { isDragging, dragStartDate } = useTimesheetStore.getState()
      if (!isDragging || !dragStartDate) return

      const touch = e.touches[0]
      if (!touch) return

      startAutoScroll(touch.clientY)
      updateSelectionFromY(touch.clientY)
      e.preventDefault()
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('touchend', handleGlobalTouchEnd)
    window.addEventListener('touchmove', handleGlobalTouchMove, {
      passive: false,
    })
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('touchend', handleGlobalTouchEnd)
      window.removeEventListener('touchmove', handleGlobalTouchMove)
      cancelScroll()
    }
  }, [])

  // テーブル内の mouseUp ハンドラ
  const handleMouseUp = useCallback(() => {
    useTimesheetStore.getState().setIsDragging(false)
  }, [])

  // テーブル外クリックで選択解除
  const handleClearSelection = useCallback(() => {
    const { selectedDates, setSelectedDates } = useTimesheetStore.getState()
    if (selectedDates.length > 0) {
      setSelectedDates([])
    }
  }, [])

  return { handleMouseUp, handleClearSelection }
}
