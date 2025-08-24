# Rename Attachments - Zotero Plugin

A Zotero plugin that renames PDF attachments with smart title processing while standardising the attachment title field to "PDF".

## Features

- **Smart filename generation**: `Author (Year)_ProcessedTitle.pdf` with intelligent title abbreviations
- **Title prioritisation**: Uses Short Title if available, otherwise uses Title field
- **Standardised attachment titles**: All attachment Title fields set to "PDF" in Zotero
- **Multiple author handling**: Single authors use last name, multiple authors use "FirstAuthor et al."
- **Intelligent title processing**: Converts long titles to concise, readable formats
- **Academic abbreviations**: Common terms automatically shortened (e.g., "mental health" → "MH")
- **Error handling**: Comprehensive error reporting
- **Batch processing**: Process multiple items at once

## Installation

1. Download the plugin files
2. Create the following directory structure:
   ```
   rename-attachments/
   ├── manifest.json
   ├── bootstrap.js
   ```
3. Package as a `.xpi` file or install directly in Zotero 7's developer mode
   ```
   zip -r ../rename-attachments.xpi *
   ```

## Usage

### Basic Usage
1. Select one or more items in your Zotero library (not the attachments themselves)
2. Right-click and choose "Rename Attachments" from the context menu
3. Or use the menu item from the main item menu

### Programmatic Usage
```javascript
// Rename attachments for selected items
let result = await Zotero.RenameAttachments.rename();

// Batch rename with progress callback
let items = Zotero.getActiveZoteroPane().getSelectedItems();
let result = await Zotero.RenameAttachments.batchRename(items, 
    (current, total, title) => {
        console.log(`Processing ${current}/${total}: ${title}`);
    }
);

// Generate filename for a specific item
let filename = Zotero.RenameAttachments.generateFilename(item);
```

## What It Does

### Filename Processing
The plugin intelligently chooses which title to process:

1. **First Priority**: Uses **Short Title** field if it exists and is not empty
2. **Fallback**: Uses **Title** field if no Short Title is available

Then applies smart abbreviations to whichever title is selected.

**Example with Short Title**:
- **Title**: "Self-Triggering? An Exploration of Individuals Who Seek Reminders of Trauma"
- **Short Title**: "Self-Triggering Study"  
- **Processed filename**: `Bellet et al. (2020)_selfTrigger~Study.pdf`

**Example without Short Title**:
- **Title**: "Self-Triggering? An Exploration of Individuals Who Seek Reminders of Trauma"
- **Short Title**: *(empty)*
- **Processed filename**: `Bellet et al. (2020)_selfTrigger~explorationIndividualsSeekRemindersTrauma.pdf`

### Zotero Title Field
After renaming, the attachment's Title field in Zotero shows simply: **"PDF"**

This gives you:
- **Clean Zotero interface**: All attachments show as "PDF" 
- **Descriptive filenames**: Actual files have meaningful names

## Filename Format

- **Single author**: `Smith (2023)_studyTitle.pdf`
- **Multiple authors**: `Smith et al. (2023)_studyTitle.pdf`  
- **No author**: `n.a. (2023)_studyTitle.pdf`
- **No year**: `Smith (n.d.)_studyTitle.pdf`

## Title Processing Rules

### Common Abbreviations
- "between" → "btwn"
- "versus" → "vs"
- "transgender" → "trans"
- "suicidal ideation" → "SI"
- "suicide prevention" → "SP"
- "mental health" → "MH"
- "posttraumatic stress disorder" → "PTSD"
- "united states" → "US"
- "identity/identities" → "ID"
- "eating disorder" → "ED"
- Words ending in "-ing" → "~" (e.g., "triggering" → "trigger~")

### Text Processing
- Removes special characters and punctuation
- Removes articles ("the", "a", "an")
- Converts "and"/"or" to "&"
- Uses camelCase formatting
- Preserves original text for CJK languages

## Customisation

You can modify the abbreviations by editing the `config` object in `chrome/content/rename.js`:

```javascript
Zotero.RenameAttachments.config = {
    replacements: {
        'your term': 'abbreviation',
        // Add your custom replacements here
    }
};
```

## Examples

| Original Title | Short Title | Processed Filename | Zotero Title Field |
|---------------|-------------|-------------------|-------------------|
| "Mental Health and Suicide Prevention in Transgender Youth" | "MH & SP in Trans Youth" | `Smith et al. (2023)_MHSPtransYouth.pdf` | PDF |
| "A Study Between PTSD and Identity Formation" | *(empty)* | `Jones (2022)_studyBtwnPTSDIDformation.pdf` | PDF |
| "Processing and Triggering Factors in Mental Health" | "Processing Study" | `Brown et al. (2024)_process~Study.pdf` | PDF |

## Compatibility

- **Zotero Version**: 7.0.0 and above
- **Item Types**: Works with any Zotero item that has PDF attachments
- **Operating Systems**: Windows, macOS, Linux

## Troubleshooting

### Common Issues

1. **"No items selected"**: Select the parent items in your library, not the PDF attachments directly
2. **"Processed 0 items"**: Ensure selected items have PDF attachments
3. **Permission errors**: Check that Zotero has write permissions to your attachment directory

### Debug Information

Enable debug output to see detailed processing information:
1. Go to **Help → Debug Output Logging**
2. Enable "Real-time" output
3. Run the rename function and check the output

You should see messages like:
- "Processing X items"
- "Using Short Title: ..." or "Using Title: ..."
- "Generated filename: Author (Year)_processedTitle.pdf"
- "Successfully renamed attachment"

## Development

### File Structure
- `manifest.json`: Extension metadata and compatibility info
- `bootstrap.js`: Main plugin lifecycle and UI integration

### Key Functions
- `formatTitle()`: Processes titles with abbreviations and camelCase
- `formatAuthors()`: Handles author name formatting (single vs multiple)
- `extractYear()`: Extracts year from date fields
- `generateFilename()`: Creates the processed filename
- `rename()`: Main renaming function (also sets title field to "PDF")
- `batchRename()`: Batch processing with progress tracking

### Building
```bash
# Make executable (first time only)
chmod +x build.sh

# Build plugin
./build.sh

# Install for development (creates symlink)
./build.sh dev
```

## License

MIT License - Feel free to modify and distribute according to your needs.

## Changelog

### Version 2.0.1
- Updated file structure for compatibility with Zotero 7
   - Add `update_url`

### Version 2.0.0
- Smart title processing with academic abbreviations
- Sets attachment Title field to "PDF" for clean Zotero interface
- Uses "et al." format for multiple authors
- Comprehensive error handling and debugging
- Enhanced batch processing capabilities
- Fixed creator type identification for different Zotero setups
