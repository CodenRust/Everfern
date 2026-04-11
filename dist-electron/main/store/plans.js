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
Object.defineProperty(exports, "__esModule", { value: true });
exports.writePlan = writePlan;
exports.readPlan = readPlan;
exports.listPlans = listPlans;
exports.deletePlan = deletePlan;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const PLAN_BASE = path.join(os.homedir(), '.everfern', 'chat', 'plan');
function planDir(chatId) {
    return path.join(PLAN_BASE, chatId);
}
function ensurePlanDir(chatId) {
    const dir = planDir(chatId);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
/** Write a plan file for a given chat. */
function writePlan(chatId, filename, content) {
    try {
        ensurePlanDir(chatId);
        fs.writeFileSync(path.join(planDir(chatId), filename), content, 'utf-8');
        return { success: true };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
}
/** Read a plan file. Returns null if not found. */
function readPlan(chatId, filename) {
    const p = path.join(planDir(chatId), filename);
    if (!fs.existsSync(p))
        return null;
    try {
        return fs.readFileSync(p, 'utf-8');
    }
    catch {
        return null;
    }
}
/** Check whether any plan files exist for a chat. Returns the list of filenames. */
function listPlans(chatId) {
    const dir = planDir(chatId);
    if (!fs.existsSync(dir))
        return [];
    try {
        return fs.readdirSync(dir).filter(f => !f.startsWith('.') && fs.statSync(path.join(dir, f)).isFile());
    }
    catch {
        return [];
    }
}
/** Delete a single plan file. */
function deletePlan(chatId, filename) {
    try {
        const p = path.join(planDir(chatId), filename);
        if (fs.existsSync(p))
            fs.unlinkSync(p);
        return { success: true };
    }
    catch {
        return { success: false };
    }
}
