"use strict";
/**
 * EverFern Desktop — File Type Detector
 *
 * Automatically detects data file formats and suggests appropriate parsers.
 * Supports CSV, Excel, JSON, and Parquet files.
 */
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
exports.DefaultFileTypeDetector = void 0;
exports.createFileTypeDetector = createFileTypeDetector;
exports.detectFileType = detectFileType;
exports.getParserConfig = getParserConfig;
exports.getEnhancedParserConfig = getEnhancedParserConfig;
exports.getFallbackParsers = getFallbackParsers;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Magic number signatures for file type detection
 */
const MAGIC_NUMBERS = {
    // Excel formats
    excel_xlsx: { signature: Buffer.from([0x50, 0x4B, 0x03, 0x04]), offset: 0 }, // ZIP signature (XLSX)
    excel_xls: { signature: Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), offset: 0 }, // OLE2 signature (XLS)
    // Parquet format
    parquet: { signature: Buffer.from('PAR1', 'ascii'), offset: 0 },
};
/**
 * Extension to file type mapping
 */
const EXTENSION_MAP = {
    '.csv': 'csv',
    '.tsv': 'csv',
    '.txt': 'csv',
    '.xlsx': 'excel',
    '.xls': 'excel',
    '.xlsm': 'excel',
    '.xlsb': 'excel',
    '.json': 'json',
    '.jsonl': 'json',
    '.ndjson': 'json',
    '.parquet': 'parquet',
    '.pq': 'parquet',
};
/**
 * Default parser configurations for each file type
 */
const PARSER_CONFIGS = {
    csv: {
        library: 'pandas',
        method: 'read_csv',
        options: {
            encoding: 'utf-8',
            encoding_errors: 'replace',
            on_bad_lines: 'warn',
            low_memory: false,
            engine: 'python',
            sep: ',', // Default separator, can be auto-detected
            quotechar: '"',
            escapechar: null,
            comment: null,
            skipinitialspace: true,
            thousands: null,
            decimal: '.',
        },
    },
    excel: {
        library: 'pandas',
        method: 'read_excel',
        options: {
            sheet_name: 0, // First sheet by default
            engine: 'openpyxl',
            header: 0,
            names: null,
            index_col: null,
            usecols: null,
            dtype: null,
            na_values: null,
            keep_default_na: true,
        },
    },
    json: {
        library: 'pandas',
        method: 'read_json',
        options: {
            orient: 'records',
            lines: false,
            typ: 'frame',
            dtype: null,
            convert_axes: null,
            convert_dates: true,
            keep_default_dates: true,
            precise_float: false,
            encoding: 'utf-8',
        },
    },
    parquet: {
        library: 'pandas',
        method: 'read_parquet',
        options: {
            engine: 'pyarrow',
            columns: null,
            use_nullable_dtypes: false,
        },
    },
    unknown: {
        library: 'custom',
        method: 'detect_and_parse',
        options: {},
    },
};
/**
 * Implementation of FileTypeDetector
 */
class DefaultFileTypeDetector {
    /**
     * Detect file type using extension and content-based detection
     */
    async detectFileType(filePath) {
        // Step 1: Try extension-based detection
        const extensionType = this.detectByExtension(filePath);
        if (extensionType !== 'unknown') {
            return extensionType;
        }
        // Step 2: Try content-based detection using magic numbers
        try {
            const contentType = await this.detectByContent(filePath);
            if (contentType !== 'unknown') {
                return contentType;
            }
        }
        catch (error) {
            // If file doesn't exist or can't be read, fall through to unknown
            console.warn(`[FileTypeDetector] Content detection failed for ${filePath}:`, error);
        }
        // Step 3: Try heuristic detection for text-based formats
        try {
            const heuristicType = await this.detectByHeuristics(filePath);
            if (heuristicType !== 'unknown') {
                return heuristicType;
            }
        }
        catch (error) {
            console.warn(`[FileTypeDetector] Heuristic detection failed for ${filePath}:`, error);
        }
        return 'unknown';
    }
    /**
     * Suggest parser configuration for a given file type
     */
    suggestParser(fileType) {
        return PARSER_CONFIGS[fileType] || PARSER_CONFIGS.unknown;
    }
    /**
     * Suggest parser configuration with enhanced options based on file analysis
     */
    async suggestParserWithOptions(filePath, fileType) {
        const baseConfig = this.suggestParser(fileType);
        // Enhance configuration based on file type
        switch (fileType) {
            case 'csv':
                return await this.enhanceCSVConfig(filePath, baseConfig);
            case 'excel':
                return await this.enhanceExcelConfig(filePath, baseConfig);
            case 'json':
                return await this.enhanceJSONConfig(filePath, baseConfig);
            default:
                return baseConfig;
        }
    }
    /**
     * Enhance CSV parser configuration with encoding and delimiter detection
     */
    async enhanceCSVConfig(filePath, baseConfig) {
        const config = { ...baseConfig, options: { ...baseConfig.options } };
        try {
            // Detect encoding
            const encoding = await this.detectEncoding(filePath);
            if (encoding) {
                config.options.encoding = encoding;
            }
            // Detect delimiter
            const delimiter = await this.detectDelimiter(filePath);
            if (delimiter) {
                config.options.sep = delimiter;
            }
        }
        catch (error) {
            console.warn(`[FileTypeDetector] CSV enhancement failed for ${filePath}:`, error);
        }
        return config;
    }
    /**
     * Enhance Excel parser configuration with sheet detection
     */
    async enhanceExcelConfig(filePath, baseConfig) {
        const config = { ...baseConfig, options: { ...baseConfig.options } };
        try {
            // Note: Sheet detection requires openpyxl/xlrd, which would need Python execution
            // For now, we keep the default (first sheet) but document the capability
            // In a full implementation, this would call Python to list available sheets
            config.options.sheet_name = 0; // Default to first sheet
        }
        catch (error) {
            console.warn(`[FileTypeDetector] Excel enhancement failed for ${filePath}:`, error);
        }
        return config;
    }
    /**
     * Enhance JSON parser configuration with format detection
     */
    async enhanceJSONConfig(filePath, baseConfig) {
        const config = { ...baseConfig, options: { ...baseConfig.options } };
        try {
            // Detect if JSON is line-delimited (JSONL/NDJSON)
            const isLineDelimited = await this.detectLineDelimitedJSON(filePath);
            if (isLineDelimited) {
                config.options.lines = true;
                config.options.orient = 'records';
            }
        }
        catch (error) {
            console.warn(`[FileTypeDetector] JSON enhancement failed for ${filePath}:`, error);
        }
        return config;
    }
    /**
     * Detect file encoding by analyzing byte patterns
     */
    async detectEncoding(filePath) {
        const buffer = Buffer.alloc(4096);
        const fd = await fs.promises.open(filePath, 'r');
        try {
            await fd.read(buffer, 0, 4096, 0);
            // Check for BOM (Byte Order Mark)
            if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                return 'utf-8-sig'; // UTF-8 with BOM
            }
            if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
                return 'utf-16-le'; // UTF-16 Little Endian
            }
            if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
                return 'utf-16-be'; // UTF-16 Big Endian
            }
            // Default to UTF-8 for text files
            return 'utf-8';
        }
        finally {
            await fd.close();
        }
    }
    /**
     * Detect CSV delimiter by analyzing first few lines
     */
    async detectDelimiter(filePath) {
        const buffer = Buffer.alloc(4096);
        const fd = await fs.promises.open(filePath, 'r');
        try {
            const { bytesRead } = await fd.read(buffer, 0, 4096, 0);
            const content = buffer.slice(0, bytesRead).toString('utf-8');
            const lines = content.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
            if (lines.length === 0) {
                return ','; // Default
            }
            // Count occurrences of common delimiters
            const delimiters = [',', '\t', ';', '|'];
            const counts = {};
            for (const delimiter of delimiters) {
                counts[delimiter] = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
            }
            // Find delimiter with most consistent count across lines
            let bestDelimiter = ',';
            let bestScore = -1;
            for (const delimiter of delimiters) {
                const delimiterCounts = counts[delimiter];
                const avgCount = delimiterCounts.reduce((a, b) => a + b, 0) / delimiterCounts.length;
                if (avgCount === 0)
                    continue;
                // Calculate consistency (lower variance is better)
                const variance = delimiterCounts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / delimiterCounts.length;
                const score = avgCount / (1 + variance);
                if (score > bestScore) {
                    bestScore = score;
                    bestDelimiter = delimiter;
                }
            }
            return bestDelimiter;
        }
        finally {
            await fd.close();
        }
    }
    /**
     * Detect if JSON file is line-delimited (JSONL/NDJSON)
     */
    async detectLineDelimitedJSON(filePath) {
        const buffer = Buffer.alloc(4096);
        const fd = await fs.promises.open(filePath, 'r');
        try {
            const { bytesRead } = await fd.read(buffer, 0, 4096, 0);
            const content = buffer.slice(0, bytesRead).toString('utf-8');
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            if (lines.length < 2) {
                return false; // Not enough lines to determine
            }
            // Check if each line is valid JSON
            let validJSONLines = 0;
            for (const line of lines.slice(0, 5)) {
                try {
                    JSON.parse(line.trim());
                    validJSONLines++;
                }
                catch {
                    // Not valid JSON
                }
            }
            // If most lines are valid JSON, it's likely JSONL
            return validJSONLines >= Math.min(lines.length, 3);
        }
        finally {
            await fd.close();
        }
    }
    /**
     * Get fallback parser sequence for unknown or ambiguous file types
     */
    getFallbackParsers() {
        return [
            // Try CSV first (most common)
            {
                library: 'pandas',
                method: 'read_csv',
                options: {
                    encoding: 'utf-8',
                    encoding_errors: 'replace',
                    on_bad_lines: 'warn',
                    sep: ',',
                },
            },
            // Try tab-separated
            {
                library: 'pandas',
                method: 'read_csv',
                options: {
                    encoding: 'utf-8',
                    encoding_errors: 'replace',
                    on_bad_lines: 'warn',
                    sep: '\t',
                },
            },
            // Try JSON
            {
                library: 'pandas',
                method: 'read_json',
                options: {
                    orient: 'records',
                    lines: false,
                },
            },
            // Try line-delimited JSON
            {
                library: 'pandas',
                method: 'read_json',
                options: {
                    orient: 'records',
                    lines: true,
                },
            },
        ];
    }
    /**
     * Detect file type by extension
     */
    detectByExtension(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return EXTENSION_MAP[ext] || 'unknown';
    }
    /**
     * Detect file type by reading magic numbers from file content
     */
    async detectByContent(filePath) {
        // Read first 8 bytes for magic number detection
        const buffer = Buffer.alloc(8);
        const fd = await fs.promises.open(filePath, 'r');
        try {
            await fd.read(buffer, 0, 8, 0);
            // Check Excel XLSX (ZIP signature)
            if (this.matchesMagicNumber(buffer, MAGIC_NUMBERS.excel_xlsx)) {
                return 'excel';
            }
            // Check Excel XLS (OLE2 signature)
            if (this.matchesMagicNumber(buffer, MAGIC_NUMBERS.excel_xls)) {
                return 'excel';
            }
            // Check Parquet
            if (this.matchesMagicNumber(buffer, MAGIC_NUMBERS.parquet)) {
                return 'parquet';
            }
            return 'unknown';
        }
        finally {
            await fd.close();
        }
    }
    /**
     * Detect file type using heuristics (for text-based formats)
     */
    async detectByHeuristics(filePath) {
        // Read first 1KB of file
        const buffer = Buffer.alloc(1024);
        const fd = await fs.promises.open(filePath, 'r');
        try {
            const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
            const content = buffer.slice(0, bytesRead).toString('utf-8');
            // Check for JSON
            if (this.looksLikeJSON(content)) {
                return 'json';
            }
            // Check for CSV
            if (this.looksLikeCSV(content)) {
                return 'csv';
            }
            return 'unknown';
        }
        catch (error) {
            // If UTF-8 decoding fails, it's likely binary
            return 'unknown';
        }
        finally {
            await fd.close();
        }
    }
    /**
     * Check if buffer matches a magic number signature
     */
    matchesMagicNumber(buffer, magic) {
        if (buffer.length < magic.offset + magic.signature.length) {
            return false;
        }
        for (let i = 0; i < magic.signature.length; i++) {
            if (buffer[magic.offset + i] !== magic.signature[i]) {
                return false;
            }
        }
        return true;
    }
    /**
     * Heuristic check for JSON content
     */
    looksLikeJSON(content) {
        const trimmed = content.trim();
        // Check for JSON object or array start
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            return false;
        }
        // Try to parse as JSON
        try {
            JSON.parse(trimmed);
            return true;
        }
        catch {
            // Might be incomplete JSON (only read first 1KB)
            // Check for common JSON patterns
            return /^[\s\n]*[{\[]/.test(trimmed) &&
                (trimmed.includes('"') || trimmed.includes("'"));
        }
    }
    /**
     * Heuristic check for CSV content
     */
    looksLikeCSV(content) {
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        if (lines.length === 0) {
            return false;
        }
        // Check for common CSV delimiters
        const delimiters = [',', '\t', ';', '|'];
        for (const delimiter of delimiters) {
            const firstLineCount = (lines[0].match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
            // Need at least one delimiter
            if (firstLineCount === 0) {
                continue;
            }
            // Check if subsequent lines have similar delimiter counts
            let consistentCount = 0;
            for (let i = 1; i < Math.min(lines.length, 5); i++) {
                const lineCount = (lines[i].match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
                if (Math.abs(lineCount - firstLineCount) <= 1) {
                    consistentCount++;
                }
            }
            // If most lines have consistent delimiter counts, likely CSV
            if (consistentCount >= Math.min(lines.length - 1, 3)) {
                return true;
            }
        }
        return false;
    }
}
exports.DefaultFileTypeDetector = DefaultFileTypeDetector;
/**
 * Create a new file type detector instance
 */
function createFileTypeDetector() {
    return new DefaultFileTypeDetector();
}
/**
 * Convenience function to detect file type
 */
async function detectFileType(filePath) {
    const detector = createFileTypeDetector();
    return detector.detectFileType(filePath);
}
/**
 * Convenience function to get parser config
 */
function getParserConfig(fileType) {
    const detector = createFileTypeDetector();
    return detector.suggestParser(fileType);
}
/**
 * Convenience function to get enhanced parser config with file analysis
 */
async function getEnhancedParserConfig(filePath, fileType) {
    const detector = createFileTypeDetector();
    return detector.suggestParserWithOptions(filePath, fileType);
}
/**
 * Convenience function to get fallback parser sequence
 */
function getFallbackParsers() {
    const detector = createFileTypeDetector();
    return detector.getFallbackParsers();
}
