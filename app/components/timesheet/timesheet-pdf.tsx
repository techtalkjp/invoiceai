import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import {
  calculateWorkDuration,
  splitHoursMinutes,
} from '~/components/time/time-utils'
import type { TimesheetEntry } from './types'
import { getHolidayName } from './utils'

// クライアント側: Google Fonts CDN でフォント登録
Font.register({
  family: 'NotoSansJP',
  src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf',
})

// --- 共通型定義 ---

export interface PdfTimesheetEntry {
  date: string
  dayOfWeek: number
  isHoliday: boolean
  holidayName?: string | undefined
  startTime?: string | undefined
  endTime?: string | undefined
  breakMinutes: number
  hours: number
  description?: string | undefined
}

export interface PdfTimesheetData {
  staffName: string
  clientName: string
  organizationName: string
  year: number
  month: number
  entries: PdfTimesheetEntry[]
  totalHours: number
}

export interface TimesheetPdfInfo {
  organizationName: string
  clientName: string
  staffName: string
}

// --- 共通データ変換 ---

/**
 * サーバー側 getTimesheetDataForPdf() の結果を PdfTimesheetData[] に変換する共通関数。
 * getHolidayName 呼び出し、dayOfWeek 計算、null→undefined 変換を一手に引き受ける。
 */
export function buildTimesheetPdfData(rawData: {
  clientName: string
  organizationName: string
  year: number
  month: number
  staffTimesheets: Array<{
    staffName: string
    entries: Array<{
      date: string
      startTime: string | null
      endTime: string | null
      breakMinutes: number
      hours: number
      description: string | null
    }>
    totalHours: number
  }>
}): PdfTimesheetData[] {
  return rawData.staffTimesheets.map((staff) => {
    const entries: PdfTimesheetEntry[] = staff.entries.map((entry) => {
      const dateObj = new Date(entry.date)
      const holidayName = getHolidayName(entry.date)

      return {
        date: entry.date,
        dayOfWeek: dateObj.getDay(),
        isHoliday: !!holidayName,
        holidayName: holidayName ?? undefined,
        startTime: entry.startTime ?? undefined,
        endTime: entry.endTime ?? undefined,
        breakMinutes: entry.breakMinutes ?? 0,
        hours: entry.hours ?? 0,
        description: entry.description ?? undefined,
      }
    })

    return {
      staffName: staff.staffName,
      clientName: rawData.clientName,
      organizationName: rawData.organizationName,
      year: rawData.year,
      month: rawData.month,
      entries,
      totalHours: staff.totalHours,
    }
  })
}

// --- スタイル ---

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'NotoSansJP',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  table: {
    display: 'flex',
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
  },
  tableColDate: {
    width: '8%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderRightStyle: 'solid',
    textAlign: 'center',
  },
  tableColDay: {
    width: '6%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderRightStyle: 'solid',
    textAlign: 'center',
  },
  tableColTime: {
    width: '9%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderRightStyle: 'solid',
    textAlign: 'center',
  },
  tableColBreak: {
    width: '8%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderRightStyle: 'solid',
    textAlign: 'center',
  },
  tableColBreakData: {
    width: '8%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderRightStyle: 'solid',
    textAlign: 'right',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
  },
  tableColHours: {
    width: '8%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderRightStyle: 'solid',
    textAlign: 'center',
  },
  tableColHoursData: {
    width: '8%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderRightStyle: 'solid',
    textAlign: 'right',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
  },
  unit: {
    fontSize: 7,
  },
  tableColDescription: {
    width: '52%',
    padding: 3,
    textAlign: 'center',
  },
  tableColDescriptionData: {
    width: '52%',
    padding: 3,
    fontSize: 8,
  },
  weekend: {
    backgroundColor: '#f8f8f8',
  },
  holiday: {
    backgroundColor: '#f8f8f8',
    color: '#666',
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  totalLabel: {
    fontWeight: 'bold',
    marginRight: 10,
  },
  totalValue: {
    fontWeight: 'bold',
    width: 60,
    textAlign: 'right',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
})

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// 3行を超えたら省略
function truncateDescription(text: string | undefined, maxLines = 3): string {
  if (!text) return ''
  const lines = text.split('\n')
  if (lines.length <= maxLines) return text
  return `${lines.slice(0, maxLines).join('\n')}...`
}

// --- 時間/分の表示ヘルパー ---

function HoursDisplay({ value }: { value: number }) {
  if (value <= 0) return <Text>-</Text>
  const totalMinutes = Math.round(value * 60)
  const { hours, minutes } = splitHoursMinutes(totalMinutes)
  if (minutes === 0) {
    return (
      <>
        <Text>{hours}</Text>
        <Text style={styles.unit}>時間</Text>
      </>
    )
  }
  if (hours === 0) {
    return (
      <>
        <Text>{minutes}</Text>
        <Text style={styles.unit}>分</Text>
      </>
    )
  }
  return (
    <>
      <Text>{hours}</Text>
      <Text style={styles.unit}>時間</Text>
      <Text>{minutes}</Text>
      <Text style={styles.unit}>分</Text>
    </>
  )
}

function BreakDisplay({ minutes: totalMinutes }: { minutes: number }) {
  if (totalMinutes <= 0) return <Text>-</Text>
  const { hours, minutes } = splitHoursMinutes(totalMinutes)
  if (minutes === 0) {
    return (
      <>
        <Text>{hours}</Text>
        <Text style={styles.unit}>時間</Text>
      </>
    )
  }
  if (hours === 0) {
    return (
      <>
        <Text>{minutes}</Text>
        <Text style={styles.unit}>分</Text>
      </>
    )
  }
  return (
    <>
      <Text>{hours}</Text>
      <Text style={styles.unit}>時間</Text>
      <Text>{minutes}</Text>
      <Text style={styles.unit}>分</Text>
    </>
  )
}

// --- PDF コンポーネント ---

function TimesheetPdfPage({ data }: { data: PdfTimesheetData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>稼働報告書</Text>
        <Text style={styles.subtitle}>
          {data.year}年{data.month}月
        </Text>
        <View style={styles.infoRow}>
          <Text>{data.clientName}</Text>
          <Text>{data.organizationName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text />
          <Text>{data.staffName}</Text>
        </View>
      </View>

      <View style={styles.table}>
        {/* ヘッダー行 */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.tableColDate}>日付</Text>
          <Text style={styles.tableColDay}>曜日</Text>
          <Text style={styles.tableColTime}>開始</Text>
          <Text style={styles.tableColTime}>終了</Text>
          <Text style={styles.tableColBreak}>休憩</Text>
          <Text style={styles.tableColHours}>稼働</Text>
          <Text style={styles.tableColDescription}>備考</Text>
        </View>

        {/* データ行 */}
        {data.entries.map((entry, index) => {
          const isLast = index === data.entries.length - 1
          const isWeekend = entry.dayOfWeek === 0 || entry.dayOfWeek === 6
          const rowStyles = [
            isLast ? styles.tableRowLast : styles.tableRow,
            ...(isWeekend ? [styles.weekend] : []),
            ...(entry.isHoliday ? [styles.holiday] : []),
          ]

          const d = new Date(entry.date)
          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`

          return (
            <View key={entry.date} style={rowStyles}>
              <Text style={styles.tableColDate}>{dateStr}</Text>
              <Text style={styles.tableColDay}>
                {DAY_LABELS[entry.dayOfWeek]}
                {entry.isHoliday && '\n祝'}
              </Text>
              <Text style={styles.tableColTime}>{entry.startTime ?? '-'}</Text>
              <Text style={styles.tableColTime}>{entry.endTime ?? '-'}</Text>
              <View style={styles.tableColBreakData}>
                <BreakDisplay minutes={entry.breakMinutes} />
              </View>
              <View style={styles.tableColHoursData}>
                <HoursDisplay value={entry.hours} />
              </View>
              <Text style={styles.tableColDescriptionData}>
                {truncateDescription(entry.description)}
              </Text>
            </View>
          )
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>合計稼働時間:</Text>
        <View style={styles.totalValue}>
          <HoursDisplay value={data.totalHours} />
          {data.totalHours === 0 && <Text>0時間</Text>}
        </View>
      </View>

      <Text style={styles.footer}>
        Generated at {new Date().toISOString().split('T')[0]}
      </Text>
    </Page>
  )
}

/**
 * 複数スタッフ対応の Document コンポーネント。
 * サーバー側 (renderToBuffer) / クライアント側 (pdf().toBlob()) どちらでも使用可能。
 */
export function TimesheetPdfDocument({
  timesheets,
}: {
  timesheets: PdfTimesheetData[]
}) {
  return (
    <Document>
      {timesheets.map((data, index) => (
        <TimesheetPdfPage key={`${data.staffName}-${index}`} data={data} />
      ))}
    </Document>
  )
}

// --- クライアント側 PDF 生成ユーティリティ ---

/**
 * クライアント側でタイムシートPDFを生成する。
 * work-hours の個別クライアントビューから呼ばれる。
 */
export async function generateTimesheetPdf(
  year: number,
  month: number,
  data: Record<string, TimesheetEntry | undefined>,
  dates: string[],
  getHolidayNameFn: (date: string) => string | null,
  info: TimesheetPdfInfo,
): Promise<Blob> {
  // 稼働がある日のみをエントリとして抽出
  const entries: PdfTimesheetEntry[] = []
  for (const date of dates) {
    const entry = data[date]
    if (!entry?.startTime || !entry?.endTime) continue

    const d = new Date(date)
    const dayOfWeek = d.getDay()
    const holidayName = getHolidayNameFn(date)
    const duration = calculateWorkDuration(
      entry.startTime,
      entry.endTime,
      entry.breakMinutes,
    )
    const hours = duration.workMinutes / 60

    entries.push({
      date,
      dayOfWeek,
      isHoliday: !!holidayName,
      holidayName: holidayName ?? undefined,
      startTime: entry.startTime,
      endTime: entry.endTime,
      breakMinutes: entry.breakMinutes,
      hours,
      description: entry.description || undefined,
    })
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)

  const timesheets: PdfTimesheetData[] = [
    {
      staffName: info.staffName,
      clientName: info.clientName,
      organizationName: info.organizationName,
      year,
      month,
      entries,
      totalHours,
    },
  ]

  const doc = <TimesheetPdfDocument timesheets={timesheets} />
  return await pdf(doc).toBlob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
