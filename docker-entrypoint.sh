#!/bin/sh
set -e

echo "Waiting for Postgres..."
until pg_isready -h "$DB_HOST" -p 5432 -U "$DB_USER"; do
  sleep 1
done

echo "Running prisma generate..."
npx prisma generate

echo "Running migrations..."
npx prisma migrate deploy

# D-03: Seed only if User table is empty (safe restart guard)
USER_COUNT=$(psql "$DATABASE_URL" -t -c 'SELECT COUNT(*) FROM "User";' 2>/dev/null | tr -d ' ' || echo "0")
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "Seeding database..."
  npx prisma db seed
else
  echo "Database already seeded (User count: $USER_COUNT), skipping seed."
fi

echo "Starting Next.js..."
exec npm run start
