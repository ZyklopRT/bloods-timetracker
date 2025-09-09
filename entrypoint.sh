#!/bin/sh

# Ensure data directory exists and has proper permissions
mkdir -p /app/data
chmod 755 /app/data

# Execute the main command
exec "$@"
