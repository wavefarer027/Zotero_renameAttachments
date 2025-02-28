if (!Zotero.RenameAttachments) {
    Zotero.RenameAttachments = {};
}

Zotero.RenameAttachments.rename = async function() {
    var selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems.length) {
        return "No items selected.";
    }

    for (let item of selectedItems) {
        if (!item.isAttachment()) {
            // Set author(s)
            let authors = item.getCreators().filter(creator => creator.creatorTypeID === 8);
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
            if (item.getField("language") == "ja") {
                title = title;
            } else {
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
                    // return index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    return index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1);
                })
                .join("");
            }
            let fileName = `${firstAuthor} (${year})_${title}.pdf`;

            
            // Rename attachment
            let attachmentIDs = item.getAttachments();
            for (let id of attachmentIDs) {
                let attachment = Zotero.Items.get(id);
                if (attachment.attachmentContentType == 'application/pdf') {
                    await attachment.renameAttachmentFile(fileName);
                    await attachment.saveTx();
                }
            }
        }
    }
    return selectedItems.length + " items processed.";
};


