import { create } from 'zustand'
import type { GitHubActivityDetail } from '~/routes/playground/+lib/github-oauth.server'

interface ActivityState {
  activitiesByDate: Record<string, GitHubActivityDetail[]>
  setActivities: (activities: GitHubActivityDetail[]) => void
  clearActivities: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  activitiesByDate: {},
  setActivities: (activities) => {
    const byDate: Record<string, GitHubActivityDetail[]> = {}
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
  clearActivities: () => set({ activitiesByDate: {} }),
}))
