# 月次経費請求機能

クライアントごとに固定費・従量課金の経費項目を設定し、為替換算して請求書に自動反映する機能。

## ドキュメント

- [要件定義](./requirements.md) — 機能要件・非機能要件
- [データモデル](./data-model.md) — テーブル設計
- [為替レート](./exchange-rate.md) — 日銀 API からの取得仕様
- [従量課金プロバイダ](./metered-providers.md) — Google Cloud Billing 等の連携仕様
- [画面設計](./ui-design.md) — 設定画面・請求書作成画面の変更点

## 背景

現状、特定クライアント向け請求でサーバ通信費（Vercel/Supabase/Resend）や Gemini API 利用料を手作業で計算・入力している。これを自動化し、他クライアントにも展開できるようにする。
