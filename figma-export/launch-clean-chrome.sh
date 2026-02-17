#!/bin/bash

# Launch Chrome/Chromium without extensions for clean development
# This ELIMINATES all wallet extension warnings

echo "🚀 Launching Chrome without extensions..."
echo "This will open a clean browser instance with ZERO wallet warnings."
echo ""

# Detect OS and launch appropriate Chrome
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
        --disable-extensions \
        --new-window \
        "http://localhost:5173" \
        2>/dev/null &
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v google-chrome &> /dev/null; then
        google-chrome \
            --disable-extensions \
            --new-window \
            "http://localhost:5173" \
            2>/dev/null &
    elif command -v chromium &> /dev/null; then
        chromium \
            --disable-extensions \
            --new-window \
            "http://localhost:5173" \
            2>/dev/null &
    else
        echo "❌ Chrome or Chromium not found"
        exit 1
    fi
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows (Git Bash / WSL)
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
        --disable-extensions \
        --new-window \
        "http://localhost:5173" \
        2>/dev/null &
fi

echo "✅ Chrome launched without extensions"
echo "✅ ZERO [injected|warn] messages"
echo "✅ Clean console for development"
echo ""
echo "💡 To close: Just close the browser window"
