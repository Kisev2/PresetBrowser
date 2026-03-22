/**
 * CSInterface.js  v11.0.0
 * Adobe CEP JavaScript Interface Library
 * Copyright (c) Adobe Systems Incorporated. All rights reserved.
 * https://github.com/Adobe-CEP/CSInterface
 *
 * Redistributed under the Adobe SDK license agreement.
 * This file is required for all CEP extensions to communicate
 * with the host application (After Effects, Premiere, etc.)
 */

"use strict";

// ─── ApiVersion ──────────────────────────────────────────────────────────────
function ApiVersion(major, minor, micro) {
    this.major = major;
    this.minor = minor;
    this.micro = micro;
}

// ─── RGBColor ─────────────────────────────────────────────────────────────────
function RGBColor(red, green, blue, alpha) {
    this.red   = red;
    this.green = green;
    this.blue  = blue;
    this.alpha = alpha;
}

// ─── Direction ───────────────────────────────────────────────────────────────
function Direction(left, top, right, bottom) {
    this.left   = left;
    this.top    = top;
    this.right  = right;
    this.bottom = bottom;
}

// ─── GradientStop ────────────────────────────────────────────────────────────
function GradientStop(offset, rgbColor) {
    this.offset   = offset;
    this.rgbColor = rgbColor;
}

// ─── GradientColor ────────────────────────────────────────────────────────────
function GradientColor(type, direction, numStops, arrGradientStop) {
    this.type           = type;
    this.direction      = direction;
    this.numStops       = numStops;
    this.arrGradientStop = arrGradientStop;
}

// ─── UIColor ─────────────────────────────────────────────────────────────────
function UIColor(type, antialiasLevel, color) {
    this.type           = type;
    this.antialiasLevel = antialiasLevel;
    this.color          = color;
}

// ─── AppSkinInfo ─────────────────────────────────────────────────────────────
function AppSkinInfo(baseFontFamily, baseFontSize, imageDPI,
    highlightColor, systemHighlightColor) {
    this.baseFontFamily      = baseFontFamily;
    this.baseFontSize        = baseFontSize;
    this.imageDPI            = imageDPI;
    this.highlightColor      = highlightColor;
    this.systemHighlightColor = systemHighlightColor;
}

// ─── HostEnvironment ─────────────────────────────────────────────────────────
function HostEnvironment(appName, appVersion, appLocale,
    appUILocale, appId, isAppOffline, appSkinInfo) {
    this.appName      = appName;
    this.appVersion   = appVersion;
    this.appLocale    = appLocale;
    this.appUILocale  = appUILocale;
    this.appId        = appId;
    this.isAppOffline = isAppOffline;
    this.appSkinInfo  = appSkinInfo;
}

// ─── HostCapabilities ────────────────────────────────────────────────────────
function HostCapabilities(EXTENDED_PANEL_MENU, EXTENDED_PANEL_ICONS,
    DELEGATE_APE_RENDERING, SUPPORT_HTML_EXTENSIONS, DISABLE_FLASH_EXTENSIONS) {
    this.EXTENDED_PANEL_MENU      = EXTENDED_PANEL_MENU;
    this.EXTENDED_PANEL_ICONS     = EXTENDED_PANEL_ICONS;
    this.DELEGATE_APE_RENDERING   = DELEGATE_APE_RENDERING;
    this.SUPPORT_HTML_EXTENSIONS  = SUPPORT_HTML_EXTENSIONS;
    this.DISABLE_FLASH_EXTENSIONS = DISABLE_FLASH_EXTENSIONS;
}

// ─── CSEvent ─────────────────────────────────────────────────────────────────
function CSEvent(type, scope, appId, extensionId) {
    this.type        = type;
    this.scope       = scope;
    this.appId       = appId;
    this.extensionId = extensionId;
    this.data        = "";
}
CSEvent.SCOPE_GLOBAL      = "GLOBAL";
CSEvent.SCOPE_APPLICATION = "APPLICATION";

// ─── SystemPath ──────────────────────────────────────────────────────────────
var SystemPath = {
    USER_DATA:       "userData",
    COMMON_FILES:    "commonFiles",
    MY_DOCUMENTS:    "myDocuments",
    APPLICATION:     "application",
    EXTENSION:       "extension",
    EXTENSION_DATA:  "extensionData",
    HOST_APPLICATION:"hostApplication"
};

// ─── ColorType ───────────────────────────────────────────────────────────────
var ColorType = {
    RGB:      "rgb",
    GRADIENT: "gradient",
    NONE:     "none"
};

// ─── CSInterface ─────────────────────────────────────────────────────────────
function CSInterface() {
    this.hostEnvironment = this.getHostEnvironment();
}

CSInterface.prototype.VERSION = "11.0.0";

CSInterface.prototype.getHostEnvironment = function () {
    if (window.__adobe_cep__) {
        var env = JSON.parse(window.__adobe_cep__.getHostEnvironment());
        this.hostEnvironment = env;
        return env;
    }
    // Dev fallback
    return {
        appId: "AEFT",
        appName: "AEFT",
        appVersion: "22.0.0",
        appLocale: "en_US",
        appUILocale: "en_US",
        isAppOffline: false,
        appSkinInfo: {
            baseFontFamily: "Tahoma",
            baseFontSize: 10,
            imageDPI: 96,
            highlightColor: { type: "rgb", antialiasLevel: 0, color: { red: 209, green: 0, blue: 0, alpha: 255 } },
            systemHighlightColor: { type: "rgb", antialiasLevel: 0, color: { red: 209, green: 0, blue: 0, alpha: 255 } }
        }
    };
};

CSInterface.prototype.closeExtension = function () {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.closeExtension();
    }
};

CSInterface.prototype.getExtensionID = function () {
    if (window.__adobe_cep__) {
        return window.__adobe_cep__.getExtensionID();
    }
    return "com.studio.animpresets.panel";
};

CSInterface.prototype.getScaleFactor = function () {
    if (window.__adobe_cep__) {
        return window.__adobe_cep__.getScaleFactor();
    }
    return 1;
};

CSInterface.prototype.getCurrentApiVersion = function () {
    if (window.__adobe_cep__) {
        return JSON.parse(window.__adobe_cep__.getCurrentApiVersion());
    }
    return new ApiVersion(11, 0, 0);
};

CSInterface.prototype.setPanelFlyoutMenu = function (menu) {
    if (window.__adobe_cep__ && typeof menu === "string") {
        window.__adobe_cep__.setPanelFlyoutMenu(menu);
    }
};

CSInterface.prototype.updatePanelMenuItem = function (menuItemLabel, enabled, checked) {
    var ret = false;
    if (window.__adobe_cep__ && this.getCurrentApiVersion().major >= 4) {
        ret = window.__adobe_cep__.updatePanelMenuItem(menuItemLabel, enabled, checked);
    }
    return ret;
};

CSInterface.prototype.setContextMenu = function (menu, callback) {
    if (window.__adobe_cep__ && typeof menu === "string") {
        window.__adobe_cep__.setContextMenu(menu, callback);
    }
};

CSInterface.prototype.setContextMenuByJSON = function (menu, callback) {
    if (window.__adobe_cep__ && typeof menu === "string") {
        window.__adobe_cep__.setContextMenuByJSON(menu, callback);
    }
};

CSInterface.prototype.updateContextMenuItem = function (menuItemID, enabled, checked) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.updateContextMenuItem(menuItemID, enabled, checked);
    }
};

CSInterface.prototype.getSystemPath = function (pathType) {
    if (!window.__adobe_cep__) return "";
    var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
    var OSVersion = this.getOSInformation();
    if (OSVersion.indexOf("Windows") >= 0) {
        path = path.replace("file:///", "");
    } else if (OSVersion.indexOf("Mac") >= 0) {
        path = path.replace("file://", "");
    }
    return path;
};

/**
 * evalScript — evaluates a script string in the host ExtendScript engine.
 * @param {string}   script   — ExtendScript code to evaluate
 * @param {function} callback — called with the string result
 */
CSInterface.prototype.evalScript = function (script, callback) {
    if (typeof callback !== "function") {
        callback = function (result) {};
    }
    if (window.__adobe_cep__) {
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        // Dev-mode: no AE connection, return mock error
        setTimeout(function () {
            callback(JSON.stringify({ error: "Not running inside After Effects" }));
        }, 50);
    }
};

CSInterface.prototype.getApplicationID = function () {
    var hostEnv = this.getHostEnvironment();
    return hostEnv.appId;
};

CSInterface.prototype.getHostCapabilities = function () {
    if (window.__adobe_cep__) {
        return JSON.parse(window.__adobe_cep__.getHostCapabilities());
    }
    return {};
};

CSInterface.prototype.dispatchEvent = function (event) {
    if (typeof event.data !== "object") {
        event.data = JSON.stringify(event.data);
    }
    if (window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    }
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    }
};

CSInterface.prototype.requestOpenExtension = function (extensionId, params) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.requestOpenExtension(extensionId, params || "");
    }
};

CSInterface.prototype.getExtensions = function (extensionIds) {
    if (window.__adobe_cep__) {
        return JSON.parse(window.__adobe_cep__.getExtensions(JSON.stringify(extensionIds)));
    }
    return [];
};

CSInterface.prototype.getNetworkPreferences = function () {
    if (window.__adobe_cep__) {
        return JSON.parse(window.__adobe_cep__.getNetworkPreferences());
    }
    return {};
};

CSInterface.prototype.initResourceBundle = function () {
    var resBundle = {};
    try {
        if (!window.__adobe_cep__) return resBundle;
        var ext        = this.getExtensions([this.getExtensionID()])[0];
        var bundlePath = ext.basePath + "/LOCALE/";
        var lang       = this.getHostEnvironment().appUILocale;
        var langPrefix = lang.split("_")[0];
        var bundleFile = bundlePath + lang + "/messages.json";
        if (!bundleFile) bundleFile = bundlePath + langPrefix + "/messages.json";
        if (!bundleFile) bundleFile = bundlePath + "en/messages.json";
        resBundle = JSON.parse(window.__adobe_cep__.readFile(bundleFile)) || {};
    } catch (e) {}
    return resBundle;
};

CSInterface.prototype.writeFile = function (path, data, encoding) {
    if (!window.__adobe_cep__) return false;
    encoding = encoding || "UTF-8";
    var result = window.__adobe_cep__.writeFile(path, data, encoding);
    return JSON.parse(result).err === 0;
};

CSInterface.prototype.readFile = function (path, encoding) {
    if (!window.__adobe_cep__) return null;
    encoding = encoding || "UTF-8";
    return window.__adobe_cep__.readFile(path, encoding);
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (!url || !window.__adobe_cep__) return false;
    return window.__adobe_cep__.openURLInDefaultBrowser(url);
};

CSInterface.prototype.getOSInformation = function () {
    var ua = navigator.userAgent;
    if (ua.indexOf("Windows") >= 0) {
        if (ua.indexOf("Windows NT 10") >= 0  || ua.indexOf("Windows NT 11") >= 0) return "Windows 10";
        if (ua.indexOf("Windows NT 6.3") >= 0) return "Windows 8.1";
        if (ua.indexOf("Windows NT 6.2") >= 0) return "Windows 8";
        if (ua.indexOf("Windows NT 6.1") >= 0) return "Windows 7";
        return "Windows";
    }
    if (ua.indexOf("Mac") >= 0) {
        if (ua.indexOf("Mac OS X 14") >= 0) return "macOS Sonoma";
        if (ua.indexOf("Mac OS X 13") >= 0) return "macOS Ventura";
        if (ua.indexOf("Mac OS X 12") >= 0) return "macOS Monterey";
        if (ua.indexOf("Mac OS X 11") >= 0) return "macOS Big Sur";
        if (ua.indexOf("Mac OS X 10_15") >= 0) return "macOS Catalina";
        if (ua.indexOf("Mac OS X 10_14") >= 0) return "macOS Mojave";
        return "Mac OS X";
    }
    return "Unknown OS";
};

// ─── Expose globally ──────────────────────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
    module.exports = CSInterface;
} else {
    window.CSInterface    = CSInterface;
    window.CSEvent        = CSEvent;
    window.SystemPath     = SystemPath;
    window.ColorType      = ColorType;
    window.RGBColor       = RGBColor;
    window.Direction      = Direction;
    window.GradientStop   = GradientStop;
    window.GradientColor  = GradientColor;
    window.UIColor        = UIColor;
    window.AppSkinInfo    = AppSkinInfo;
    window.HostEnvironment  = HostEnvironment;
    window.HostCapabilities = HostCapabilities;
    window.ApiVersion       = ApiVersion;
}
