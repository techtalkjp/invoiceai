terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "asia-northeast1"
}

# Google Sheets API を有効化
resource "google_project_service" "sheets" {
  service                    = "sheets.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

# Google Drive API を有効化 (PDF エクスポート用)
resource "google_project_service" "drive" {
  service                    = "drive.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

output "next_steps" {
  value = <<-EOT

    === 次のステップ ===

    1. OAuth同意画面を設定:
       https://console.cloud.google.com/apis/credentials/consent?project=${var.project_id}
       - ユーザータイプ: 外部
       - アプリ名: freee請求書自動化
       - スコープ: Google Sheets API (readonly), Google Drive API (readonly)

    2. OAuthクライアントIDを作成:
       https://console.cloud.google.com/apis/credentials?project=${var.project_id}
       - 「認証情報を作成」→「OAuthクライアントID」
       - アプリの種類: デスクトップアプリ
       - 名前: freee-invoice-cli

    3. .env に追加:
       GOOGLE_CLIENT_ID=<作成されたクライアントID>
       GOOGLE_CLIENT_SECRET=<作成されたクライアントシークレット>

    4. 認証実行:
       pnpm google login

  EOT
}
