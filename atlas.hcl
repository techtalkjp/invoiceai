env "local" {
  src = "file://db/schema.sql"
  url = "sqlite://db/local.db"
  dev = "sqlite://file?mode=memory"
}

env "production" {
  src = "file://db/schema.sql"
  url = "${getenv("DATABASE_URL")}?authToken=${getenv("DATABASE_AUTH_TOKEN")}"
  dev = "sqlite://file?mode=memory"
}
