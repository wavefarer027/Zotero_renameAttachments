var chromeHandle;
var windowListener;

function install(data, reason) {}

async function startup({ id, version, rootURI }, reason) {
    // Wait for Zotero to be ready
    await Zotero.initializationPromise;

    // Add menu item to all existing windows
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
        addMenuItem(win);
    }
    
    // Register listener for new windows
    windowListener = {
        onOpenWindow: function(xulWindow) {
            let domWindow = xulWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIDOMWindowInternal || Components.interfaces.nsIDOMWindow);
            
            domWindow.addEventListener("load", function listener() {
                domWindow.removeEventListener("load", listener, false);
                
                // Check if this is a Zotero window
                if (domWindow.Zotero && domWindow.Zotero.getActiveZoteroPane) {
                    addMenuItem(domWindow);
                }
            }, false);
        },
        onCloseWindow: function(xulWindow) {},
        onWindowTitleChange: function(xulWindow, newTitle) {}
    };
    
    // Add the window listener
    Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
    // Remove window listener
    if (windowListener) {
        Services.wm.removeListener(windowListener);
        windowListener = null;
    }
    
    // Remove menu items from all windows
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
        removeMenuItem(win);
    }
}

function uninstall(data, reason) {}

function addMenuItem(window) {
    let doc = window.document;
    
    // Create menu item for the item menu
    let menuitem = doc.createXULElement('menuitem');
    menuitem.id = 'rename-attachments-menuitem';
    menuitem.setAttribute('label', 'Rename Attachments');
    menuitem.addEventListener('command', renameAttachments);
    
    // Add to both the item menu and the context menu
    let itemMenu = doc.getElementById('zotero-itemmenu');
    if (itemMenu) {
        let insertAfter = doc.getElementById('zotero-itemmenu-show-in-library');
        if (insertAfter && insertAfter.nextSibling) {
            itemMenu.insertBefore(menuitem, insertAfter.nextSibling);
        } else {
            itemMenu.appendChild(menuitem);
        }
    }

    // Also add to context menu
    let contextMenu = doc.getElementById('zotero-item-tree-context-menu');
    if (contextMenu) {
        let clonedItem = menuitem.cloneNode(true);
        clonedItem.id = 'rename-attachments-context-menuitem';
        clonedItem.addEventListener('command', renameAttachments);
        
        let insertAfter = doc.getElementById('zotero-item-tree-context-menu-show-in-library');
        if (insertAfter && insertAfter.nextSibling) {
            contextMenu.insertBefore(clonedItem, insertAfter.nextSibling);
        } else {
            contextMenu.appendChild(clonedItem);
        }
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

function formatTitle(title, language = '') {
    if (!title) return '';
    
    // For Japanese or other non-Latin scripts, minimal processing
    if (language === 'ja' || language === 'zh' || language === 'ko') {
        return title.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '').trim();
    }
    
    // English and other Latin-script processing
    return title
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .replace(/\b(the|a|an)\b/gi, '') // Remove articles
        .replace(/\b(and|or)\b/gi, '&') // Replace conjunctions
        .replace(/\bbetween\b/gi, 'btwn')
        .replace(/\bversus\b/gi, 'vs')
        .replace(/\btransgender\b/gi, 'trans')
        .replace(/\bsuicidal?\s+(ideation|thoughts?)\b/gi, 'SI')
        .replace(/\bsuicide\s+prevention\b/gi, 'SP')
        .replace(/\bmental\s+health\b/gi, 'MH')
        .replace(/\bpost[\s-]?traumatic\s+stress\s+disorder\b/gi, 'PTSD')
        .replace(/\bunited\s+states\b/gi, 'US')
        .replace(/\b(identities|identity)\b/gi, 'ID')
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
    // Filter for authors (creatorTypeID 8 = author in your system)
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

async function renameAttachments(event) {
    Zotero.debug("Rename attachments function called"); // Debug log
    
    var selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems.length) {
        alert('No items selected.');
        return;
    }

    Zotero.debug(`Processing ${selectedItems.length} items`); // Debug log

    let processedCount = 0;
    let errorCount = 0;
    let errors = [];

    for (let item of selectedItems) {
        try {
            Zotero.debug(`Processing item: ${item.getField('title')}`); // Debug log
            
            if (item.isAttachment()) {
                Zotero.debug("Skipping attachment item"); // Debug log
                continue; // Skip if the selected item is itself an attachment
            }

            // Get bibliographic data
            let creators = item.getCreators();
            Zotero.debug("Creators: " + JSON.stringify(creators)); // Debug log
            
            let authors = formatAuthors(creators);
            let year = item.getField('date') || item.getField('year') || 'n.d.';
            
            // Extract year from date if it's a full date
            if (year && year.length > 4) {
                let match = year.match(/(\d{4})/);
                if (match) {
                    year = match[1];
                }
            }
            
            // Get and process the title for filename
            let shortTitle = item.getField('shortTitle');
            let fullTitle = item.getField('title');
            
            let title, titleSource;
            if (shortTitle && shortTitle.trim()) {
                title = shortTitle;
                titleSource = "Short Title";
            } else {
                title = fullTitle || '';
                titleSource = "Title";
            }
            
            Zotero.debug(`Using ${titleSource}: "${title}"`);
            
            let language = item.getField('language') || '';
            let formattedTitle = formatTitle(title, language);
            let fileName = `${authors} (${year})_${formattedTitle}.pdf`;
            
            // Clean up filename to ensure it's valid
            fileName = fileName.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
            
            Zotero.debug(`Generated filename: ${fileName}`); // Debug log
            
            // Rename attachments
            let attachmentIDs = item.getAttachments();
            Zotero.debug(`Found ${attachmentIDs.length} attachments`); // Debug log
            
            let renamedCount = 0;
            
            for (let id of attachmentIDs) {
                let attachment = Zotero.Items.get(id);
                Zotero.debug(`Attachment content type: ${attachment.attachmentContentType}`); // Debug log
                
                if (attachment && attachment.attachmentContentType === 'application/pdf') {
                    try {
                        // Get current filename for comparison
                        let currentFilename = attachment.attachmentFilename;
                        Zotero.debug(`Current filename: ${currentFilename}`);
                        Zotero.debug(`New filename: ${fileName}`);
                        
                        // Check if filenames are the same
                        if (currentFilename === fileName) {
                            Zotero.debug("Filenames are identical - no rename needed");
                            renamedCount++; // Still count as processed
                            continue;
                        }
                        
                        Zotero.debug(`Attempting to rename attachment ${id} from "${currentFilename}" to "${fileName}"`);
                        
                        // Try the rename
                        let result = await attachment.renameAttachmentFile(fileName);
                        Zotero.debug(`Rename result: ${result}`);
                        
                        // Set attachment title to "PDF"
                        attachment.setField('title', 'PDF');
                        
                        await attachment.saveTx();
                        renamedCount++;
                        
                        // Verify the rename worked
                        let newFilename = attachment.attachmentFilename;
                        Zotero.debug(`After rename, filename is now: ${newFilename}`);
                        
                        if (newFilename === fileName) {
                            Zotero.debug(`✓ Successfully renamed attachment to: ${fileName}`);
                        } else {
                            Zotero.debug(`⚠ Warning: Expected ${fileName} but got ${newFilename}`);
                        }
                        
                    } catch (e) {
                        Zotero.debug(`Error renaming attachment for item "${item.getField('title')}": ${e}`);
                        Zotero.debug("Full error: " + e.toString());
                        errors.push(`${item.getField('title')}: ${e.message}`);
                        errorCount++;
                    }
                }
            }
            
            if (renamedCount > 0) {
                processedCount++;
            }
            
        } catch (e) {
            Zotero.debug(`Error processing item "${item.getField('title')}": ${e}`);
            errors.push(`${item.getField('title')}: ${e.message}`);
            errorCount++;
        }
    }
    
    // Show completion message
    let message = `Processed ${processedCount} items successfully.`;
    if (errorCount > 0) {
        message += `\n${errorCount} errors occurred.`;
        if (errors.length <= 5) {
            message += '\n\nErrors:\n' + errors.join('\n');
        } else {
            message += '\n\nFirst 5 errors:\n' + errors.slice(0, 5).join('\n') + '\n...';
        }
    }
    
    alert(message);
}