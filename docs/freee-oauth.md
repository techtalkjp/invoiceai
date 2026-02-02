# freee OAuth 2.0 認証ガイド

## 概要

freee APIはOAuth 2.0による認証が必要。

## 認証フロー (Authorization Code Flow)

### 1. アプリ登録

1. https://app.secure.freee.co.jp/developers/applications にアクセス
2. 「新規作成」でアプリを作成
3. 以下を設定:
   - アプリ名: 任意
   - コールバックURL: `urn:ietf:wg:oauth:2.0:oob` (CLIツール用)

### 2. 認可コード取得

ブラウザで以下のURLにアクセス:

```
https://accounts.secure.freee.co.jp/public_api/authorize?client_id={CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&prompt=consent
```

認可後、画面に表示される認可コードをコピー。

### 3. アクセストークン取得

```bash
curl -X POST "https://accounts.secure.freee.co.jp/public_api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}" \
  -d "code={AUTHORIZATION_CODE}" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

レスポンス:

```json
{
  "access_token": "xxxxx",
  "token_type": "bearer",
  "expires_in": 86400,
  "refresh_token": "yyyyy",
  "scope": "read write",
  "created_at": 1234567890
}
```

### 4. トークンリフレッシュ

アクセストークンは24時間で期限切れ。リフレッシュトークンで更新:

```bash
curl -X POST "https://accounts.secure.freee.co.jp/public_api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}" \
  -d "refresh_token={REFRESH_TOKEN}"
```

## 環境変数 (.env)

```bash
FREEE_API_CLIENT_ID=your_client_id
FREEE_API_CLIENT_SECRET=your_client_secret
FREEE_API_ACCESS_TOKEN=your_access_token
FREEE_API_REFRESH_TOKEN=your_refresh_token
```

## APIリクエストヘッダー

```
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
```

## レート制限

- 1分間に3000リクエストまで
- 超過時は `429 Too Many Requests` エラー

## 事業所ID (company_id) の取得

アクセストークン取得後、以下で事業所一覧を取得:

```bash
curl -X GET "https://api.freee.co.jp/api/1/companies" \
  -H "Authorization: Bearer {access_token}"
```

レスポンス:

```json
{
  "companies": [
    {
      "id": 12345,
      "name": "株式会社サンプル",
      "name_kana": "カブシキガイシャサンプル",
      "display_name": "サンプル社",
      "role": "admin"
    }
  ]
}
```

## 取引先ID (partner_id) の取得

```bash
curl -X GET "https://api.freee.co.jp/api/1/partners?company_id={company_id}" \
  -H "Authorization: Bearer {access_token}"
```

レスポンス:

```json
{
  "partners": [
    {
      "id": 11111,
      "company_id": 12345,
      "name": "取引先A株式会社",
      "code": "A001"
    }
  ]
}
```

## トラブルシューティング

### 401 Unauthorized

- アクセストークンが期限切れ → リフレッシュトークンで更新
- トークンが無効 → 再認可が必要

### 403 Forbidden

- 権限不足 → アプリの権限設定を確認
- 事業所へのアクセス権限がない

### 404 Not Found

- 指定したリソースが存在しない
- company_id, partner_id等を確認
