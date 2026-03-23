#!/bin/bash

# PoseMaster Development Server Launcher
# Usage: ./start-dev.sh

cd "$(dirname "$0")"

echo "🎨 Starting PoseMaster development server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if Rust is available
if ! command -v cargo &> /dev/null; then
    echo "⚠️  Rust/Cargo not found. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Start the Tauri dev server
echo "🚀 Launching Tauri dev server..."
echo "   Press Ctrl+C to stop"
echo ""

npm run tauri dev
