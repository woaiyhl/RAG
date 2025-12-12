#!/bin/bash

# RAG Knowledge Base Startup Script

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting RAG Knowledge Base System...${NC}"

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${BLUE}Shutting down services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup INT TERM EXIT

# 1. Start Backend
echo -e "${GREEN}[Backend] Starting FastAPI server...${NC}"
cd backend

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start Backend in background
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait a moment for backend to initialize
sleep 2

# 2. Start Frontend
echo -e "${GREEN}[Frontend] Starting Vite development server...${NC}"
cd ../frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Node modules not found. Installing..."
    npm install
fi

# Start Frontend
npm run dev &
FRONTEND_PID=$!

echo -e "${BLUE}All services started!${NC}"
echo -e "Backend: http://localhost:8000"
echo -e "Frontend: http://localhost:5173"
echo -e "Press Ctrl+C to stop all services."

# Wait for processes to finish
wait $BACKEND_PID $FRONTEND_PID
