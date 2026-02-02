# freee請求書API リファレンス

## 概要

freee請求書APIは以下の帳票タイプに対応:

- 請求書 (invoices)
- 見積書 (quotes)
- 納品書 (delivery_slips)

## ベースURL

```
https://api.freee.co.jp/iv
```

## 認証

OAuth 2.0認証が必要。リクエストヘッダーに以下を含める:

```
Authorization: Bearer {access_token}
```

## エンドポイント一覧

| メソッド | パス                  | 説明                     |
| -------- | --------------------- | ------------------------ |
| GET      | `/invoices`           | 請求書一覧取得           |
| GET      | `/invoices/{id}`      | 請求書個別取得           |
| GET      | `/invoices/templates` | 帳票テンプレート一覧取得 |
| POST     | `/invoices`           | 請求書作成               |
| PUT      | `/invoices/{id}`      | 請求書更新               |

## 共通パラメータ

### 事業所ID (company_id)

すべてのリクエストで必須。freeeの事業所IDを指定。

---

## POST /invoices - 請求書作成

### 必須パラメータ

| パラメータ                     | 型      | 説明                                                                           |
| ------------------------------ | ------- | ------------------------------------------------------------------------------ |
| `company_id`                   | integer | 事業所ID                                                                       |
| `billing_date`                 | string  | 請求日 (YYYY-MM-DD)                                                            |
| `tax_entry_method`             | string  | 消費税の内税・外税区分 (`in`: 内税, `out`: 外税)                               |
| `tax_fraction`                 | string  | 消費税端数計算方法 (`omit`: 切り捨て, `round`: 四捨五入, `round_up`: 切り上げ) |
| `withholding_tax_entry_method` | string  | 源泉徴収計算方法 (`in`: 税込, `out`: 税抜) ※`none`は無効                       |
| `partner_id`                   | integer | 取引先ID                                                                       |
| `partner_title`                | string  | 敬称 (`御中`, `様`, `(空白)` または `（空白）`)                                |
| `lines`                        | array   | 明細行 (後述)                                                                  |

### オプションパラメータ

| パラメータ                        | 型      | 説明                                              |
| --------------------------------- | ------- | ------------------------------------------------- |
| `template_id`                     | integer | 帳票テンプレートID                                |
| `invoice_number`                  | string  | 請求書番号                                        |
| `branch_no`                       | integer | 枝番                                              |
| `payment_date`                    | string  | 支払期日 (YYYY-MM-DD)                             |
| `subject`                         | string  | 件名                                              |
| `invoice_note`                    | string  | 備考                                              |
| `memo`                            | string  | 社内メモ                                          |
| `partner_display_name`            | string  | 宛名                                              |
| `billing_partner_id`              | integer | 請求先ID (顧客と別の場合)                         |
| `partner_address_zipcode`         | string  | 郵便番号                                          |
| `partner_address_prefecture_code` | integer | 都道府県コード (1-47)                             |
| `partner_address_street_name1`    | string  | 市区町村・番地                                    |
| `partner_address_street_name2`    | string  | 建物名・部屋番号など                              |
| `partner_contact_department`      | string  | 取引先部署                                        |
| `partner_contact_name`            | string  | 取引先担当者名                                    |
| `payment_type`                    | string  | 支払方法 (`transfer`: 振込, `direct_debit`: 振替) |
| `partner_bank_account`            | object  | 取引先口座 (振替の場合のみ)                       |

### lines (明細行) パラメータ

| パラメータ         | 型      | 必須 | 説明                                            |
| ------------------ | ------- | ---- | ----------------------------------------------- |
| `type`             | string  |      | 明細の種類 (`item`: 品目行, `text`: テキスト行) |
| `description`      | string  |      | 摘要（品名）                                    |
| `sales_date`       | string  |      | 取引日 (YYYY-MM-DD)                             |
| `unit`             | string  |      | 単位名                                          |
| `quantity`         | string  |      | 数量 (整数8桁、小数3桁まで)                     |
| `unit_price`       | string  |      | 単価 (整数13桁、小数3桁まで) ※string型          |
| `tax_rate`         | integer |      | 税率 (%) - 10, 8, 0 など                        |
| `reduced_tax_rate` | boolean |      | 軽減税率対象                                    |
| `withholding`      | boolean |      | 源泉徴収対象                                    |
| `account_item_id`  | integer |      | 勘定科目ID                                      |
| `tax_code`         | integer |      | 税区分コード                                    |
| `item_id`          | integer |      | 品目ID                                          |
| `section_id`       | integer |      | 部門ID                                          |
| `tag_ids`          | array   |      | メモタグID                                      |

### リクエスト例

```json
{
  "company_id": 12345,
  "template_id": 67890,
  "billing_date": "2024-01-31",
  "payment_date": "2024-02-29",
  "tax_entry_method": "out",
  "tax_fraction": "omit",
  "withholding_tax_entry_method": "none",
  "partner_id": 11111,
  "partner_title": "御中",
  "partner_display_name": "株式会社サンプル",
  "subject": "2024年1月分 システム開発費",
  "invoice_note": "お振込手数料は貴社にてご負担ください。",
  "lines": [
    {
      "type": "item",
      "description": "システム開発費",
      "quantity": "1",
      "unit": "式",
      "unit_price": "100000",
      "tax_rate": 10,
      "reduced_tax_rate": false,
      "withholding": false
    }
  ]
}
```

### レスポンス例

```json
{
  "invoice": {
    "id": 123456,
    "company_id": 12345,
    "invoice_number": "INV-2024-001",
    "billing_date": "2024-01-31",
    "payment_date": "2024-02-29",
    "total_amount": 110000,
    "status": "draft"
  }
}
```

---

## GET /invoices/templates - テンプレート一覧取得

### クエリパラメータ

| パラメータ   | 型      | 必須 | 説明     |
| ------------ | ------- | ---- | -------- |
| `company_id` | integer | \*   | 事業所ID |

### レスポンス例

```json
{
  "invoice_templates": [
    {
      "id": 67890,
      "name": "標準テンプレート",
      "default": true
    }
  ]
}
```

---

## 日付に関する考え方

| freee請求書           | freee会計取引 | freee会計帳票 |
| --------------------- | ------------- | ------------- |
| 請求日 (billing_date) | 発生日        | 売上計上日    |
| 期日 (payment_date)   | 期日          | 期日          |
| -                     | 決済日付      | 入金日        |

※ freee請求書では入金日を指定した帳票作成はできない

---

## 都道府県コード

```
1: 北海道, 2: 青森県, 3: 岩手県, 4: 宮城県, 5: 秋田県,
6: 山形県, 7: 福島県, 8: 茨城県, 9: 栃木県, 10: 群馬県,
11: 埼玉県, 12: 千葉県, 13: 東京都, 14: 神奈川県, 15: 新潟県,
16: 富山県, 17: 石川県, 18: 福井県, 19: 山梨県, 20: 長野県,
21: 岐阜県, 22: 静岡県, 23: 愛知県, 24: 三重県, 25: 滋賀県,
26: 京都府, 27: 大阪府, 28: 兵庫県, 29: 奈良県, 30: 和歌山県,
31: 鳥取県, 32: 島根県, 33: 岡山県, 34: 広島県, 35: 山口県,
36: 徳島県, 37: 香川県, 38: 愛媛県, 39: 高知県, 40: 福岡県,
41: 佐賀県, 42: 長崎県, 43: 熊本県, 44: 大分県, 45: 宮崎県,
46: 鹿児島県, 47: 沖縄県
```

---

## エラーレスポンス

```json
{
  "status_code": 400,
  "errors": [
    {
      "type": "validation",
      "messages": ["billing_date is required"]
    }
  ]
}
```

## 参考リンク

- [freee請求書APIリファレンス](https://developer.freee.co.jp/reference/iv/reference)
- [freee請求書API概要](https://developer.freee.co.jp/reference/iv)
- [移行ガイド](https://developer.freee.co.jp/guideline/content-rel/invoice-transition-guide)
