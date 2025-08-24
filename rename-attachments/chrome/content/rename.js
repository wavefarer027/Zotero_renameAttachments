if (!Zotero.RenameAttachments) {
    Zotero.RenameAttachments = {};
}

/**
 * Configuration object for filename formatting
 */
Zotero.RenameAttachments.config = {
    // Default format: Author (Year)_ProcessedTitle.pdf
    format: '{authors} ({year})_{title}.pdf',
    
    // Text replacements for title processing
    replacements: {
        'between': 'btwn',
        'versus': 'vs',
        'transgender': 'trans',
        'suicidal ideation': 'SI',
        'suicide thoughts': 'SI',
        'suicide prevention': 'SP',
        'mental health': 'MH',
        'posttraumatic stress disorder': 'PTSD',
        'post-traumatic stress disorder': 'PTSD',
        'united states': 'US',
        'identities': 'ID',
        'identity': 'ID',
        'anorexia nervosa': 'AN',
        'bulimia nervosa': 'BN',
        'eating disorder': 'ED'
    },
    
    // Special patterns (applied before word splitting)
    patterns: {
        'ing\\b': '~'  // Replace -ing endings with ~
    }
};

/**
 * Format title according to rules
 */
Zotero.RenameAttachments.formatTitle = function(title, language = '') {
    if (!title) return '';
    
    // For CJK languages, minimal processing
    if (['ja', 'zh', 'ko'].includes(language.toLowerCase())) {
        return title.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '').trim();
    }
    
    let formatted = title
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .replace(/\b(the|a|an)\b/gi, '') // Remove articles
        .replace(/\b(and|or)\b/gi, '&'); // Replace conjunctions
    
    // Apply custom replacements
    for (let [original, replacement] of Object.entries(this.config.replacements)) {
        let regex = new RegExp(`\\b${original}\\b`, 'gi');
        formatted = formatted.replace(regex, replacement);
    }
    
    // Apply pattern replacements (like -ing → ~)
    for (let [pattern, replacement] of Object.entries(this.config.patterns)) {
        let regex = new RegExp(pattern, 'g');
        formatted = formatted.replace(regex, replacement);
    }
    
    return formatted
        .replace(/\s+/g, ' ') // Normalise whitespace
        .trim()
        .split(/\s+/)
        .map((word, index) => {
            if (word.length === 0) return '';
            return index === 0 
                ? word.toLowerCase() 
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .filter(word => word.length > 0)
        .join('');
};

/**
 * Format authors for filename
 */
Zotero.RenameAttachments.formatAuthors = function(creators) {
    let authors = creators.filter(creator => creator.creatorTypeID === 8); // Author type (your system uses 8)
    
    if (authors.length === 0) {
        return 'n.a.';
    } else if (authors.length === 1) {
        return authors[0].lastName || authors[0].name || 'Unknown';
    } else {
        // For multiple authors, always use "FirstAuthor et al."
        let first = authors[0].lastName || authors[0].name || 'Unknown';
        return `${first} et al.`;
    }
};

/**
 * Extract year from date field
 */
Zotero.RenameAttachments.extractYear = function(dateString) {
    if (!dateString) return 'n.d.';
    
    // If it's already just a year
    if (/^\d{4}$/.test(dateString)) {
        return dateString;
    }
    
    // Extract year from various date formats
    let match = dateString.match(/(\d{4})/);
    return match ? match[1] : 'n.d.';
};

/**
 * Generate filename for an item
 */
Zotero.RenameAttachments.generateFilename = function(item) {
    let authors = this.formatAuthors(item.getCreators());
    let year = this.extractYear(item.getField('date') || item.getField('year'));
    
    // Priority: Short Title first, then Title
    let shortTitle = item.getField('shortTitle');
    let fullTitle = item.getField('title');
    
    let title;
    if (shortTitle && shortTitle.trim()) {
        title = shortTitle;
        Zotero.debug(`Using Short Title: "${title}"`);
    } else {
        title = fullTitle || 'untitled';
        Zotero.debug(`Using Title: "${title}"`);
    }
    
    let language = item.getField('language') || '';
    let formattedTitle = this.formatTitle(title, language);
    let filename = `${authors} (${year})_${formattedTitle}.pdf`;
    
    // Sanitise filename
    return filename
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
        .replace(/\s+/g, ' ') // Normalise spaces
        .replace(/\.+/g, '.') // Remove multiple dots
        .trim();
};

/**
 * Main rename function
 */
Zotero.RenameAttachments.rename = async function(items = null) {
    let selectedItems = items || Zotero.getActiveZoteroPane().getSelectedItems();
    
    if (!selectedItems.length) {
        return { success: false, message: "No items selected." };
    }

    let results = {
        processed: 0,
        errors: 0,
        errorDetails: [],
        success: true
    };

    for (let item of selectedItems) {
        try {
            if (item.isAttachment()) {
                continue; // Skip attachment items themselves
            }

            let filename = this.generateFilename(item);
            let attachmentIDs = item.getAttachments();
            let itemProcessed = false;
            
            for (let id of attachmentIDs) {
                let attachment = Zotero.Items.get(id);
                if (attachment && attachment.attachmentContentType === 'application/pdf') {
                    try {
                        await attachment.renameAttachmentFile(filename);
                        // Set attachment title to "PDF"
                        attachment.setField('title', 'PDF');
                        await attachment.saveTx();
                        itemProcessed = true;
                        Zotero.debug(`Renamed attachment: ${filename}`);
                    } catch (e) {
                        let error = `${item.getField('title')}: ${e.message}`;
                        results.errorDetails.push(error);
                        results.errors++;
                        Zotero.debug(`Error renaming attachment: ${error}`);
                    }
                }
            }
            
            if (itemProcessed) {
                results.processed++;
            }
            
        } catch (e) {
            let error = `${item.getField('title') || 'Unknown item'}: ${e.message}`;
            results.errorDetails.push(error);
            results.errors++;
            Zotero.debug(`Error processing item: ${error}`);
        }
    }
    
    results.message = `Processed ${results.processed} items successfully.`;
    if (results.errors > 0) {
        results.message += ` ${results.errors} errors occurred.`;
        results.success = false;
    }
    
    return results;
};

/**
 * Convenience function for batch renaming with progress
 */
Zotero.RenameAttachments.batchRename = async function(items, progressCallback = null) {
    if (!items || !items.length) {
        return { success: false, message: "No items provided." };
    }
    
    let results = {
        processed: 0,
        errors: 0,
        errorDetails: [],
        success: true,
        total: items.length
    };
    
    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        
        if (progressCallback) {
            progressCallback(i + 1, items.length, item.getField('title') || 'Unknown');
        }
        
        try {
            if (!item.isAttachment()) {
                let filename = this.generateFilename(item);
                let attachmentIDs = item.getAttachments();
                let itemProcessed = false;
                
                for (let id of attachmentIDs) {
                    let attachment = Zotero.Items.get(id);
                    if (attachment && attachment.attachmentContentType === 'application/pdf') {
                        try {
                            await attachment.renameAttachmentFile(filename);
                            // Set attachment title to "PDF"
                            attachment.setField('title', 'PDF');
                            await attachment.saveTx();
                            itemProcessed = true;
                        } catch (e) {
                            results.errorDetails.push(`${item.getField('title')}: ${e.message}`);
                            results.errors++;
                        }
                    }
                }
                
                if (itemProcessed) {
                    results.processed++;
                }
            }
        } catch (e) {
            results.errorDetails.push(`${item.getField('title') || 'Unknown'}: ${e.message}`);
            results.errors++;
        }
    }
    
    results.message = `Batch processed ${results.processed}/${results.total} items.`;
    if (results.errors > 0) {
        results.message += ` ${results.errors} errors occurred.`;
        results.success = false;
    }
    
    return results;
};