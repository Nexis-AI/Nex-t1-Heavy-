#!/bin/bash
set -e

echo "🚀 Initializing Nex-t1 Heavy Multi-Agent System..."

# Function to wait for a service
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    
    echo "⏳ Waiting for $service to be ready..."
    
    while ! nc -z "$host" "$port"; do
        sleep 1
    done
    
    echo "✅ $service is ready!"
}

# Wait for dependencies
wait_for_service "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" "Redis"
wait_for_service "${DB_HOST:-postgres}" "${DB_PORT:-5432}" "PostgreSQL"

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Seed database if needed
if [ "$SEED_DATABASE" = "true" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

# Create required directories
mkdir -p logs uploads

# Set proper permissions
chown -R nodejs:nodejs logs uploads

echo "✨ Initialization complete!"

# Start the application
exec "$@"