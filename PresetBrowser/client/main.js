"use strict";

const cs = new CSInterface();

/** Sidebar scope: only favorites (starred paths). */
const FAVORITES_SCOPE = "__favorites__";

const state = {
    folders: [],
    allPresets: [],
    activeFolderPath: null,
    selectedPreset: null,
    favorites: new Set(),
    searchQuery: "",
    isLoading: false,
    resizerDragging: false,
    sidebarWidth: 160,
    /** Root folder paths whose subfolder rows are folded away. */
    collapsedRoots: new Set(),
};

// ─── Persistence ──────────────────────────────────────────────────────────────
// Folders + cached preset data stored together so boot is instant
function saveFolderCache() {
    try {
        const data = state.folders.map(f => ({ path: f.path, name: f.name, presets: f.presets }));
        localStorage.setItem("apm_v3_cache", JSON.stringify(data));
    } catch(e) {}
}
function loadFolderCache() {
    try {
        const r = localStorage.getItem("apm_v3_cache");
        return r ? JSON.parse(r) : [];
    } catch(e) { return []; }
}
function saveFavorites() {
    try { localStorage.setItem("apm_v3_favs", JSON.stringify([...state.favorites])); } catch(e) {}
}
function loadFavorites() {
    try { const r = localStorage.getItem("apm_v3_favs"); return r ? new Set(JSON.parse(r)) : new Set(); } catch(e) { return new Set(); }
}
function saveSidebarW() {
    try { localStorage.setItem("apm_v3_sw", state.sidebarWidth); } catch(e) {}
}
function loadSidebarW() {
    try { return parseInt(localStorage.getItem("apm_v3_sw")) || 160; } catch(e) { return 160; }
}
function saveCollapsed() {
    try { localStorage.setItem("apm_v3_collapsed", JSON.stringify([...state.collapsedRoots])); } catch(e) {}
}
function loadCollapsed() {
    try {
        const r = localStorage.getItem("apm_v3_collapsed");
        return r ? new Set(JSON.parse(r)) : new Set();
    } catch(e) { return new Set(); }
}

function rootFolderForPath(p) {
    if (p == null || p === FAVORITES_SCOPE) return null;
    for (const f of state.folders) {
        if (p === f.path) return f;
        if (p.startsWith(f.path + "/") || p.startsWith(f.path + "\\")) return f;
    }
    return null;
}

// ─── Bridge ───────────────────────────────────────────────────────────────────
function evalScript(fn, args) {
    return new Promise(resolve => {
        const call = args
            ? `${fn}(${args.map(a => JSON.stringify(a)).join(",")})`
            : `${fn}()`;
        cs.evalScript(call, result => {
            try { resolve(JSON.parse(result)); }
            catch(e) { resolve({ error: "Parse error: " + result }); }
        });
    });
}

// ─── Status ───────────────────────────────────────────────────────────────────
let _statusTimer = null;
function setStatus(msg, type) {
    const bar = document.getElementById("status-bar");
    if (!bar) return;
    bar.textContent = msg;
    bar.className = type || "";
    clearTimeout(_statusTimer);
    if (type && type !== "error") {
        _statusTimer = setTimeout(() => { bar.textContent = ""; bar.className = ""; }, 3000);
    }
}
function shakeStatus() {
    const bar = document.getElementById("status-bar");
    if (!bar) return;
    bar.classList.remove("shake");
    void bar.offsetWidth;
    bar.classList.add("shake");
}
function setLoading(on) {
    const ov = document.getElementById("loading-overlay");
    if (ov) ov.style.opacity = on ? "1" : "0";
}

// ─── Folder switch animation ──────────────────────────────────────────────────
function animateListSwitch(fn) {
    const list = document.getElementById("preset-list");
    if (!list) { fn(); return; }
    list.classList.remove("switching");
    void list.offsetWidth; // reflow
    fn();
    list.classList.add("switching");
    // clean up class after animation
    setTimeout(() => list.classList.remove("switching"), 250);
}

// ─── Folder management ────────────────────────────────────────────────────────
function promptAddFolder() {
    cs.evalScript(`(function(){
        var f = Folder.selectDialog("Select preset folder");
        return f ? f.fsName : "";
    })()`, result => {
        const path = (result || "").trim();
        if (!path || path === "null") return;
        if (state.folders.find(f => f.path === path)) {
            setStatus("Already added", "warn"); return;
        }
        scanAndAddFolder(path);
    });
}

function refreshSettingsIfOpen() {
    const ov = document.getElementById("settings-overlay");
    if (ov && !ov.hidden) renderSettingsPaths();
}

async function scanAndAddFolder(path) {
    setLoading(true);
    setStatus("Scanning…", "info");
    const res = await evalScript("scanPresets", [path]);
    setLoading(false);
    if (res.error) { setStatus(res.error, "error"); shakeStatus(); return; }

    const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
    const folder = { path, name, presets: res.files };
    folder.presets.forEach(p => { p.rootFolder = name; });
    state.folders.push(folder);
    rebuildAllPresets();
    saveFolderCache();
    renderSidebar();
    setActivePath(null);
    refreshSettingsIfOpen();
    setStatus(`${res.files.length} presets loaded`, "ok");
}

// Re-scan all folders in background (called after instant boot from cache)
async function refreshInBackground() {
    for (const folder of state.folders) {
        const res = await evalScript("scanPresets", [folder.path]);
        if (!res.error) {
            folder.presets = res.files;
            folder.presets.forEach(p => { p.rootFolder = folder.name; });
        }
    }
    rebuildAllPresets();
    saveFolderCache();
    renderSidebar();
    renderPresets();
}

async function refreshAll() {
    if (!state.folders.length) return;
    setLoading(true);
    setStatus("Refreshing…", "info");
    await refreshInBackground();
    setLoading(false);
    setStatus("Refreshed", "ok");
}

function rebuildAllPresets() {
    state.allPresets = [];
    const seen = new Set();
    state.folders.forEach(folder => {
        folder.presets.forEach(p => {
            if (!seen.has(p.path)) { seen.add(p.path); state.allPresets.push(p); }
        });
    });
}

function favoritePresetCount() {
    return state.allPresets.filter(p => state.favorites.has(p.path)).length;
}

function removeFolderAtPath(path) {
    const idx = state.folders.findIndex(f => f.path === path);
    if (idx === -1) return;
    state.folders.splice(idx, 1);
    state.collapsedRoots.delete(path);
    saveCollapsed();
    rebuildAllPresets();
    saveFolderCache();
    if (state.activeFolderPath === path || rootFolderForPath(state.activeFolderPath)?.path === path) {
        state.activeFolderPath = null;
    }
    if (state.selectedPreset && !state.allPresets.some(p => p.path === state.selectedPreset.path)) {
        state.selectedPreset = null;
    }
    const revealBtn = document.getElementById("btn-reveal");
    if (revealBtn) revealBtn.disabled = !state.selectedPreset;
    const removeBtn = document.getElementById("btn-remove");
    if (removeBtn) removeBtn.disabled = !state.folders.find(f => f.path === state.activeFolderPath);
    renderSidebar();
    renderPresets();
    refreshSettingsIfOpen();
    setStatus("Folder removed", "warn");
}

function removeActive() {
    const path = state.activeFolderPath;
    if (!path) return;
    if (!state.folders.find(f => f.path === path)) return;
    removeFolderAtPath(path);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar() {
    const tree = document.getElementById("folder-tree");
    tree.innerHTML = "";

    const allEl = makeTreeItem("All", state.allPresets.length, null, false);
    tree.appendChild(allEl);
    tree.appendChild(makeTreeItem("Favorites", favoritePresetCount(), FAVORITES_SCOPE, false));

    if (!state.folders.length) {
        const hint = document.createElement("div");
        hint.className = "tree-empty";
        hint.textContent = "No folders — click + or open Settings";
        tree.appendChild(hint);
        return;
    }

    state.folders.forEach(folder => {
        const subMap = new Map();
        folder.presets.forEach(p => {
            if (p.folder !== folder.path) {
                subMap.set(p.folder, (subMap.get(p.folder) || 0) + 1);
            }
        });
        const hasSubs = subMap.size > 0;
        let collapsed = state.collapsedRoots.has(folder.path);
        if (collapsed && state.activeFolderPath) {
            const root = rootFolderForPath(state.activeFolderPath);
            if (root && root.path === folder.path) {
                state.collapsedRoots.delete(folder.path);
                saveCollapsed();
                collapsed = false;
            }
        }

        const group = document.createElement("div");
        group.className = "tree-folder-group";

        const head = document.createElement("div");
        const headActive = state.activeFolderPath === folder.path;
        head.className = "tree-item tree-folder-head" + (headActive ? " active" : "");

        if (hasSubs) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "tree-toggle";
            toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
            toggle.textContent = collapsed ? "▸" : "▾";
            toggle.title = collapsed ? "Show subfolders" : "Hide subfolders";
            toggle.addEventListener("click", e => {
                e.stopPropagation();
                e.preventDefault();
                if (state.collapsedRoots.has(folder.path)) state.collapsedRoots.delete(folder.path);
                else state.collapsedRoots.add(folder.path);
                saveCollapsed();
                renderSidebar();
            });
            head.appendChild(toggle);
        } else {
            const sp = document.createElement("span");
            sp.className = "tree-toggle tree-toggle-spacer";
            sp.setAttribute("aria-hidden", "true");
            head.appendChild(sp);
        }

        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = folder.name;
        const countEl = document.createElement("span");
        countEl.className = "tree-count";
        countEl.textContent = String(folder.presets.length);
        head.appendChild(label);
        head.appendChild(countEl);
        head.addEventListener("click", () => setActivePath(folder.path));

        group.appendChild(head);

        if (hasSubs) {
            const children = document.createElement("div");
            children.className = "tree-children";
            children.hidden = collapsed;
            subMap.forEach((count, subPath) => {
                const subName = subPath.split(/[/\\]/).filter(Boolean).pop();
                children.appendChild(makeTreeItem(subName, count, subPath, true));
            });
            group.appendChild(children);
        }

        tree.appendChild(group);
    });
}

function makeTreeItem(label, count, path, isSub) {
    const el = document.createElement("div");
    const isActive = state.activeFolderPath === path;
    el.className = "tree-item" + (isSub ? " tree-sub" : "") + (isActive ? " active" : "");
    el.innerHTML = `<span class="tree-label">${esc(label)}</span><span class="tree-count">${count}</span>`;
    el.addEventListener("click", () => setActivePath(path));
    return el;
}

function setActivePath(path) {
    if (path != null && path !== FAVORITES_SCOPE) {
        const root = rootFolderForPath(path);
        if (root && state.collapsedRoots.has(root.path)) {
            state.collapsedRoots.delete(root.path);
            saveCollapsed();
        }
    }
    const changed = state.activeFolderPath !== path;
    state.activeFolderPath = path;
    const removeBtn = document.getElementById("btn-remove");
    if (removeBtn) removeBtn.disabled = !state.folders.find(f => f.path === path);
    renderSidebar();
    if (changed) {
        animateListSwitch(() => renderPresets());
    } else {
        renderPresets();
    }
}

// ─── Preset list ──────────────────────────────────────────────────────────────
function renderPresets() {
    const list = document.getElementById("preset-list");
    const empty = document.getElementById("empty-state");
    const query = state.searchQuery.toLowerCase();

    let source = state.allPresets;
    if (state.activeFolderPath === FAVORITES_SCOPE) {
        source = source.filter(p => state.favorites.has(p.path));
    } else if (state.activeFolderPath !== null) {
        const ap = state.activeFolderPath;
        source = source.filter(p =>
            p.folder === ap ||
            p.folder.startsWith(ap + "/") ||
            p.folder.startsWith(ap + "\\")
        );
    }
    if (query) source = source.filter(p => p.name.toLowerCase().includes(query));

    list.innerHTML = "";

    if (!source.length) {
        if (empty) {
            const textEl = empty.querySelector(".empty-text");
            if (textEl) {
                textEl.textContent = state.activeFolderPath === FAVORITES_SCOPE
                    ? "No favorites yet — star presets to add them"
                    : "Add a folder with .ffx files";
            }
            empty.style.display = "flex";
        }
        return;
    }
    if (empty) empty.style.display = "none";

    const showFolder =
        (state.activeFolderPath === null || state.activeFolderPath === FAVORITES_SCOPE) &&
        state.folders.length > 1;

    source.forEach(preset => {
        const isSel = state.selectedPreset?.path === preset.path;
        const isFav = state.favorites.has(preset.path);

        const row = document.createElement("div");
        row.className = "preset-row" + (isSel ? " selected" : "");

        const nameHtml = query ? highlightMatch(esc(preset.name), query) : esc(preset.name);
        const folderHtml = showFolder
            ? `<span class="preset-folder">${esc(preset.rootFolder)}</span>`
            : "";

        row.innerHTML = `
            <span class="preset-name">${nameHtml}</span>
            ${folderHtml}
            <button class="fav-btn${isFav ? " active" : ""}">${isFav ? "★" : "☆"}</button>
        `;

        row.addEventListener("click", e => {
            if (e.target.classList.contains("fav-btn")) return;
            selectPreset(preset);
        });
        row.addEventListener("dblclick", e => {
            if (e.target.classList.contains("fav-btn")) return;
            selectPreset(preset);
            applySelected();
        });
        row.querySelector(".fav-btn").addEventListener("click", e => {
            e.stopPropagation();
            toggleFav(preset.path, e.currentTarget);
        });

        list.appendChild(row);
    });
}

function highlightMatch(text, query) {
    const lo = text.toLowerCase();
    const idx = lo.indexOf(query);
    if (idx === -1) return text;
    return text.slice(0, idx) + `<mark>${text.slice(idx, idx + query.length)}</mark>` + text.slice(idx + query.length);
}

function selectPreset(preset) {
    state.selectedPreset = preset;
    const revealBtn = document.getElementById("btn-reveal");
    if (revealBtn) revealBtn.disabled = false;
    // Update selection visually without full re-render (no flash)
    document.querySelectorAll(".preset-row").forEach(row => row.classList.remove("selected"));
    const rows = document.querySelectorAll(".preset-row");
    const visible = getVisiblePresets();
    const idx = visible.findIndex(p => p.path === preset.path);
    if (rows[idx]) {
        rows[idx].classList.add("selected");
        rows[idx].scrollIntoView({ block: "nearest" });
    }
}

function toggleFav(path, btn) {
    if (state.favorites.has(path)) {
        state.favorites.delete(path); btn.classList.remove("active"); btn.textContent = "☆";
    } else {
        state.favorites.add(path); btn.classList.add("active"); btn.textContent = "★";
    }
    saveFavorites();
    renderSidebar();
    if (state.activeFolderPath === FAVORITES_SCOPE) renderPresets();
}

// ─── Apply ────────────────────────────────────────────────────────────────────
async function applySelected() {
    if (!state.selectedPreset) { setStatus("Select a preset first", "warn"); return; }
    setLoading(true);
    setStatus("Applying…", "info");
    const res = await evalScript("applyPreset", [state.selectedPreset.path]);
    setLoading(false);
    if (res.error) { setStatus(res.error, "error"); shakeStatus(); }
    else { setStatus(`✓ ${state.selectedPreset.name}`, "ok"); }
}

async function revealSelected() {
    if (!state.selectedPreset) return;
    await evalScript("openInExplorer", [state.selectedPreset.path]);
}

// ─── Visible presets helper ───────────────────────────────────────────────────
function getVisiblePresets() {
    let source = state.allPresets;
    if (state.activeFolderPath === FAVORITES_SCOPE) {
        source = source.filter(p => state.favorites.has(p.path));
    } else if (state.activeFolderPath !== null) {
        const ap = state.activeFolderPath;
        source = source.filter(p =>
            p.folder === ap ||
            p.folder.startsWith(ap + "/") ||
            p.folder.startsWith(ap + "\\")
        );
    }
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        source = source.filter(p => p.name.toLowerCase().includes(q));
    }
    return source;
}

// ─── Resizer ──────────────────────────────────────────────────────────────────
function initResizer() {
    const resizer = document.getElementById("resizer");
    const sidebar = document.getElementById("sidebar");
    if (!resizer || !sidebar) return;
    state.sidebarWidth = loadSidebarW();
    sidebar.style.width = state.sidebarWidth + "px";

    let startX, startW;
    resizer.addEventListener("mousedown", e => {
        startX = e.clientX; startW = sidebar.offsetWidth;
        state.resizerDragging = true;
        resizer.classList.add("dragging");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", e => {
        if (!state.resizerDragging) return;
        const w = Math.min(280, Math.max(100, startW + e.clientX - startX));
        sidebar.style.width = w + "px";
        state.sidebarWidth = w;
    });
    document.addEventListener("mouseup", () => {
        if (!state.resizerDragging) return;
        state.resizerDragging = false;
        resizer.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        saveSidebarW();
    });
}

// ─── Search ───────────────────────────────────────────────────────────────────
function initSearch() {
    const input = document.getElementById("search-input");
    if (!input) return;
    let debounce;
    input.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            state.searchQuery = input.value.trim();
            animateListSwitch(() => renderPresets());
        }, 120);
    });
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────
function initKeyboard() {
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            const settingsOv = document.getElementById("settings-overlay");
            if (settingsOv && !settingsOv.hidden) { closeSettings(); return; }
        }
        if (document.activeElement?.tagName === "INPUT") return;
        if (e.key === "Enter" && state.selectedPreset) { applySelected(); return; }
        if (e.key === "Escape") {
            const input = document.getElementById("search-input");
            if (input) { input.value = ""; state.searchQuery = ""; animateListSwitch(() => renderPresets()); }
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const visible = getVisiblePresets();
            if (!visible.length) return;
            const cur = state.selectedPreset ? visible.findIndex(p => p.path === state.selectedPreset.path) : -1;
            const next = Math.max(0, Math.min(visible.length - 1, e.key === "ArrowDown" ? cur + 1 : cur - 1));
            selectPreset(visible[next]);
        }
    });
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function esc(str) {
    if (!str) return "";
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function openSettings() {
    const ov = document.getElementById("settings-overlay");
    if (!ov) return;
    ov.hidden = false;
    renderSettingsPaths();
    document.getElementById("btn-settings-close")?.focus();
}

function closeSettings() {
    const ov = document.getElementById("settings-overlay");
    if (ov) ov.hidden = true;
}

function renderSettingsPaths() {
    const list = document.getElementById("settings-path-list");
    if (!list) return;
    list.innerHTML = "";
    if (!state.folders.length) {
        const empty = document.createElement("div");
        empty.className = "settings-empty";
        empty.textContent = "No folders yet — use Add folder below or + in the toolbar.";
        list.appendChild(empty);
        return;
    }
    state.folders.forEach(f => {
        const row = document.createElement("div");
        row.className = "settings-path-row";
        const pathSpan = document.createElement("span");
        pathSpan.className = "settings-path-text";
        pathSpan.title = f.path;
        pathSpan.textContent = f.path;
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "settings-remove";
        rm.textContent = "Remove";
        rm.addEventListener("click", () => { removeFolderAtPath(f.path); });
        row.appendChild(pathSpan);
        row.appendChild(rm);
        list.appendChild(row);
    });
}

function initSettings() {
    document.getElementById("btn-settings")?.addEventListener("click", openSettings);
    document.getElementById("btn-settings-close")?.addEventListener("click", closeSettings);
    document.getElementById("btn-settings-add-folder")?.addEventListener("click", () => {
        promptAddFolder();
    });
    const ov = document.getElementById("settings-overlay");
    ov?.addEventListener("click", e => {
        if (e.target === ov) closeSettings();
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
    state.favorites = loadFavorites();
    state.collapsedRoots = loadCollapsed();
    initResizer();
    initSettings();
    initSearch();
    initKeyboard();

    document.getElementById("btn-add-folder")?.addEventListener("click", promptAddFolder);
    document.getElementById("btn-remove")?.addEventListener("click", removeActive);
    document.getElementById("btn-refresh")?.addEventListener("click", refreshAll);
    document.getElementById("btn-reveal")?.addEventListener("click", revealSelected);

    // Load from cache instantly — no waiting
    const cached = loadFolderCache();
    if (cached.length) {
        cached.forEach(f => {
            f.presets.forEach(p => { p.rootFolder = f.name; });
            state.folders.push(f);
        });
        rebuildAllPresets();
        renderSidebar();
        renderPresets();
        setStatus("", "");
        // Then silently re-scan in background to pick up any new files
        refreshInBackground();
    } else {
        renderSidebar();
        renderPresets();
    }
}

document.addEventListener("DOMContentLoaded", boot);