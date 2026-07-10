#!/usr/bin/env bash
set -e
PAT="$(cat ~/.config/coach/github_pat 2>/dev/null || echo '')"
if [ -z "$PAT" ]; then
  echo 'Error: no PAT found. Put it in ~/.config/coach/github_pat'
  exit 1
fi

# Run DB backup first
echo "=== DB backup ==="
bash /home/sacha/coach/scripts/backup-db.sh

# Copy latest dump into the repo, commit, push
LATEST_DUMP="$(ls -t /home/sacha/backups/coach-db/*.sql.gz 2>/dev/null | head -1)"
if [ -z "$LATEST_DUMP" ]; then
  echo 'No DB dump found, aborting'
  exit 1
fi

cd /home/sacha/coach
git remote set-url origin "https://sachaaebischer:${PAT}@github.com/sachaaebischer/gymlogger.git"

mkdir -p db
cp "$LATEST_DUMP" db/latest.sql.gz

git add db/latest.sql.gz
git diff --cached --quiet && echo 'nothing to push' || git commit -m "db: backup $(date +%Y-%m-%d)"
git push origin master

git remote set-url origin https://github.com/sachaaebischer/gymlogger.git
echo 'done'
