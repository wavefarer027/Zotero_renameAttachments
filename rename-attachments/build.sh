#!/bin/bash

# Build script for Rename Attachments Zotero Plugin

PLUGIN_NAME="rename-attachments"
VERSION="2.0.0"

echo "Building ${PLUGIN_NAME} v${VERSION}..."

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "Error: manifest.json not found. Make sure you're in the plugin directory."
    exit 1
fi

if [ ! -f "bootstrap.js" ]; then
    echo "Error: bootstrap.js not found. Make sure you're in the plugin directory."
    exit 1
fi

if [ ! -f "chrome/content/rename.js" ]; then
    echo "Error: chrome/content/rename.js not found. Make sure you're in the plugin directory."
    exit 1
fi

# Clean previous build
rm -rf build

# Create build directory
mkdir -p build/${PLUGIN_NAME}

# Copy plugin files
echo "Copying plugin files..."
cp manifest.json build/${PLUGIN_NAME}/
cp bootstrap.js build/${PLUGIN_NAME}/

# Create chrome directory structure
mkdir -p build/${PLUGIN_NAME}/chrome/content
cp chrome/content/rename.js build/${PLUGIN_NAME}/chrome/content/

# Verify files were copied
echo "Verifying build structure..."
if [ ! -f "build/${PLUGIN_NAME}/manifest.json" ]; then
    echo "Error: Failed to copy manifest.json"
    exit 1
fi

# Create XPI package
echo "Creating XPI package..."
cd build
zip -r "${PLUGIN_NAME}-${VERSION}.xpi" ${PLUGIN_NAME}/
cd ..

# Verify XPI was created
if [ ! -f "build/${PLUGIN_NAME}-${VERSION}.xpi" ]; then
    echo "Error: Failed to create XPI file"
    exit 1
fi

echo "Plugin packaged as build/${PLUGIN_NAME}-${VERSION}.xpi"

# Optional: Create development symlink for testing
if [ "$1" = "dev" ]; then
    echo "Setting up development mode..."
    
    # Try different common Zotero profile locations
    ZOTERO_PROFILE_DIR=""
    
    # macOS locations
    if [ -d "$HOME/Zotero/Profiles" ]; then
        ZOTERO_PROFILE_DIR="$HOME/Zotero/Profiles"
    elif [ -d "$HOME/Library/Application Support/Zotero/Profiles" ]; then
        ZOTERO_PROFILE_DIR="$HOME/Library/Application Support/Zotero/Profiles"
    # Linux locations
    elif [ -d "$HOME/.zotero/zotero/Profiles" ]; then
        ZOTERO_PROFILE_DIR="$HOME/.zotero/zotero/Profiles"
    # Windows locations (if running in WSL/Git Bash)
    elif [ -d "$HOME/AppData/Roaming/Zotero/Zotero/Profiles" ]; then
        ZOTERO_PROFILE_DIR="$HOME/AppData/Roaming/Zotero/Zotero/Profiles"
    fi
    
    if [ -n "$ZOTERO_PROFILE_DIR" ] && [ -d "$ZOTERO_PROFILE_DIR" ]; then
        PROFILE=$(ls "$ZOTERO_PROFILE_DIR" | head -1)
        EXTENSIONS_DIR="$ZOTERO_PROFILE_DIR/$PROFILE/extensions"
        
        if [ -d "$EXTENSIONS_DIR" ]; then
            echo "Creating development symlink..."
            # Remove existing symlink if it exists
            rm -f "$EXTENSIONS_DIR/rename-attachments@zotero.org"
            ln -sf "$(pwd)/build/${PLUGIN_NAME}" "$EXTENSIONS_DIR/rename-attachments@zotero.org"
            echo "Development symlink created at $EXTENSIONS_DIR/rename-attachments@zotero.org"
            echo "Restart Zotero to load the plugin"
        else
            echo "Zotero extensions directory not found at: $EXTENSIONS_DIR"
            echo "You may need to manually copy the plugin folder to your Zotero extensions directory"
        fi
    else
        echo "Zotero profile directory not found"
        echo "You may need to manually install the plugin"
        echo "Common locations:"
        echo "  macOS: ~/Zotero/Profiles/[profile]/extensions/"
        echo "  Linux: ~/.zotero/zotero/Profiles/[profile]/extensions/"
        echo "  Windows: %APPDATA%/Zotero/Zotero/Profiles/[profile]/extensions/"
    fi
fi

echo ""
echo "Build completed successfully!"
echo ""
echo "To install manually:"
echo "1. Open Zotero"
echo "2. Go to Tools → Add-ons"
echo "3. Click the gear icon → Install Add-on From File"
echo "4. Select build/${PLUGIN_NAME}-${VERSION}.xpi"
echo "5. Restart Zotero"