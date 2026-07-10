#!/usr/bin/env bash
set -e

BACKUP_DIR="/home/sacha/backups/coach-db"
mkdir -p "$BACKUP_DIR"

# Load DB URL from app env
DB_URL=$(grep '^DATABASE_URL=' /home/sacha/coach/apps/web/.env.local 2>/dev/null | cut -d= -f2- | tr -d "'\"")
DB_URL="${DB_URL:-postgresql://coach:devpassword@localhost:5432/coach}"

DATE=$(date +%Y-%m-%d)
FILE="$BACKUP_DIR/coach_${DATE}.sql.gz"

echo "[$(date '+%H:%M')] Dumping database..."
pg_dump "$DB_URL" | gzip > "$FILE"
SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date '+%H:%M')] Saved: $FILE ($SIZE)"

# Keep last 30 backups
STALE=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +31)
if [ -n "$STALE" ]; then
  echo "$STALE" | xargs rm --
  echo "[$(date '+%H:%M')] Removed old backups"
fi

TOTAL=$(ls "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
echo "[$(date '+%H:%M')] Done. $TOTAL backup(s) stored in $BACKUP_DIR"
