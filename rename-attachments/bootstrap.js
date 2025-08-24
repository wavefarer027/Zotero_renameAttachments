// Zotero 7 Bootstrap Plugin: Rename Attachments

var windowListener;

function install(data, reason) {}

async function startup({ id, version, rootURI }, reason) {
    // Wait for Zotero to be ready (Zotero 7 provides this automatically)
    await Zotero.initializationPromise;
    
    Zotero.debug("Rename Attachments: Plugin started");
    
    // Add to all existing windows
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
        onMainWindowLoad({ window: win });
    }
    
    // Set up window listener for new windows
    windowListener = {
        onOpenWindow: function(xulWindow) {
            let domWindow = xulWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIDOMWindowInternal || Components.interfaces.nsIDOMWindow);
            
            domWindow.addEventListener("load", function listener() {
                domWindow.removeEventListener("load", listener, false);
                
                // Check if this is a Zotero window
                if (domWindow.Zotero && domWindow.Zotero.getActiveZoteroPane) {
                    onMainWindowLoad({ window: domWindow });
                }
            }, false);
        },
        onCloseWindow: function(xulWindow) {},
        onWindowTitleChange: function(xulWindow, newTitle) {}
    };
    
    Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
    Zotero.debug("Rename Attachments: Plugin shutting down");
    
    // Remove window listener
    if (windowListener) {
        Services.wm.removeListener(windowListener);
        windowListener = null;
    }
    
    // Remove from all windows
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
        onMainWindowUnload({ window: win });
    }
}

function uninstall(data, reason) {}

// Zotero 7 Window Hooks (called automatically)
function onMainWindowLoad({ window }) {
    addMenuItem(window);
    Zotero.debug("Rename Attachments: Added to window");
}

function onMainWindowUnload({ window }) {
    removeMenuItem(window);
    Zotero.debug("Rename Attachments: Removed from window");
}

function addMenuItem(window) {
    let doc = window.document;
    
    // Create menu item for the item menu
    let menuitem = doc.createXULElement('menuitem');
    menuitem.id = 'rename-attachments-menuitem';
    menuitem.setAttribute('label', 'Rename Attachments');
    menuitem.addEventListener('command', renameAttachments);
    
    // Add to the item menu
    let itemMenu = doc.getElementById('zotero-itemmenu');
    if (itemMenu) {
        let insertAfter = doc.getElementById('zotero-itemmenu-show-in-library');
        if (insertAfter && insertAfter.nextSibling) {
            itemMenu.insertBefore(menuitem, insertAfter.nextSibling);
        } else {
            itemMenu.appendChild(menuitem);
        }
    }

    // Also add to the tree context menu
    let contextMenu = doc.getElementById('zotero-items-menu');
    if (contextMenu) {
        let clonedItem = menuitem.cloneNode(true);
        clonedItem.id = 'rename-attachments-context-menuitem';
        clonedItem.addEventListener('command', renameAttachments);
        contextMenu.appendChild(clonedItem);
    }
}

function removeMenuItem(window) {
    let doc = window.document;
    
    // Remove from item menu
    let menuitem = doc.getElementById('rename-attachments-menuitem');
    if (menuitem) {
        menuitem.remove();
    }
    
    // Remove from context menu
    let contextMenuItem = doc.getElementById('rename-attachments-context-menuitem');
    if (contextMenuItem) {
        contextMenuItem.remove();
    }
}

/**
 * Configuration object for filename formatting (from rename.js)
 */
const config = {
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

function formatTitle(title, language = '') {
    if (!title) return '';
    
    // For CJK languages, minimal processing
    if (['ja', 'zh', 'ko'].includes(language.toLowerCase())) {
        return title.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '').trim();
    }
    
    let formatted = title
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .replace(/\b(the|a|an)\b/gi, '') // Remove articles
        .replace(/\b(and|or)\b/gi, '&'); // Replace conjunctions
    
    // Apply custom replacements from config
    for (let [original, replacement] of Object.entries(config.replacements)) {
        let regex = new RegExp(`\\b${original}\\b`, 'gi');
        formatted = formatted.replace(regex, replacement);
    }
    
    // Apply pattern replacements (like -ing â†’ ~)
    for (let [pattern, replacement] of Object.entries(config.patterns)) {
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
}

function formatAuthors(creators) {
    // Filter for authors (creatorTypeID 8 = author)
    let authors = creators.filter(creator => creator.creatorTypeID === 8);
    
    if (authors.length === 0) {
        return 'n.a.';
    } else if (authors.length === 1) {
        return authors[0].lastName || authors[0].name || 'Unknown';
    } else {
        // For multiple authors, always use "FirstAuthor et al."
        let firstAuthor = authors[0].lastName || authors[0].name || 'Unknown';
        return `${firstAuthor} et al.`;
    }
}

/**
 * Extract year from date field (from rename.js)
 */
function extractYear(dateString) {
    if (!dateString) return 'n.d.';
    
    // If it's already just a year
    if (/^\d{4}$/.test(dateString)) {
        return dateString;
    }
    
    // Extract year from various date formats
    let match = dateString.match(/(\d{4})/);
    return match ? match[1] : 'n.d.';
}

/**
 * Generate filename for an item (from rename.js)
 */
function generateFilename(item) {
    let authors = formatAuthors(item.getCreators());
    let year = extractYear(item.getField('date') || item.getField('year'));
    
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
    let formattedTitle = formatTitle(title, language);
    let filename = `${authors} (${year})_${formattedTitle}.pdf`;
    
    // Sanitise filename
    return filename
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
        .replace(/\s+/g, ' ') // Normalise spaces
        .replace(/\.+/g, '.') // Remove multiple dots
        .trim();
}

async function renameAttachments(event) {
    Zotero.debug("Rename attachments function called");
    
    var selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems.length) {
        alert('No items selected.');
        return;
    }

    Zotero.debug(`Processing ${selectedItems.length} items`);

    let results = {
        processed: 0,
        errors: 0,
        errorDetails: [],
        success: true
    };

    for (let item of selectedItems) {
        try {
            Zotero.debug(`Processing item: ${item.getField('title')}`);
            
            if (item.isAttachment()) {
                Zotero.debug("Skipping attachment item");
                continue; // Skip attachment items themselves
            }

            let filename = generateFilename(item);
            let attachmentIDs = item.getAttachments();
            let itemProcessed = false;
            
            Zotero.debug(`Generated filename: ${filename}`);
            Zotero.debug(`Found ${attachmentIDs.length} attachments`);
            
            for (let id of attachmentIDs) {
                let attachment = Zotero.Items.get(id);
                if (attachment && attachment.attachmentContentType === 'application/pdf') {
                    try {
                        let currentFilename = attachment.attachmentFilename;
                        
                        if (currentFilename === filename) {
                            Zotero.debug("Filenames are identical - no rename needed");
                            itemProcessed = true;
                            continue;
                        }
                        
                        Zotero.debug(`Attempting to rename from "${currentFilename}" to "${filename}"`);
                        
                        await attachment.renameAttachmentFile(filename);
                        
                        // Set attachment title to "PDF"
                        attachment.setField('title', 'PDF');
                        await attachment.saveTx();
                        
                        itemProcessed = true;
                        Zotero.debug(`âœ“ Successfully renamed attachment: ${filename}`);
                        
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
    
    // Show completion message
    let message = `Processed ${results.processed} items successfully.`;
    if (results.errors > 0) {
        message += ` ${results.errors} errors occurred.`;
        if (results.errorDetails.length <= 5) {
            message += '\n\nErrors:\n' + results.errorDetails.join('\n');
        } else {
            message += '\n\nFirst 5 errors:\n' + results.errorDetails.slice(0, 5).join('\n') + '\n...';
        }
    }
    
    alert(message);
}