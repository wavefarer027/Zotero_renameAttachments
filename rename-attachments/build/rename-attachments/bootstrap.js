var chromeHandle;
var windowListener;

function install(data, reason) {}

async function startup({ id, version, rootURI }, reason) {
    // Wait for Zotero to be ready
    await Zotero.initializationPromise;

    // Register chrome URLs
    var aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"]
        .getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
        ["content", "rename-attachments", "chrome/content/"]
    ]);

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
    
    // Remove chrome handle
    if (chromeHandle) {
        chromeHandle.destruct();
        chromeHandle = null;
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
    
    // For Japanese or other non-Latin scripts, return as-is
    if (language === 'ja' || language === 'zh' || language === 'ko') {
        return title.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
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
    // Filter for authors (creatorTypeID 1 = author)
    let authors = creators.filter(creator => creator.creatorTypeID === 1);
    
    if (authors.length === 0) {
        return 'n.a.';
    } else if (authors.length === 1) {
        return authors[0].lastName || authors[0].name || 'Unknown';
    } else if (authors.length === 2) {
        return `${authors[0].lastName || authors[0].name} & ${authors[1].lastName || authors[1].name}`;
    } else {
        return `${authors[0].lastName || authors[0].name} et al.`;
    }
}

async function renameAttachments(event) {
    var selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems.length) {
        event.target.ownerGlobal.alert('No items selected.');
        return;
    }

    let processedCount = 0;
    let errorCount = 0;
    let errors = [];

    for (let item of selectedItems) {
        try {
            if (item.isAttachment()) {
                continue; // Skip if the selected item is itself an attachment
            }

            // Get bibliographic data
            let authors = formatAuthors(item.getCreators());
            let year = item.getField('date') || item.getField('year') || 'n.d.';
            
            // Extract year from date if it's a full date
            if (year && year.length > 4) {
                let match = year.match(/(\d{4})/);
                if (match) {
                    year = match[1];
                }
            }
            
            // Get title
            let shortTitle = item.getField('shortTitle');
            let fullTitle = item.getField('title');
            let title = shortTitle || fullTitle || '';
            let language = item.getField('language') || '';
            
            let formattedTitle = formatTitle(title, language);
            let fileName = `${authors} (${year})_${formattedTitle}.pdf`;
            
            // Clean up filename to ensure it's valid
            fileName = fileName.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
            
            // Rename attachments
            let attachmentIDs = item.getAttachments();
            let renamedCount = 0;
            
            for (let id of attachmentIDs) {
                let attachment = Zotero.Items.get(id);
                if (attachment && attachment.attachmentContentType === 'application/pdf') {
                    try {
                        await attachment.renameAttachmentFile(fileName);
                        await attachment.saveTx();
                        renamedCount++;
                        Zotero.debug(`Successfully renamed attachment to: ${fileName}`);
                    } catch (e) {
                        Zotero.debug(`Error renaming attachment for item "${item.getField('title')}": ${e}`);
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
    
    event.target.ownerGlobal.alert(message);
}