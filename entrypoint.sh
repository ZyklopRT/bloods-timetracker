#!/bin/sh

# Ensure data directory exists and has proper permissions for volume mounts
mkdir -p /app/data

# If running as root, set proper ownership and switch to nodeapp user
if [ "$(id -u)" = "0" ]; then
    # Set ownership of data directory to nodeapp user
    chown -R nodeapp:nodejs /app/data
    # Switch to nodeapp user and execute command
    exec su-exec nodeapp "$@"
else
    # Already running as nodeapp user, execute command directly
    exec "$@"
fi
