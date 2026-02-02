env "local" {
  src = "file://db/schema.sql"
  url = "sqlite://db/local.db"
  dev = "sqlite://file?mode=memory"
}

env "turso" {
  src = "file://db/schema.sql"
  url = getenv("DATABASE_URL")
  dev = "sqlite://file?mode=memory"
}
