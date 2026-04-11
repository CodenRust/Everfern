"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.abortComputerUse = abortComputerUse;
exports.createComputerUseTool = createComputerUseTool;
exports.captureScreen = captureScreen;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const electron_1 = require("electron");
const ai_client_1 = require("../../lib/ai-client");
const sharp_1 = __importDefault(require("sharp"));
// ── Native Automation ────────────────────────────────────────────────────────
let robot = null;
try {
    robot = require('@jitsi/robotjs');
}
catch {
    console.warn('[ComputerUse] robotjs unavailable — falls back to shell');
}
// ── Constants & Configuration ───────────────────────────────────────────────
const DEFAULT_MODEL = "qwen3-vl:235b-instruct-cloud";
const DEFAULT_BASE_URL = "https://ollama.com/v1";
const COMPUTER_USE_TOOL_SPEC = {
    type: "function",
    function: {
        name: "computer_use",
        description: [
            "Use a mouse and keyboard to interact with a computer, and take screenshots.",
            "* This is an interface to a desktop GUI. You do not have access to a terminal or applications menu. You must click on desktop icons to start applications.",
            "* Some applications may take time to start or process actions, so you may need to wait and take successive screenshots to see the results of your actions. E.g. if you click on Firefox and a window doesn't open, try wait and taking another screenshot.",
            "* The screen's resolution is dynamically detected from the host system.",
            "* Whenever you intend to move the cursor to click on an element like an icon, you should consult a screenshot to determine the coordinates of the element before moving the cursor.",
            "* Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element.",
        ].join("\n"),
        parameters: {
            type: "object",
            required: ["action"],
            properties: {
                action: {
                    type: "string",
                    enum: [
                        "key",
                        "press",
                        "type",
                        "mouse_move",
                        "left_click",
                        "left_click_drag",
                        "right_click",
                        "middle_click",
                        "double_click",
                        "triple_click",
                        "scroll",
                        "hscroll",
                        "wait",
                        "terminate",
                        "answer",
                        "zoom",
                    ],
                    description: "The action to perform.",
                },
                keys: {
                    type: "array",
                    items: { type: "string" },
                    description: "Keys used with action=key or action=press.",
                },
                text: {
                    type: "string",
                    description: "Text for action=type or action=answer.",
                },
                clear_first: {
                    type: "boolean",
                    description: "🧼 CRITICAL: Set true to clear input field BEFORE typing. Use this when: (1) field has existing text, (2) URL bar has text, (3) search field has placeholder or previous query. Removes all text with Ctrl+A + Backspace, then types new text.",
                },
                coordinate: {
                    type: "array",
                    items: { type: "number" },
                    description: "Target coordinate [x, y] for mouse actions.",
                },
                pixels: {
                    type: "number",
                    description: "Scroll amount for action=scroll or action=hscroll.",
                },
                time: {
                    type: "number",
                    description: "Seconds to wait for action=wait.",
                },
                zoom_factor: {
                    type: "number",
                    description: "Optional zoom level (e.g. 2, 4) for action=zoom.",
                },
                status: {
                    type: "string",
                    enum: ["success", "failure"],
                    description: "Task status for action=terminate.",
                },
            },
        },
    },
};
const SYSTEM_PROMPT = `You are Fern, an autonomous automation agent with full GUI control.
- Be precise. Inspect screenshots carefully before acting.
- **AVAILABLE APPS**: Review the "CURRENT SYSTEM STATE:" section to see which applications are CURRENTLY OPEN. However, you CAN open any Windows application by searching the Start Menu.
- **FINDING APPS**: If the app you need is not currently open:
  1. Click Windows Start button (bottom-left)
  2. Type the app name
  3. Press Enter to launch it
- **DO NOT ASSUME**: Don't assume an app exists without either seeing it open/in taskbar OR finding it via Start Menu search first.
- **LAYOUT AWARENESS**: Identify logical sections (Sidebar, Search Bar, Header, Main Context).
- **SEARCH FIRST**: If an application has a search function (e.g. Discord's "Find Conversations" or a search icon), USE IT mostly. It is faster and more reliable than scrolling. Use action=type(text="Search Query") and action=press(keys=["enter"]).
- **ZOOM / INSPECTION**: If an icon, sidebar logo, or text (e.g. in a dense sidebar) is too small to recognize, YOU MUST use action=zoom(coordinate=[x, y]) to get a high-resolution close-up of that area. This is critical for differentiating between small icons.
- **SCROLLING**: To scroll a specific list (like the Discord sidebar), YOU MUST specify the coordinate of that list so the mouse hovers over it first. Example: action=scroll(coordinate=[50, 500], pixels=-600).
- **SCROLL DIRECTION**: Use negative pixels (e.g., pixels=-600) to scroll DOWN (towards the bottom). Use positive pixels (e.g., pixels=600) to scroll UP (towards the top).
- **SERVERS vs DMS**: In chat apps, find the Direct Messages icon (usually at the top or a specific icon) to find individual contacts.
- **PREVENT DUPLICATION**: If typing into a field that already has text, set clear_first: true.
- **INPUT FIELD STRATEGY**:
  1. ALWAYS check if an input field has existing text BEFORE typing
  2. If field not focused: First action=left_click(coordinate=[x, y]) to focus the field
  3. If field has existing text: THEN use EITHER:
     a. action=type(text="newtext", clear_first=true) — Recommended for most cases
     b. action=triple_click(coordinate=[x, y]) to select all text, then action=type(text="newtext")
     c. action=key(keys=["control", "a"]) to select all, then action=key(keys=["delete"]), then action=type(text="newtext")
  4. If field is empty: Use action=type(text="newtext") without clear_first
  5. NEVER assume an input field is empty — always inspect the screenshot first
  6. Common fields with existing text: Search bars, URL fields, username/password fields, form inputs
- **KEYS**: Use action=press(keys=["enter"]) to submit forms or send messages.
- Always finish with action=answer and action=terminate(status="success").

**COORDINATE GUIDELINES**:
- Taskbar: Y > 900.
- Search Bars: Often top-center or top-left.
- Contacts/Servers: Left sidebar (X < 250).

**WORKFLOW**:
Observation (Screenshot) -> Check Task Requirements -> Find/Open Needed Apps -> Reasoning -> Action -> Verification.`;
// ── Utilities ──────────────────────────────────────────────────────────────────
function nowTs() {
    const d = new Date();
    return (d.getFullYear().toString() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0") +
        "-" +
        String(d.getHours()).padStart(2, "0") +
        String(d.getMinutes()).padStart(2, "0") +
        String(d.getSeconds()).padStart(2, "0"));
}
function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
function ensureXy(coordinate) {
    if (!coordinate || coordinate.length !== 2) {
        throw new Error("coordinate=[x, y] is required for this action.");
    }
    return [Math.floor(coordinate[0]), Math.floor(coordinate[1])];
}
function maybeInt(value, defaultVal = 0) {
    return value !== undefined && value !== null ? Math.floor(value) : defaultVal;
}
/**
 * Get list of currently open windows and processes (Windows only).
 * Returns a formatted string describing open applications.
 */
function getOpenWindowsInfo() {
    try {
        if (process.platform !== 'win32') {
            return "Running on non-Windows platform. Cannot enumerate windows.";
        }
        // Use PowerShell to get the list of currently open windows
        const output = (0, child_process_1.execSync)(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -ExpandProperty Name | Get-Unique"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        const processes = output
            .split('\n')
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .sort();
        if (processes.length === 0) {
            return "No open windows detected.";
        }
        return `Open applications: ${processes.join(', ')}`;
    }
    catch (error) {
        // Fallback if PowerShell fails
        try {
            const output = (0, child_process_1.execSync)('tasklist', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
            const lines = output.split('\n').slice(3); // Skip header
            const apps = lines
                .map(line => line.split(/\s+/)[0])
                .filter((app, idx, arr) => app && arr.indexOf(app) === idx) // Unique
                .slice(0, 20); // Limit to 20 to avoid clutter
            if (apps.length === 0)
                return "Could not enumerate open applications.";
            return `Open applications: ${apps.join(', ')}`;
        }
        catch {
            return "Could not enumerate open applications.";
        }
    }
}
/**
 * Get common Windows taskbar items (common pinned apps).
 * This helps the agent know which apps are readily available.
 */
function getCommonTaskbarApps() {
    try {
        if (process.platform !== 'win32') {
            return "";
        }
        // Check for commonly pinned Start Menu apps
        const commonApps = [
            'chrome', 'firefox', 'edge',
            'discord', 'slack', 'telegram',
            'vscode', 'notepad', 'explorer',
            'teams', 'outlook', 'word',
            'excel', 'powershell', 'cmd'
        ];
        // Get the taskbar pinned apps from registry (Windows only)
        try {
            const taskbarPath = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Taskband';
            (0, child_process_1.execSync)(`reg query "${taskbarPath}"`, { encoding: 'utf-8', stdio: 'ignore' });
            // If we get here, taskbar was found - common apps are likely available
            return "Common taskbar applications:\n- File Explorer\n- Search / Windows Search\n- Start Menu";
        }
        catch {
            return "";
        }
    }
    catch {
        return "";
    }
}
// ── ToolResult ─────────────────────────────────────────────────────────────────
class ToolResult {
    payload;
    constructor(payload) {
        this.payload = payload;
    }
    asContent() {
        const payload = { ...this.payload };
        const screenshot = payload.screenshot;
        delete payload.screenshot;
        const action = payload._action;
        delete payload._action;
        const detail = payload.detail;
        delete payload.detail;
        const textValue = payload.text;
        delete payload.text;
        const meta = {};
        for (const key of [
            "cursor",
            "display",
            "downscaled_size",
            "screenshot_path",
            "result",
        ]) {
            if (key in payload) {
                meta[key] = payload[key];
                delete payload[key];
            }
        }
        const lines = [];
        if (action)
            lines.push(`action=${action}`);
        const status = payload.status;
        delete payload.status;
        if (status)
            lines.push(`status=${status}`);
        if (detail)
            lines.push(detail);
        if (textValue)
            lines.push(`text: ${textValue}`);
        if (Object.keys(meta).length > 0)
            lines.push(JSON.stringify(meta));
        if (Object.keys(payload).length > 0)
            lines.push(JSON.stringify(payload));
        const content = [];
        if (lines.length > 0) {
            content.push({ type: "text", text: lines.join("\n") });
        }
        if (screenshot) {
            content.push({
                type: "image_url",
                image_url: { url: screenshot, detail: "low" },
            });
        }
        if (content.length === 0) {
            content.push({ type: "text", text: "tool call completed." });
        }
        return content;
    }
    /** Stringified output for standard ToolResult.output */
    toString() {
        const payload = { ...this.payload };
        delete payload.screenshot;
        return JSON.stringify(payload, null, 2);
    }
}
// ── ComputerUseTool ────────────────────────────────────────────────────────────
/**
 * NOTE: This class uses native OS automation via shell commands.
 * On macOS: uses `screencapture`, `cliclick` (install via `brew install cliclick`).
 * On Linux: uses `scrot`, `xdotool` (install via `apt install xdotool scrot`).
 * Windows support is not implemented.
 *
 * For production use, consider integrating `robotjs` or `nut.js` npm packages.
 */
class ComputerUseTool {
    screenshotDir;
    monitorIndex;
    mouseMoveDuration;
    dragDuration;
    imageMinPixels;
    imageMaxPixels;
    imageScaleFactor;
    imageQuality;
    lastViewport = {};
    constructor(screenshotDir, monitorIndex = 1, mouseMoveDuration = 0.0, dragDuration = 0.15, imageMinPixels = 4096, imageMaxPixels = 2_000_000, imageScaleFactor = 32, imageQuality = 60) {
        this.screenshotDir = screenshotDir;
        this.monitorIndex = monitorIndex;
        this.mouseMoveDuration = mouseMoveDuration;
        this.dragDuration = dragDuration;
        this.imageMinPixels = imageMinPixels;
        this.imageMaxPixels = imageMaxPixels;
        this.imageScaleFactor = imageScaleFactor;
        this.imageQuality = imageQuality;
        this.imageMinPixels = Math.max(1024, imageMinPixels);
        this.imageMaxPixels = Math.max(this.imageMinPixels, imageMaxPixels);
        this.imageScaleFactor = Math.max(1, imageScaleFactor);
        this.imageQuality = Math.max(1, Math.min(95, imageQuality));
        fs.mkdirSync(this.screenshotDir, { recursive: true });
        if (robot) {
            robot.setMouseDelay(20);
        }
    }
    async call(params) {
        const { action } = params;
        const handlers = {
            mouse_move: async (p) => this.mouseMove(p),
            left_click: async (p) => this.leftClick(p),
            right_click: async (p) => this.rightClick(p),
            middle_click: async (p) => this.middleClick(p),
            double_click: async (p) => this.doubleClick(p),
            triple_click: async (p) => this.tripleClick(p),
            left_click_drag: async (p) => this.leftClickDrag(p),
            scroll: async (p) => this.scroll(p),
            hscroll: async (p) => this.hscroll(p),
            type: async (p) => this.type(p),
            key: async (p) => this.key(p),
            press: async (p) => this.key(p), // Map 'press' to 'key' for model convenience
            wait: async (p) => this.waitAction(p),
            answer: async (p) => this.answer(p),
            terminate: async (p) => this.terminate(p),
            zoom: async (p) => this.zoom(p),
        };
        const handler = handlers[action];
        if (!handler)
            throw new Error(`Unsupported action: ${action}`);
        const result = await handler(params);
        result._action = action;
        return new ToolResult(result);
    }
    async captureObservation() {
        return await this.attachScreenshot({ status: "observe" });
    }
    // ── Action Handlers ──────────────────────────────────────────────────────────
    async mouseMove(params) {
        const [absX, absY] = this.absoluteXy(params.coordinate);
        console.log(`[Move] Target=(${absX}, ${absY})`);
        this.moveMouse(absX, absY);
        return await this.attachScreenshot({ status: "ok", detail: `Moved to (${absX}, ${absY}).` });
    }
    async leftClick(params) {
        if (params.coordinate) {
            const [absX, absY] = this.absoluteXy(params.coordinate);
            console.log(`[Left Click] Target=(${absX}, ${absY})`);
            this.moveMouse(absX, absY);
            this.click(absX, absY, "left");
            return await this.attachScreenshot({ status: "ok", detail: `Left click at (${absX}, ${absY}).` });
        }
        this.click(undefined, undefined, "left");
        return await this.attachScreenshot({ status: "ok", detail: "Left click at current cursor." });
    }
    async rightClick(params) {
        if (params.coordinate) {
            const [absX, absY] = this.absoluteXy(params.coordinate);
            this.click(absX, absY, "right");
            return await this.attachScreenshot({ status: "ok", detail: `Right click at (${absX}, ${absY}).` });
        }
        this.click(undefined, undefined, "right");
        return await this.attachScreenshot({ status: "ok", detail: "Right click at current cursor." });
    }
    async middleClick(params) {
        if (params.coordinate) {
            const [absX, absY] = this.absoluteXy(params.coordinate);
            this.click(absX, absY, "middle");
            return await this.attachScreenshot({ status: "ok", detail: `Middle click at (${absX}, ${absY}).` });
        }
        this.click(undefined, undefined, "middle");
        return await this.attachScreenshot({ status: "ok", detail: "Middle click at current cursor." });
    }
    async doubleClick(params) {
        const [absX, absY] = this.absoluteXy(params.coordinate);
        this.doubleClickAt(absX, absY);
        return await this.attachScreenshot({ status: "ok", detail: `Double click at (${absX}, ${absY}).` });
    }
    async tripleClick(params) {
        const [absX, absY] = this.absoluteXy(params.coordinate);
        this.tripleClickAt(absX, absY);
        return await this.attachScreenshot({ status: "ok", detail: `Triple click at (${absX}, ${absY}).` });
    }
    async leftClickDrag(params) {
        const [absX, absY] = this.absoluteXy(params.coordinate);
        this.drag(absX, absY);
        return await this.attachScreenshot({ status: "ok", detail: `Drag to (${absX}, ${absY}).` });
    }
    async scroll(params) {
        if (params.coordinate) {
            const [absX, absY] = this.absoluteXy(params.coordinate);
            this.moveMouse(absX, absY);
            console.log(`[Sub-Agent] 🛰️ Moving mouse to (${absX}, ${absY}) before scroll.`);
        }
        const pixels = maybeInt(params.pixels);
        this.scrollVertical(pixels);
        return await this.attachScreenshot({ status: "ok", detail: `Scroll ${pixels} vertically at ${params.coordinate ? JSON.stringify(params.coordinate) : 'current position'}.` });
    }
    async hscroll(params) {
        if (params.coordinate) {
            const [absX, absY] = this.absoluteXy(params.coordinate);
            this.moveMouse(absX, absY);
            console.log(`[Sub-Agent] 🛰️ Moving mouse to (${absX}, ${absY}) before hscroll.`);
        }
        const pixels = maybeInt(params.pixels);
        this.scrollHorizontal(pixels);
        return await this.attachScreenshot({ status: "ok", detail: `Scroll ${pixels} horizontally at ${params.coordinate ? JSON.stringify(params.coordinate) : 'current position'}.` });
    }
    async type(params) {
        if (params.text === undefined || params.text === null) {
            throw new Error("text is required for action=type.");
        }
        if (params.clear_first) {
            console.log(`[Sub-Agent] 🧼 Clearing field before typing...`);
            this.pressKeys(['control', 'a']);
            this.pressKeys(['backspace']);
        }
        this.typeText(params.text);
        return await this.attachScreenshot({
            status: "ok",
            detail: `Typed "${params.text.substring(0, 50)}".`,
        });
    }
    async key(params) {
        const keys = params.keys || [];
        if (keys.length === 0)
            throw new Error("keys is required for action=key.");
        this.pressKeys(keys);
        return await this.attachScreenshot({ status: "ok", detail: `Pressed keys ${JSON.stringify(keys)}.` });
    }
    async waitAction(params) {
        if (params.time === undefined || params.time === null) {
            throw new Error("time is required for action=wait.");
        }
        await sleep(params.time);
        return { status: "ok", detail: `Waited ${params.time} seconds.` };
    }
    async answer(params) {
        return { status: "answer", text: params.text || "" };
    }
    async terminate(params) {
        if (params.status !== "success" && params.status !== "failure") {
            throw new Error("status must be success or failure for action=terminate.");
        }
        return { status: "terminate", result: params.status };
    }
    async zoom(params) {
        if (!params.coordinate) {
            throw new Error("coordinate is required for action=zoom.");
        }
        const [absX, absY] = this.absoluteXy(params.coordinate);
        console.log(`[Sub-Agent] 🔍 Zooming in at (${absX}, ${absY})...`);
        const ts = nowTs();
        const imgPath = path.join(this.screenshotDir, `${ts}-zoom.png`);
        await this.captureScreen(imgPath);
        // Read raw dimensions
        const rawBuffer = fs.readFileSync(imgPath);
        const { width: rawW, height: rawH } = this.getPngDimensions(rawBuffer);
        // Define a 400x400 physical crop box centered at the target
        const boxSize = 250; // 500x500 box for detailed view
        const left = Math.max(0, absX - boxSize);
        const top = Math.max(0, absY - boxSize);
        const width = Math.min(boxSize * 2, rawW - left);
        const height = Math.min(boxSize * 2, rawH - top);
        // Crop and convert to base64
        let encoded = "";
        try {
            const croppedBuffer = await (0, sharp_1.default)(rawBuffer)
                .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
                .jpeg({ quality: 85 }) // High quality for zoom
                .toBuffer();
            encoded = croppedBuffer.toString("base64");
        }
        catch (err) {
            console.warn('[ComputerUse] zoom crop failed', err);
            encoded = rawBuffer.toString("base64");
        }
        return {
            status: "ok",
            detail: `Zoomed in at (${absX}, ${absY}) with 500x500 crop.`,
            screenshot: `data:image/jpeg;base64,${encoded}`,
            screenshot_path: imgPath,
            cursor: { x: absX, y: absY },
            display: { width: rawW, height: rawH },
            downscaled_size: { width: Math.round(width), height: Math.round(height) },
        };
    }
    // ── OS Automation (shell-based) ──────────────────────────────────────────────
    moveMouse(x, y) {
        if (robot) {
            robot.moveMouse(x, y);
        }
        else if (process.platform === "darwin") {
            (0, child_process_1.execSync)(`cliclick m:${x},${y}`);
        }
        else {
            (0, child_process_1.execSync)(`xdotool mousemove ${x} ${y}`);
        }
    }
    click(x, y, button = "left") {
        if (robot) {
            if (x !== undefined && y !== undefined) {
                robot.moveMouse(x, y);
            }
            // Use mouseDown/Up for better reliability on Windows, matching qwen-computer.py
            robot.mouseToggle("down", button);
            // Small blocking delay (50ms) to ensure the OS registers the click
            const start = Date.now();
            while (Date.now() - start < 50) { /* sync wait */ }
            robot.mouseToggle("up", button);
        }
        else {
            const buttonMap = { left: 1, middle: 2, right: 3 };
            const btn = buttonMap[button];
            if (process.platform === "darwin") {
                const coord = x !== undefined ? `${x},${y}` : "";
                const flag = button === "right" ? "rc" : button === "middle" ? "mc" : "c";
                (0, child_process_1.execSync)(`cliclick ${flag}:${coord}`);
            }
            else {
                if (x !== undefined)
                    (0, child_process_1.execSync)(`xdotool mousemove ${x} ${y}`);
                (0, child_process_1.execSync)(`xdotool click ${btn}`);
            }
        }
    }
    doubleClickAt(x, y) {
        if (robot) {
            robot.moveMouse(x, y);
            robot.mouseClick("left", true);
        }
        else {
            if (process.platform === "darwin") {
                (0, child_process_1.execSync)(`cliclick dc:${x},${y}`);
            }
            else {
                (0, child_process_1.execSync)(`xdotool mousemove ${x} ${y} click --repeat 2 1`);
            }
        }
    }
    tripleClickAt(x, y) {
        if (robot) {
            robot.moveMouse(x, y);
            robot.mouseClick("left");
            robot.mouseClick("left");
            robot.mouseClick("left");
        }
        else {
            if (process.platform === "darwin") {
                (0, child_process_1.execSync)(`cliclick tc:${x},${y}`);
            }
            else {
                (0, child_process_1.execSync)(`xdotool mousemove ${x} ${y} click --repeat 3 1`);
            }
        }
    }
    drag(toX, toY) {
        if (robot) {
            robot.dragMouse(toX, toY);
        }
        else if (process.platform === "darwin") {
            (0, child_process_1.execSync)(`cliclick dd:. du:${toX},${toY}`);
        }
        else {
            (0, child_process_1.execSync)(`xdotool mousedown 1 mousemove --sync ${toX} ${toY} mouseup 1`);
        }
    }
    scrollVertical(pixels) {
        if (robot) {
            // pixels > 0 is scroll up, but robotjs might take different units
            const amount = Math.round(pixels / 100) || (pixels > 0 ? 1 : -1);
            robot.scrollMouse(0, amount);
        }
        else {
            const direction = pixels > 0 ? "up" : "down";
            if (process.platform === "darwin") {
                (0, child_process_1.execSync)(`cliclick ${direction === "up" ? "ku" : "kd"}:. ${Math.abs(pixels)}`);
            }
            else {
                (0, child_process_1.execSync)(`xdotool click ${direction === "up" ? 4 : 5}`);
            }
        }
    }
    scrollHorizontal(pixels) {
        if (robot) {
            const amount = Math.round(pixels / 100) || (pixels > 0 ? 1 : -1);
            robot.scrollMouse(amount, 0);
        }
        else if (process.platform === "darwin") {
            const dir = pixels > 0 ? "right" : "left";
            (0, child_process_1.execSync)(`osascript -e 'tell application "System Events" to key code ${dir === "right" ? 124 : 123}'`);
        }
        else {
            (0, child_process_1.execSync)(`xdotool click ${pixels > 0 ? 6 : 7}`);
        }
    }
    typeText(text) {
        if (robot) {
            robot.typeString(text);
        }
        else if (process.platform === "darwin") {
            // Escape single quotes for shell safety
            const escaped = text.replace(/'/g, "'\\''");
            (0, child_process_1.execSync)(`osascript -e 'tell application "System Events" to keystroke "${escaped}"'`);
        }
        else {
            (0, child_process_1.execSync)(`xdotool type --clearmodifiers -- ${JSON.stringify(text)}`);
        }
    }
    pressKeys(keys) {
        if (robot) {
            // Convert standard key names to robotjs format
            const KEY_MAP = {
                Control_L: 'control', Control_R: 'control', control: 'control',
                Alt_L: 'alt', Alt_R: 'alt', alt: 'alt',
                Shift_L: 'shift', Shift_R: 'shift', shift: 'shift',
                Super_L: 'command', Super_R: 'command', command: 'command', win: 'command',
                Return: 'enter', enter: 'enter',
                Escape: 'escape', esc: 'escape',
                Tab: 'tab',
                Delete: 'delete', delete: 'delete', del: 'delete',
                BackSpace: 'backspace', backspace: 'backspace',
                space: 'space',
                Up: 'up', up: 'up',
                Down: 'down', down: 'down',
                Left: 'left', left: 'left',
                Right: 'right', right: 'right',
                Home: 'home', End: 'end',
                PageUp: 'pageup', PageDown: 'pagedown'
            };
            const parts = keys.map(k => {
                const mapped = KEY_MAP[k] || KEY_MAP[k.toLowerCase()] || k.toLowerCase();
                return mapped;
            });
            if (parts.length === 1) {
                robot.keyTap(parts[0]);
            }
            else {
                const key = parts[parts.length - 1];
                const mods = parts.slice(0, -1);
                robot.keyTap(key, mods);
            }
        }
        else if (process.platform === "darwin") {
            const combo = keys.join("+");
            (0, child_process_1.execSync)(`cliclick kp:${combo}`);
        }
        else {
            const combo = keys.join("+");
            (0, child_process_1.execSync)(`xdotool key ${combo}`);
        }
    }
    // ── Screenshot & Image ───────────────────────────────────────────────────────
    async attachScreenshot(payload) {
        const ts = nowTs();
        const imgPath = path.join(this.screenshotDir, `${ts}.png`);
        await this.captureScreen(imgPath);
        // Read raw image dimensions
        const imgBuffer = fs.readFileSync(imgPath);
        const { width: rawW, height: rawH } = this.getPngDimensions(imgBuffer);
        const { newW, newH } = this.computeResizeDims(rawW, rawH);
        // Re-encode as JPEG at target size using sharp
        let encoded = "";
        try {
            const jpegBuffer = await (0, sharp_1.default)(imgBuffer)
                .resize(newW, newH, { fit: 'fill' })
                .jpeg({ quality: this.imageQuality })
                .toBuffer();
            encoded = jpegBuffer.toString("base64");
        }
        catch (err) {
            console.warn('[ComputerUse] sharp resize failed — using raw image as fallback', err);
            encoded = imgBuffer.toString("base64");
        }
        const cursorPos = this.getCursorPosition();
        const displays = electron_1.screen.getAllDisplays();
        const display = displays[this.monitorIndex - 1] || electron_1.screen.getPrimaryDisplay();
        const scaleFactor = display.scaleFactor || 1.0;
        const logicalSize = { width: display.bounds.width, height: display.bounds.height };
        const physicalSize = {
            width: Math.round(logicalSize.width * scaleFactor),
            height: Math.round(logicalSize.height * scaleFactor)
        };
        // Sometimes robot/OS can disagree on logical vs physical. We explicitly prefer the raw captured image's dimensions.
        const effectiveDisplaySize = {
            width: rawW || physicalSize.width || 1920,
            height: rawH || physicalSize.height || 1080
        };
        console.log(`[Screenshot] ${imgPath} cursor=(${cursorPos.x}, ${cursorPos.y}) monitor=${this.monitorIndex} offset=(${display.bounds.x}, ${display.bounds.y})`);
        console.log(`[Resolution] Logical=${logicalSize.width}x${logicalSize.height}, Physical=${effectiveDisplaySize.width}x${effectiveDisplaySize.height}, ScaleFactor=${scaleFactor}`);
        const updated = {
            ...payload,
            screenshot: `data:image/jpeg;base64,${encoded}`,
            screenshot_path: imgPath,
            cursor: cursorPos,
            display: effectiveDisplaySize,
            downscaled_size: { width: newW, height: newH },
        };
        this.lastViewport = {
            monitor_left: display.bounds.x,
            monitor_top: display.bounds.y,
            display_width: effectiveDisplaySize.width,
            display_height: effectiveDisplaySize.height,
            image_width: newW,
            image_height: newH,
            raw_width: rawW,
            raw_height: rawH,
        };
        return updated;
    }
    async captureScreen(outPath) {
        const screenshot = require('screenshot-desktop');
        try {
            const displays = await screenshot.listDisplays();
            const display = displays[this.monitorIndex - 1] || displays[0];
            await screenshot({ filename: outPath, screen: display.id });
        }
        catch (err) {
            console.error('[ComputerUse] Native screenshot failed, trying fallback', err);
            if (process.platform === 'darwin') {
                (0, child_process_1.execSync)(`screencapture -x "${outPath}"`);
            }
            else if (process.platform === 'win32') {
                throw new Error('Native Windows screenshot failed and no fallback available.');
            }
            else {
                (0, child_process_1.execSync)(`scrot "${outPath}"`);
            }
        }
    }
    getCursorPosition() {
        if (robot)
            return robot.getMousePos();
        return { x: 0, y: 0 };
    }
    getDisplaySize() {
        try {
            const display = electron_1.screen.getPrimaryDisplay();
            return { width: display.bounds.width, height: display.bounds.height };
        }
        catch {
            return { width: 1920, height: 1080 };
        }
    }
    /** Read PNG width/height from file header (bytes 16-23). */
    getPngDimensions(buf) {
        if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") {
            return { width: 1920, height: 1080 };
        }
        return {
            width: buf.readUInt32BE(16),
            height: buf.readUInt32BE(20),
        };
    }
    computeResizeDims(width, height) {
        const area = width * height;
        if (area === 0)
            return { newW: width, newH: height };
        const clampedArea = Math.min(Math.max(area, this.imageMinPixels), this.imageMaxPixels);
        const scale = Math.sqrt(clampedArea / area);
        const roundSize = (v) => Math.max(this.imageScaleFactor, Math.floor(Math.max(1, v) / this.imageScaleFactor) *
            this.imageScaleFactor);
        let newW = roundSize(width * scale);
        let newH = roundSize(height * scale);
        const newArea = Math.max(1, newW * newH);
        if (newArea > this.imageMaxPixels) {
            const shrink = Math.sqrt(this.imageMaxPixels / newArea);
            newW = roundSize(newW * shrink);
            newH = roundSize(newH * shrink);
        }
        return { newW, newH };
    }
    // ── Coordinate Transform ─────────────────────────────────────────────────────
    absoluteXy(coordinate) {
        const [x, y] = ensureXy(coordinate);
        const vp = this.lastViewport;
        const left = vp.monitor_left ?? 0;
        const top = vp.monitor_top ?? 0;
        const displayW = vp.display_width ?? 0;
        const displayH = vp.display_height ?? 0;
        const imageW = vp.image_width;
        const imageH = vp.image_height;
        if (displayW && displayH) {
            if (x <= 1000 && y <= 1000) {
                const normX = Math.max(0, Math.min(1, x / 1000));
                const normY = Math.max(0, Math.min(1, y / 1000));
                // Map to physical display resolution for accuracy
                let absX = left + Math.floor(normX * displayW);
                let absY = top + Math.floor(normY * displayH);
                // Optional: If robotjs is configured for logical only, we would divide by scaleFactor here.
                // But Qwen-VL reference and common usage with robotjs on Windows often prefers direct pixel alignment.
                console.log(`[Coordinate Transform] relative input=(${x}, ${y}) physical_target=(${displayW}x${displayH}) → abs=(${absX}, ${absY})`);
                return [absX, absY];
            }
            if (imageW && imageH) {
                const scaleX = displayW / imageW;
                const scaleY = displayH / imageH;
                const absX = left + Math.round(x * scaleX);
                const absY = top + Math.round(y * scaleY);
                console.log(`[Coordinate Transform] pixel input=(${x}, ${y}) image_size=(${imageW}x${imageH}) scale=(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)}) → abs=(${absX}, ${absY})`);
                return [absX, absY];
            }
        }
        console.log(`[Coordinate Transform] No viewport/scale, using offset only: (${left + x}, ${top + y})`);
        return [left + x, top + y];
    }
}
// ── ComputerUseAgent (Sub-Agent Loop) ─────────────────────────────────────────
class ComputerUseAgent {
    client;
    tool;
    model;
    task;
    temperature;
    maxTurns;
    historyWindow;
    messages = [];
    baseCount;
    finalAnswer = null;
    terminated = null;
    lastScreenshot;
    aborted = false;
    constructor(client, tool, model, task, temperature = 0, maxTurns = 40, historyWindow = 12) {
        this.client = client;
        this.tool = tool;
        this.model = model;
        this.task = task;
        this.temperature = temperature;
        this.maxTurns = maxTurns;
        this.historyWindow = historyWindow;
        this.historyWindow = Math.max(1, historyWindow);
        this.messages = [{ role: "system", content: SYSTEM_PROMPT }];
        this.baseCount = this.messages.length;
    }
    abort() {
        this.aborted = true;
        this.terminated = "aborted";
        console.log(`[Sub-Agent] 🛑 Received external abort signal.`);
    }
    async run(onUpdate) {
        if (this.messages.length === 1) {
            await this.appendInitialObservation();
            this.baseCount = this.messages.length;
        }
        console.log(`\n[Sub-Agent] 🚀 VLM PROOF: Using Model="${this.model}" via Provider="${this.client.provider}"`);
        console.log(`[Sub-Agent] 📡 Base URL: ${JSON.stringify(this.client.config?.baseUrl || "builtin")}`);
        for (let step = 1; step <= this.maxTurns; step++) {
            if (this.aborted)
                break;
            console.log(`\n[Sub-Agent] 👁️  Step ${step}/${this.maxTurns}`);
            onUpdate?.(`Sub-Agent Turn ${step}/${this.maxTurns}...`);
            const response = await this.client.chat({
                messages: this.messages,
                model: this.model,
                temperature: this.temperature,
                tools: [COMPUTER_USE_TOOL_SPEC],
            });
            if (this.aborted)
                break;
            const content = typeof response.content === "string" ? response.content : "";
            if (content) {
                console.log(`[Sub-Agent] 🧠 Reasoning: ${content}`);
            }
            this.messages.push({
                role: "assistant",
                content: response.content || "",
                tool_calls: response.toolCalls,
            });
            let toolCalls = response.toolCalls || [];
            // FALLBACK: If no formal tool calls, try parsing the text content for action=... format
            if (toolCalls.length === 0 && content) {
                const parsed = this.parseTextActions(content);
                if (parsed.length > 0) {
                    console.log(`[Sub-Agent] 🧩 Parsed ${parsed.length} text-based actions from reasoning.`);
                    toolCalls = parsed;
                }
            }
            if (toolCalls.length === 0) {
                // If still no actions, provide a system reminder
                console.warn(`[Sub-Agent] ⚠️ No actions detected. Adding system reminder...`);
                this.messages.push({
                    role: "system",
                    content: "You provided reasoning but no tool call. You MUST use the action=... format to perform an action (e.g. action=left_click(coordinate=[x, y])). Just thinking about it won't work."
                });
                continue;
            }
            for (const toolCall of toolCalls) {
                let args;
                try {
                    args = typeof toolCall.arguments === "string" ? JSON.parse(toolCall.arguments) : toolCall.arguments;
                }
                catch (e) {
                    console.warn("[Sub-Agent] Failed to parse tool arguments", toolCall.arguments);
                    continue;
                }
                onUpdate?.(`Sub-Agent executing ${args.action}...`);
                console.log(`[Sub-Agent] ▶ Executing: ${args.action} ${JSON.stringify(args)}`);
                const result = await this.tool.call(args);
                const payload = result.payload;
                if (payload.status === "answer") {
                    this.finalAnswer = payload.text || "Task finished.";
                }
                if (payload.status === "terminate") {
                    this.terminated = payload.result || "success";
                }
                if (payload.screenshot) {
                    this.lastScreenshot = payload.screenshot;
                }
                this.messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result.asContent(),
                });
            }
            this.trimMessages();
            if (this.terminated || this.finalAnswer)
                break;
        }
        return {
            finalAnswer: this.finalAnswer || "Sub-agent task completed.",
            lastScreenshot: this.lastScreenshot,
        };
    }
    /**
     * Parses text-based actions like action=left_click(coordinate=[398, 965])
     * which some Vision models prefer over formal JSON function calling.
     */
    parseTextActions(text) {
        const actions = [];
        // Looking for patterns like action=left_click(coordinate=[398, 965]) or action=click(x=1, y=2)
        const actionRegex = /action=([a-z_]+)\((.*?)\)/g;
        let match;
        while ((match = actionRegex.exec(text)) !== null) {
            const actionType = match[1];
            const argsText = match[2];
            const args = { action: actionType };
            // Map 'click' to 'left_click' for compatibility
            if (actionType === 'click')
                args.action = 'left_click';
            // Parse coordinates: x=N, y=N or coordinate=[N, N]
            const coordMatch = argsText.match(/coordinate\s*=\s*\[(\d+),\s*(\d+)\]/);
            if (coordMatch) {
                args.coordinate = [parseInt(coordMatch[1]), parseInt(coordMatch[2])];
            }
            else {
                const xMatch = argsText.match(/x\s*=\s*(\d+)/);
                const yMatch = argsText.match(/y\s*=\s*(\d+)/);
                if (xMatch && yMatch) {
                    args.coordinate = [parseInt(xMatch[1]), parseInt(yMatch[2])];
                }
            }
            // Parse text: text="XYZ"
            const textMatch = argsText.match(/text\s*=\s*"([^"]*)"/);
            if (textMatch)
                args.text = textMatch[1];
            // Parse keys: keys=["enter"] or key="enter"
            const keysMatch = argsText.match(/keys\s*=\s*\[([^\]]*)\]/);
            const keyMatch = argsText.match(/key\s*=\s*"([^"]*)"/);
            if (keysMatch) {
                args.keys = keysMatch[1].split(',').map(k => k.trim().replace(/"/g, ''));
            }
            else if (keyMatch) {
                args.keys = [keyMatch[1]];
            }
            // Parse time: time=N
            const timeMatch = argsText.match(/time\s*=\s*(\d+)/);
            if (timeMatch)
                args.time = parseInt(timeMatch[1]);
            // Parse pixels: pixels=N or pixels=-N
            const pixelsMatch = argsText.match(/pixels\s*=\s*(-?\d+)/);
            if (pixelsMatch)
                args.pixels = parseInt(pixelsMatch[1]);
            // Parse zoom: zoom_factor=N
            const zoomMatch = argsText.match(/zoom_factor\s*=\s*(\d+)/);
            if (zoomMatch)
                args.zoom_factor = parseInt(zoomMatch[1]);
            // Parse status: status="success" or status="failure"
            const statusMatch = argsText.match(/status\s*=\s*"(success|failure)"/);
            if (statusMatch)
                args.status = statusMatch[1];
            actions.push({
                id: `parsed-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: "computer_use",
                arguments: args
            });
        }
        return actions;
    }
    async appendInitialObservation() {
        const observation = await this.tool.captureObservation();
        const screenshot = observation.screenshot;
        const content = [];
        if (screenshot) {
            content.push({
                type: "image_url",
                image_url: { url: screenshot, detail: "low" },
            });
        }
        // Build context with task, open windows, and available apps
        const openAppsInfo = getOpenWindowsInfo();
        const taskbarInfo = getCommonTaskbarApps();
        const contextText = [
            `TASK: ${this.task}`,
            "",
            "CURRENTLY OPEN APPLICATIONS:",
            openAppsInfo,
            taskbarInfo || "(Standard Windows taskbar apps available)",
            "",
            "NOTE: If the app you need is not listed above, you can search for it in the Windows Start Menu:",
            "1. Click the Windows Start button (bottom-left corner)",
            "2. Type the app name (e.g., 'Discord', 'Firefox', 'Slack')",
            "3. Press Enter to launch it"
        ].filter(line => line || line === "").join("\n");
        content.push({ type: "text", text: contextText });
        this.messages.push({ role: "user", content });
    }
    trimMessages() {
        const base = this.messages.slice(0, this.baseCount);
        const dynamic = this.messages.slice(this.baseCount);
        const maxItems = this.historyWindow * 2;
        if (dynamic.length <= maxItems)
            return;
        this.messages = [...base, ...dynamic.slice(-maxItems)];
    }
}
// ── EverFern Integration Factory (Sub-Agent Mode) ───────────────────────────
let activeAgentInstance = null;
/**
 * Global abort function called from Electron main process.
 */
function abortComputerUse() {
    if (activeAgentInstance) {
        activeAgentInstance.abort();
        activeAgentInstance = null;
    }
}
function createComputerUseTool(originalClient, _platform = process.platform, _visionModel, _showuiUrl, _ollamaBaseUrl, _checkPermission, _requestPermission, vlm) {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const screenshotDir = path.join(home, ".everfern", "screenshots");
    const tool = new ComputerUseTool(screenshotDir);
    // Use either the provided VLM config or fall back to original client
    const subAgentClient = vlm ? new ai_client_1.AIClient({
        provider: vlm.provider || 'openai',
        apiKey: vlm.apiKey,
        baseUrl: vlm.baseUrl,
        model: vlm.model
    }) : originalClient;
    const subAgentModel = vlm?.model || "qwen3-vl:235b-instruct-cloud";
    return {
        name: "computer_use",
        description: "Launch an autonomous sub-agent to perform GUI tasks natively. Powered by Ollama Cloud (Qwen-VL).",
        parameters: {
            type: "object",
            properties: {
                task: {
                    type: "string",
                    description: "High-level goal for the sub-agent (e.g. 'Open Spotify and play Blinding Lights')"
                }
            },
            required: ["task"]
        },
        async execute(args, onUpdate) {
            const task = args.task || "Perform a visual audit of the current desktop.";
            onUpdate?.(`Initializing sub-agent for task: "${task}"...`);
            const agent = new ComputerUseAgent(subAgentClient, tool, subAgentModel, task);
            activeAgentInstance = agent;
            try {
                const { finalAnswer, lastScreenshot } = await agent.run((update) => onUpdate?.(update));
                const b64 = lastScreenshot?.split(',')[1];
                return {
                    success: true,
                    output: finalAnswer,
                    base64Image: b64,
                    data: { task, finalAnswer: finalAnswer }
                };
            }
            finally {
                if (activeAgentInstance === agent) {
                    activeAgentInstance = null;
                }
            }
        },
        abort() {
            activeAgentInstance?.abort();
            activeAgentInstance = null;
        }
    };
}
/**
 * Capture the current screen for the runner's initial observation.
 */
async function captureScreen() {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const tool = new ComputerUseTool(path.join(home, ".everfern", "screenshots"));
    const obs = await tool.captureObservation();
    const b64 = obs.screenshot.split(',')[1];
    const w = obs.display.width;
    const h = obs.display.height;
    return { b64, w, h, physW: w, physH: h };
}
