#!/bin/bash

# Build script for Rename Attachments Zotero Plugin

PLUGIN_NAME="rename-attachments"
VERSION="2.0.1"

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

# Clean previous build
rm -rf build

# Create build directory
mkdir -p build/${PLUGIN_NAME}

# Copy required files
echo "Copying plugin files..."
cp manifest.json build/${PLUGIN_NAME}/
cp bootstrap.js build/${PLUGIN_NAME}/

# Create chrome.manifest if it doesn't exist
if [ ! -f "chrome.manifest" ]; then
    echo "Creating chrome.manifest..."
    cat > build/${PLUGIN_NAME}/chrome.manifest << 'EOF'
content	rename-attachments	chrome/content/
locale	rename-attachments	en-US	chrome/locale/en-US/
EOF
else
    cp chrome.manifest build/${PLUGIN_NAME}/
fi

# Create chrome directory structure
mkdir -p build/${PLUGIN_NAME}/chrome/content
if [ -f "chrome/content/rename.js" ]; then
    cp chrome/content/rename.js build/${PLUGIN_NAME}/chrome/content/
fi

# Create install.rdf for backwards compatibility (optional)
cat > build/${PLUGIN_NAME}/install.rdf << EOF
<?xml version="1.0"?>
<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
     xmlns:em="http://www.mozilla.org/2004/em-rdf#">
  <Description about="urn:mozilla:install-manifest">
    <em:id>rename-attachments@zotero.org</em:id>
    <em:name>Rename Attachments</em:name>
    <em:version>${VERSION}</em:version>
    <em:description>Rename PDF attachments based on metadata</em:description>
    <em:creator>Ko Horiuchi</em:creator>
    <em:type>2</em:type>
    <em:bootstrap>true</em:bootstrap>
    <em:unpack>false</em:unpack>
    
    <em:targetApplication>
      <Description>
        <em:id>zotero@chnm.gmu.edu</em:id>
        <em:minVersion>7.0.0</em:minVersion>
        <em:maxVersion>7.*</em:maxVersion>
      </Description>
    </em:targetApplication>
  </Description>
</RDF>
EOF

# Verify core files were copied
echo "Verifying build structure..."
for file in "manifest.json" "bootstrap.js" "chrome.manifest" "install.rdf"; do
    if [ ! -f "build/${PLUGIN_NAME}/${file}" ]; then
        echo "Warning: ${file} not found in build"
    fi
done

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

# Test XPI validity (if unzip is available)
if command -v unzip &> /dev/null; then
    echo "Testing XPI file integrity..."
    if unzip -t "build/${PLUGIN_NAME}-${VERSION}.xpi" > /dev/null 2>&1; then
        echo "✓ XPI file appears to be valid"
    else
        echo "⚠ Warning: XPI file may be corrupted"
    fi
fi

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
echo "File structure should be:"
echo "├── manifest.json"
echo "├── bootstrap.js"
echo "├── chrome.manifest"
echo "├── install.rdf"
echo "└── chrome/"
echo "    └── content/"
echo "        └── rename.js"
echo ""
echo "To install manually:"
echo "1. Open Zotero"
echo "2. Go to Tools → Add-ons"
echo "3. Click the gear icon → Install Add-on From File"
echo "4. Select build/${PLUGIN_NAME}-${VERSION}.xpi"
echo "5. Restart Zotero"