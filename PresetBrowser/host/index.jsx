/**
 * Animation Presets Manager — ExtendScript Host
 * host/index.jsx
 */

function scanPresets(folderPath) {
    try {
        var folder = new Folder(folderPath);
        if (!folder.exists) return JSON.stringify({ error: "Folder not found: " + folderPath });
        var results = [];
        collectFFX(folder, results);
        return JSON.stringify({ files: results });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

function collectFFX(folder, results) {
    var items = folder.getFiles();
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item instanceof Folder) {
            collectFFX(item, results);
        } else if (item instanceof File && item.name.match(/\.ffx$/i)) {
            results.push({
                name:     decodeURI(item.name).replace(/\.ffx$/i, ""),
                fullName: decodeURI(item.name),
                path:     decodeURI(item.fsName),
                folder:   decodeURI(item.parent.fsName)
            });
        }
    }
}

function applyPreset(filePath) {
    try {
        // Try both slash styles — AE is picky on Windows
        var presetFile = new File(filePath);
        if (!presetFile.exists) {
            presetFile = new File(filePath.replace(/\\/g, "/"));
        }
        if (!presetFile.exists) {
            presetFile = new File(filePath.replace(/\//g, "\\"));
        }
        if (!presetFile.exists) {
            return JSON.stringify({ error: "File not found: " + filePath });
        }

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "Open a composition first." });
        }

        var layers = comp.selectedLayers;
        if (layers.length === 0) {
            return JSON.stringify({ error: "Select at least one layer first." });
        }

        app.beginUndoGroup("Apply Preset");

        var applied = 0;
        var lastErr = "";

        for (var i = 0; i < layers.length; i++) {
            try {
                layers[i].applyPreset(presetFile);
                applied++;
            } catch (e1) {
                lastErr = e1.toString();
                // Method 2: use the file's URI form
                try {
                    var uriFile = new File(presetFile.absoluteURI);
                    layers[i].applyPreset(uriFile);
                    applied++;
                } catch (e2) {
                    lastErr = e2.toString();
                }
            }
        }

        app.endUndoGroup();

        if (applied === 0) {
            return JSON.stringify({ error: "Apply failed: " + lastErr });
        }
        return JSON.stringify({ success: true, applied: applied });

    } catch (e) {
        try { app.endUndoGroup(); } catch (x) {}
        return JSON.stringify({ error: e.message });
    }
}

function openInExplorer(filePath) {
    try {
        var f = new File(filePath);
        if (!f.exists) return JSON.stringify({ error: "File not found." });
        f.parent.execute();
        return JSON.stringify({ success: true });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

function getCompInfo() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return JSON.stringify({ hasComp: false });
        return JSON.stringify({
            hasComp: true,
            name: comp.name,
            selectedLayers: comp.selectedLayers.length
        });
    } catch (e) {
        return JSON.stringify({ hasComp: false });
    }
}
