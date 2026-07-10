#!/usr/bin/env bash
set -e
PAT="$(cat ~/.openclaw/github_pat 2>/dev/null || echo '')"
if [ -z "$PAT" ]; then
  echo 'Error: no PAT found. Put it in ~/.openclaw/github_pat'
  exit 1
fi

# Run DB backup first
echo "=== DB backup ==="
bash /home/sacha/coach/scripts/backup-db.sh

cd /tmp
rm -rf coach-backup-push
git clone "https://sachaaebischer:${PAT}@github.com/sachaaebischer/openclaw-backup.git" coach-backup-push
rsync -a --delete \
  --exclude='node_modules/' --exclude='dist/' --exclude='.next/' \
  --exclude='*.tsbuildinfo' --exclude='.DS_Store' --exclude='*.log' \
  --exclude='sync.log' --exclude='.claude/' \
  --exclude='data/raw/' --exclude='data/health/' \
  --exclude='data/activities/' --exclude='data/gym/sessions/' \
  --exclude='data/gym/*.csv' --exclude='data/state/' \
  --exclude='data/plan/' \
  ~/coach/ coach-backup-push/coach/

# Copy latest DB dump into the backup repo
LATEST_DUMP="$(ls -t /home/sacha/backups/coach-db/*.sql.gz 2>/dev/null | head -1)"
if [ -n "$LATEST_DUMP" ]; then
  mkdir -p coach-backup-push/db
  cp "$LATEST_DUMP" coach-backup-push/db/latest.sql.gz
  echo "Included DB dump: $LATEST_DUMP"
fi

cd coach-backup-push
git config user.email 'sacha.aebischer@gmail.com'
git config user.name 'Sacha Aebischer'
git add coach/ db/
git diff --cached --quiet && echo 'nothing changed' && exit 0
git commit -m "backup: $(date +%Y-%m-%d)"
git push origin main
echo 'pushed ok'
rm -rf /tmp/coach-backup-push
