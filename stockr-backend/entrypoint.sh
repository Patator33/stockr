#!/bin/sh
set -e

# Run migrations
npx prisma migrate deploy

# Start Next.js
exec node server.js
