var chromeHandle;

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

    // Add menu item to all windows
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
        addMenuItem(win);
    }
}

function shutdown(data, reason) {
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

function onMainWindowLoad(win) {
    addMenuItem(win);
}

function onMainWindowUnload(win) {
    removeMenuItem(win);
}

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

async function renameAttachments(event) {
    var selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems.length) {
        return "No items selected.";
    }

    for (let item of selectedItems) {
        if (!item.isAttachment()) {
            // Set author(s)
            let authors = item.getCreators().filter(creator => creator.creatorTypeID === 1);
            let firstAuthor = "n.a.";
            if (authors.length === 1) {
                firstAuthor = authors[0].lastName;
            } else if (authors.length === 2) {
                firstAuthor = `${authors[0].lastName} & ${authors[1].lastName}`;
            } else if (authors.length > 2) {
                firstAuthor = `${authors[0].lastName} et al.`;
            }
            
            // Set year
            let year = item.getField("year") || "n.d.";
            
            // Set title
            let st = item.getField("shortTitle");
            let t = item.getField("title");
            let title = st || t || "";
            title = title
                .replace(/[^a-zA-Z0-9 ]/g, "") // remove special characters
                .replace(/\b(the|a)\b/gi, "")
                .replace(/\b(, and|and)\b/gi, "&")
                .replace(/ing\b/g, "\u0337̲̲")
                .replace(/ed\b/g, "\u0332̲̲")
                .replace(/\bbetween\b/gi, "btwn")
                .replace(/\bversus\b/gi, "vs")
                .replace(/\btransgender\b/gi, "trans")
                .replace(/\b(suicidal|suicide) (ideation|thoughts|thought)/gi, "SI")
                .replace(/\bsuicide prevention/gi, "SP")
                .replace(/\bmental health/gi, "MH")
                .replace(/\bposttraumatic stress disorder/gi, "PTSD")
                .replace(/\bunited states/gi, "US")
                .replace(/\b(identities|identity)\b/gi, "ID")
                .split(/\s+/)
                .map((word, index) => {
                    return index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1);
                })
                .join("");
            
            let fileName = `${firstAuthor} (${year})_${title}.pdf`;

            // Rename attachment
            let attachmentIDs = item.getAttachments();
            for (let id of attachmentIDs) {
                let attachment = Zotero.Items.get(id);
                if (attachment.attachmentContentType == 'application/pdf') {
                    try {
                        await attachment.renameAttachmentFile(fileName);
                        await attachment.saveTx();
                        Zotero.debug(`Successfully renamed attachment to: ${fileName}`);
                    } catch (e) {
                        Zotero.debug(`Error renaming attachment: ${e}`);
                    }
                }
            }
        }
    }
    
    // Show completion message
    event.target.ownerGlobal.alert(`${selectedItems.length} items processed.`);
}