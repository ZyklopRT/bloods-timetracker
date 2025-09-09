#!/bin/sh

# If running as root, set proper ownership and switch to nodeapp user
if [ "$(id -u)" = "0" ]; then
    # Run database migrations
    echo "🔄 Running database migrations..."
    su-exec nodeapp npx prisma migrate deploy
    
    # Switch to nodeapp user and execute command
    exec su-exec nodeapp "$@"
else
    # Already running as nodeapp user, run migrations and execute command
    echo "🔄 Running database migrations..."
    npx prisma migrate deploy
    exec "$@"
fi
