#!/bin/bash

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "⚠️  backend/.env not found!"
    echo "Creating backend/.env from example..."
    cp backend/.env.example backend/.env
    echo "❗ Please edit backend/.env with your API keys before running this script again."
    exit 1
fi

# Determine Docker Compose command
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose not found. Please install Docker Desktop or docker-compose."
    exit 1
fi

echo "🚀 Building and starting services using '$DOCKER_COMPOSE_CMD'..."
$DOCKER_COMPOSE_CMD up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo "   Frontend: http://localhost"
    echo "   Backend API: http://localhost/api/v1"
    echo "   Docs: http://localhost/api/v1/docs"
else
    echo "❌ Deployment failed."
fi
