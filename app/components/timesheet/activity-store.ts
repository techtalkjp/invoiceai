import { create } from 'zustand'
import type { ActivityRecord } from '~/lib/activity-sources/types'

interface ActivityState {
  activitiesByDate: Record<string, ActivityRecord[]>
  setActivities: (activities: ActivityRecord[]) => void
  setActivitiesByDate: (byDate: Record<string, ActivityRecord[]>) => void
  clearActivities: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  activitiesByDate: {},
  setActivities: (activities) => {
    const byDate: Record<string, ActivityRecord[]> = {}
    for (const a of activities) {
      let arr = byDate[a.eventDate]
      if (!arr) {
        arr = []
        byDate[a.eventDate] = arr
      }
      arr.push(a)
    }
    set({ activitiesByDate: byDate })
  },
  setActivitiesByDate: (byDate) => set({ activitiesByDate: byDate }),
  clearActivities: () => set({ activitiesByDate: {} }),
}))
