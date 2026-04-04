# 為替レート取得: 日銀 時系列統計データ API

公式マニュアル: https://www.stat-search.boj.or.jp/info/api_manual.pdf

## ソース

日本銀行 時系列統計データ API（2026年2月18日公開）。認証不要、無料。

## 使用するレート

**USD/JPY 仲値（TTM = Central Rate）、当月末営業日の日次データ**

- DB名: `FM08`（外国為替市況）
- 系列コード: `FXERD05`（東京市場 ドル・円 スポット インター Central rate、日次）
- 単位: Yen per U.S. Dollar

## API 仕様

### エンドポイント（コード API）

```
GET https://www.stat-search.boj.or.jp/api/v1/getDataCode?<パラメータ>
```

### パラメータ

| パラメータ | 設定内容         | 値                            | 必須 |
| ---------- | ---------------- | ----------------------------- | ---- |
| FORMAT     | 結果ファイル形式 | `json` / `csv`（省略時 json） | 任意 |
| LANG       | 言語             | `jp` / `en`（省略時 jp）      | 任意 |
| DB         | DB名             | `FM08`                        | 必須 |
| CODE       | 系列コード       | `FXERD05`                     | 必須 |
| STARTDATE  | 開始期           | `YYYYMM` 形式（例: `202603`） | 任意 |
| ENDDATE    | 終了期           | `YYYYMM` 形式（例: `202603`） | 任意 |

※パラメータ名は大文字小文字を区別しない

### リクエスト例

```
https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=jp&db=FM08&code=FXERD05&startDate=202603&endDate=202603
```

### レスポンス構造

```json
{
  "STATUS": 200,
  "MESSAGEID": "M181000I",
  "MESSAGE": "正常に終了しました。",
  "DATE": "2026-04-04T13:13:14.587+09:00",
  "PARAMETER": {
    "FORMAT": "JSON",
    "LANG": "JP",
    "DB": "FM08",
    "STARTDATE": "202603",
    "ENDDATE": "202603",
    "STARTPOSITION": ""
  },
  "NEXTPOSITION": null,
  "RESULTSET": [
    {
      "SERIES_CODE": "FXERD05",
      "NAME_OF_TIME_SERIES_J": "東京市場 ドル・円 スポット インター Central rate",
      "UNIT_J": "円／ドル",
      "FREQUENCY": "DAILY",
      "CATEGORY_J": "外国為替市況（日次）",
      "LAST_UPDATE": 20260401,
      "VALUES": {
        "SURVEY_DATES": [20260302, 20260303, ..., 20260331],
        "VALUES": [149.53, null, 150.21, ..., 149.80]
      }
    }
  ]
}
```

lang=en の場合は `NAME_OF_TIME_SERIES`, `UNIT`, `CATEGORY` になる。

### STATUS コード

| STATUS | MESSAGEID          | 意味                                               |
| ------ | ------------------ | -------------------------------------------------- |
| 200    | M181000I           | 正常終了（欠損値 null を含む場合あり）             |
| 200    | M181030I           | 正常終了だが該当データなし（指定期間外 or 全欠損） |
| 400    | M181001E〜M181020E | パラメータエラー                                   |
| 500    | M181090S           | 予期しないエラー                                   |
| 503    | M181091S           | データベースアクセスエラー                         |

### 制限事項

- 1リクエストの系列数上限: 250件
- 1リクエストのデータ数上限: 60,000件（系列数 × 期数）
- **高頻度アクセスは遮断される可能性あり**（キャッシュ必須、繰り返し時は間隔をあける）
- gzip 対応（`Accept-Encoding: gzip` ヘッダで圧縮取得可能）

### データ更新タイミング

- 原則 **8時50分頃（JST）** に時系列統計データが更新される
- 業務都合により遅れる場合あり
- 各統計の公表日: https://www.boj.or.jp/statistics/outline/index.htm

### 欠損値

- 非営業日（土日祝）のデータは `null` で返る
- 月末から逆順に走査し、最初の非null値が月末営業日のレート

## 取得フロー

1. 請求書作成時に `exchange_rate` テーブルを year_month + currency_pair で検索
2. `is_manual = 1` のレコードがあればそれを使用（手動設定は保護）
3. キャッシュ（`is_manual = 0`）があればそれを使用
4. なければ日銀 API でコード API を呼び出し:
   - `db=FM08&code=FXERD05&startDate=YYYYMM&endDate=YYYYMM`
   - STATUS=200 かつ MESSAGEID=`M181000I` を確認
   - RESULTSET[0].VALUES.VALUES を末尾から走査、最初の非null値を採用
5. `exchange_rate` テーブルに保存（`is_manual = 0`, `source = 'boj'`）

### エラーハンドリング

- STATUS != 200 → UI に「レート取得に失敗しました」と表示
- MESSAGEID = `M181030I`（データなし）→ 当月のレートがまだ公表されていない可能性。UI に「まだ公表されていません」と表示
- 全 VALUES が null → 上記と同じ扱い

## 手動上書き

- UI から手動でレートを入力可能
- 上書き時は `is_manual = 1`, `source = 'manual'`, `override_reason` に理由を記録
- API 再取得は `is_manual = 0` のレコードのみ上書き。手動レコードは保護される
- 手動レートを解除（API 取得値に戻す）操作も可能

## フォールバック

自動フォールバックはしない。ソースの異なるレート（ECB等）を暗黙で使うと請求根拠が曖昧になるため。

日銀 API が障害の場合:

1. UI に「レートを取得できませんでした」とエラー表示
2. 手動でレートを入力（`is_manual = 1`, 理由記録必須）
3. API 復旧後に手動レートを使い続けるか再取得するかはユーザーが判断
