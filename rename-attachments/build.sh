#!/bin/bash

# Build script for Rename Attachments Plus Zotero Plugin

PLUGIN_NAME="rename-attachments"
VERSION="2.0.0"

echo "Building ${PLUGIN_NAME} v${VERSION}..."

# Create build directory
mkdir -p build/${PLUGIN_NAME}

# Copy plugin files
cp manifest.json build/${PLUGIN_NAME}/
cp bootstrap.js build/${PLUGIN_NAME}/

# Create chrome directory structure
mkdir -p build/${PLUGIN_NAME}/chrome/content
cp chrome/content/rename.js build/${PLUGIN_NAME}/chrome/content/

# Create XPI package
cd build
zip -r "${PLUGIN_NAME}-${VERSION}.xpi" ${PLUGIN_NAME}
cd ..

echo "Plugin packaged as build/${PLUGIN_NAME}-${VERSION}.xpi"

# Optional: Create development symlink for testing
if [ "$1" = "dev" ]; then
    ZOTERO_PROFILE_DIR="$HOME/Zotero/Profiles"
    if [ -d "$ZOTERO_PROFILE_DIR" ]; then
        PROFILE=$(ls "$ZOTERO_PROFILE_DIR" | head -1)
        EXTENSIONS_DIR="$ZOTERO_PROFILE_DIR/$PROFILE/extensions"
        
        if [ -d "$EXTENSIONS_DIR" ]; then
            echo "Creating development symlink..."
            ln -sf "$(pwd)/build/${PLUGIN_NAME}" "$EXTENSIONS_DIR/${PLUGIN_NAME}@zotero.org"
            echo "Development symlink created at $EXTENSIONS_DIR/${PLUGIN_NAME}@zotero.org"
            echo "Restart Zotero to load the plugin"
        else
            echo "Zotero extensions directory not found"
        fi
    else
        echo "Zotero profile directory not found"
    fi
fi

echo "Build completed successfully!"