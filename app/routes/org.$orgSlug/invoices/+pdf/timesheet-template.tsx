import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

// 日本語フォントを登録
// サーバーサイドでファイルを直接読み込む
import fs from 'node:fs'
import path from 'node:path'

const fontPath = path.join(
  process.cwd(),
  'app/assets/fonts/NotoSansJP-Regular.ttf',
)
const fontBuffer = fs.readFileSync(fontPath)

Font.register({
  family: 'NotoSansJP',
  src: `data:font/truetype;base64,${fontBuffer.toString('base64')}`,
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
  hoursUnit: {
    fontSize: 7,
  },
  tableColDescription: {
    width: '60%',
    padding: 3,
    textAlign: 'center',
  },
  tableColDescriptionData: {
    width: '60%',
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

export type TimesheetEntry = {
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

export type TimesheetData = {
  staffName: string
  clientName: string
  organizationName: string
  year: number
  month: number
  entries: TimesheetEntry[]
  totalHours: number
}

function TimesheetPage({ data }: { data: TimesheetData }) {
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
          <Text style={styles.tableColHours}>時間</Text>
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

          const date = new Date(entry.date)
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}`

          return (
            <View key={entry.date} style={rowStyles}>
              <Text style={styles.tableColDate}>{dateStr}</Text>
              <Text style={styles.tableColDay}>
                {DAY_LABELS[entry.dayOfWeek]}
                {entry.isHoliday && '\n祝'}
              </Text>
              <Text style={styles.tableColTime}>{entry.startTime ?? '-'}</Text>
              <Text style={styles.tableColTime}>{entry.endTime ?? '-'}</Text>
              <View style={styles.tableColHoursData}>
                {entry.hours > 0 ? (
                  <>
                    <Text>{entry.hours}</Text>
                    <Text style={styles.hoursUnit}>h</Text>
                  </>
                ) : (
                  <Text>-</Text>
                )}
              </View>
              <Text style={styles.tableColDescriptionData}>
                {entry.description ?? ''}
              </Text>
            </View>
          )
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>合計稼働時間:</Text>
        <View style={styles.totalValue}>
          <Text>{data.totalHours}</Text>
          <Text style={styles.hoursUnit}>h</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Generated at {new Date().toISOString().split('T')[0]}
      </Text>
    </Page>
  )
}

export function TimesheetDocument({
  timesheets,
}: {
  timesheets: TimesheetData[]
}) {
  return (
    <Document>
      {timesheets.map((data, index) => (
        <TimesheetPage key={`${data.staffName}-${index}`} data={data} />
      ))}
    </Document>
  )
}
