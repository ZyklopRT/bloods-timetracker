#!/bin/bash

# Discord Bot Startup Script
# Handles command deployment and bot startup for production

set -e

echo "🚀 Starting Discord Bot..."

# Function to check if commands need to be deployed
check_and_deploy_commands() {
    local flag_file="/app/data/.commands_deployed"
    local deploy_needed=false
    
    # Check if this is the first run or if FORCE_DEPLOY is set
    if [ ! -f "$flag_file" ] || [ "$FORCE_DEPLOY" = "true" ]; then
        deploy_needed=true
    fi
    
    if [ "$deploy_needed" = true ]; then
        echo "📝 Deploying Discord slash commands..."
        if npm run deploy-commands; then
            echo "✅ Commands deployed successfully"
            # Create flag file to mark commands as deployed
            touch "$flag_file"
        else
            echo "❌ Command deployment failed"
            exit 1
        fi
    else
        echo "ℹ️  Commands already deployed, skipping..."
    fi
}

# Function to handle graceful shutdown
cleanup() {
    echo "🛑 Received shutdown signal, gracefully stopping bot..."
    if [ -n "$BOT_PID" ]; then
        kill -TERM "$BOT_PID" 2>/dev/null || true
        wait "$BOT_PID" 2>/dev/null || true
    fi
    echo "✅ Bot stopped gracefully"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT

# Create data directory if it doesn't exist
mkdir -p /app/data

# Deploy commands if needed
check_and_deploy_commands

# Start the bot
echo "🎯 Starting Discord bot..."
npm start &
BOT_PID=$!

# Wait for the bot process
wait $BOT_PID
