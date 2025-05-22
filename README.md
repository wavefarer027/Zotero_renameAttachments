# Rename Attachments - Zotero Plugin

An enhanced Zotero plugin that intelligently renames PDF attachments based on bibliographic metadata with improved error handling and customisation options.

## Features

- **Smart filename generation**: Creates filenames in the format `Author (Year)_Title.pdf`
- **Multiple author handling**: Handles single authors, two authors (`Author1 & Author2`), and multiple authors (`FirstAuthor et al.`)
- **Title processing**: Intelligently processes titles with common academic abbreviations
- **Language support**: Special handling for Japanese, Chinese, and Korean titles
- **Error handling**: Comprehensive error reporting and handling
- **Batch processing**: Process multiple items with progress tracking
- **Customisable**: Easy to modify text replacements and formatting rules

## Installation

1. Download the plugin files
2. Create the following directory structure:
   ```
   rename-attachments/
   ├── manifest.json
   ├── bootstrap.js
   └── chrome/
       └── content/
           └── rename.js
   ```
3. Package as a `.xpi` file or install directly in Zotero 7's developer mode

## Usage

### Basic Usage
1. Select one or more items in your Zotero library
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

## Filename Format

The plugin generates filenames using this pattern:
- **Single author**: `Smith (2023)_studyTitle.pdf`
- **Two authors**: `Smith & Jones (2023)_studyTitle.pdf`  
- **Multiple authors**: `Smith et al. (2023)_studyTitle.pdf`
- **No author**: `n.a. (2023)_studyTitle.pdf`
- **No year**: `Smith (n.d.)_studyTitle.pdf`

## Title Processing Rules

The plugin applies several transformations to create clean, readable filenames:

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

### Text Processing
- Removes special characters and punctuation
- Removes articles ("the", "a", "an")
- Converts "and"/"or" to "&"
- Uses camelCase formatting
- Preserves original text for CJK languages

## Customisation

You can modify the text replacements by editing the `config` object in `chrome/content/rename.js`:

```javascript
Zotero.RenameAttachments.config = {
    format: '{authors} ({year})_{title}.pdf',
    replacements: {
        'your term': 'abbreviation',
        // Add your custom replacements here
    }
};
```

## Improvements Over Original

This enhanced version includes:

1. **Fixed creator type bug**: Correctly identifies authors (creatorTypeID 1)
2. **Better error handling**: Comprehensive error reporting and recovery
3. **Improved text processing**: Cleaner, more reliable title formatting
4. **Language support**: Proper handling of non-Latin scripts
5. **Code organisation**: Modular, maintainable code structure
6. **Batch processing**: Support for processing large numbers of items
7. **Progress tracking**: Optional progress callbacks for batch operations
8. **Filename validation**: Ensures generated filenames are valid across operating systems
9. **Flexible API**: Programmatic access for advanced users

## Compatibility

- **Zotero Version**: 7.0.0 and above
- **Item Types**: Works with any Zotero item that has PDF attachments
- **Operating Systems**: Windows, macOS, Linux

## Troubleshooting

### Common Issues

1. **"No items selected"**: Ensure you've selected items in the library, not attachments directly
2. **Permission errors**: Check that Zotero has write permissions to your attachment directory
3. **Invalid characters**: The plugin automatically removes invalid filename characters

### Error Messages

The plugin provides detailed error messages including:
- Which items failed to process
- Specific error reasons
- Summary of successful vs failed operations

## Development

### File Structure
- `manifest.json`: Extension metadata and compatibility info
- `bootstrap.js`: Main plugin lifecycle and UI integration
- `chrome/content/rename.js`: Core renaming logic and API

### Key Functions
- `formatTitle()`: Processes and formats title text
- `formatAuthors()`: Handles author name formatting
- `generateFilename()`: Creates the complete filename
- `rename()`: Main renaming function
- `batchRename()`: Batch processing with progress tracking

## License

This plugin is provided as-is for educational and research purposes. Feel free to modify and distribute according to your needs.

## Contributing

Contributions are welcome! Areas for improvement:
- Additional text processing rules
- More filename format options
- Localisation support
- Integration with other Zotero plugins

## Changelog

### Version 2.0.0
- Complete rewrite with improved error handling
- Fixed creator type identification bug
- Added language-specific processing
- Improved filename sanitisation
- Added batch processing capabilities
- Enhanced debugging and logging