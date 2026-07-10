#!/bin/bash
# Run this on the VM once Docker is installed
cd /home/sacha/coach

# Start just postgres
docker compose up -d postgres
echo "Waiting for postgres..."
sleep 5

# Generate migrations
cd apps/web
npx drizzle-kit generate

# Apply migrations  
npx drizzle-kit migrate

echo "Database schema applied!"
