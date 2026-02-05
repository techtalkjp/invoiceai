import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import { calculateWorkDuration } from './time-utils'
import type { TimesheetEntry } from './timesheet'

// 日本語フォント登録（Google Fonts CDN）
Font.register({
  family: 'NotoSansJP',
  src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf',
})

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

export interface TimesheetPdfInfo {
  organizationName: string
  clientName: string
  staffName: string
}

interface TimesheetPdfProps {
  year: number
  month: number
  data: Record<string, TimesheetEntry | undefined>
  dates: string[]
  getHolidayName: (date: string) => string | null
  info: TimesheetPdfInfo
}

function TimesheetPdfDocument({
  year,
  month,
  data,
  dates,
  getHolidayName,
  info,
}: TimesheetPdfProps) {
  // 稼働がある日のみをエントリとして抽出
  const entries = dates
    .map((date) => {
      const entry = data[date]
      if (!entry?.startTime || !entry?.endTime) return null

      const d = new Date(date)
      const dayOfWeek = d.getDay()
      const holidayName = getHolidayName(date)
      const duration = calculateWorkDuration(
        entry.startTime,
        entry.endTime,
        entry.breakMinutes,
      )
      const hours = duration.workMinutes / 60

      return {
        date,
        dayOfWeek,
        isHoliday: !!holidayName,
        holidayName: holidayName ?? undefined,
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes,
        hours,
        description: entry.description,
      }
    })
    .filter((entry) => entry !== null)

  // 合計時間
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>稼働報告書</Text>
          <Text style={styles.subtitle}>
            {year}年{month}月
          </Text>
          <View style={styles.infoRow}>
            <Text>{info.clientName}</Text>
            <Text>{info.organizationName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text />
            <Text>{info.staffName}</Text>
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
          {entries.map((entry, index) => {
            const isLast = index === entries.length - 1
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
                <Text style={styles.tableColTime}>
                  {entry.startTime ?? '-'}
                </Text>
                <Text style={styles.tableColTime}>{entry.endTime ?? '-'}</Text>
                <View style={styles.tableColBreakData}>
                  {entry.breakMinutes > 0 ? (
                    <>
                      {entry.breakMinutes >= 60 && (
                        <>
                          <Text>{Math.floor(entry.breakMinutes / 60)}</Text>
                          <Text style={styles.unit}>時間</Text>
                        </>
                      )}
                      {entry.breakMinutes % 60 > 0 && (
                        <>
                          <Text>{entry.breakMinutes % 60}</Text>
                          <Text style={styles.unit}>分</Text>
                        </>
                      )}
                    </>
                  ) : (
                    <Text>-</Text>
                  )}
                </View>
                <View style={styles.tableColHoursData}>
                  {entry.hours > 0 ? (
                    <>
                      {Math.floor(entry.hours) > 0 && (
                        <>
                          <Text>{Math.floor(entry.hours)}</Text>
                          <Text style={styles.unit}>時間</Text>
                        </>
                      )}
                      {(entry.hours % 1) * 60 > 0 && (
                        <>
                          <Text>{Math.round((entry.hours % 1) * 60)}</Text>
                          <Text style={styles.unit}>分</Text>
                        </>
                      )}
                    </>
                  ) : (
                    <Text>-</Text>
                  )}
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
            {Math.floor(totalHours) > 0 && (
              <>
                <Text>{Math.floor(totalHours)}</Text>
                <Text style={styles.unit}>時間</Text>
              </>
            )}
            {Math.round((totalHours % 1) * 60) > 0 && (
              <>
                <Text>{Math.round((totalHours % 1) * 60)}</Text>
                <Text style={styles.unit}>分</Text>
              </>
            )}
            {totalHours === 0 && <Text>0時間</Text>}
          </View>
        </View>

        <Text style={styles.footer}>
          Generated at {new Date().toISOString().split('T')[0]}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateTimesheetPdf(
  year: number,
  month: number,
  data: Record<string, TimesheetEntry | undefined>,
  dates: string[],
  getHolidayName: (date: string) => string | null,
  info: TimesheetPdfInfo,
): Promise<Blob> {
  const doc = (
    <TimesheetPdfDocument
      year={year}
      month={month}
      data={data}
      dates={dates}
      getHolidayName={getHolidayName}
      info={info}
    />
  )
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
