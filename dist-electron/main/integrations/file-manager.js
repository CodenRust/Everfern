"use strict";
/**
 * File Manager for Multi-Platform Integration
 *
 * This module handles file operations for attachments across different messaging
 * platforms, including download, upload, storage, and metadata management.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
exports.createFileManager = createFileManager;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Main file manager class
 */
class FileManager {
    config;
    platforms = new Map();
    metadataCache = new Map();
    constructor(config = {}) {
        this.config = {
            baseDir: path_1.default.join(os_1.default.homedir(), '.everfern', 'attachments'),
            maxTotalSize: 10 * 1024 * 1024 * 1024, // 10GB
            maxFileSize: 100 * 1024 * 1024, // 100MB
            retentionDays: 30,
            allowedMimeTypes: [],
            blockedMimeTypes: [
                'application/x-executable',
                'application/x-msdownload',
                'application/x-msdos-program'
            ],
            enableVirusScanning: false,
            ...config
        };
    }
    /**
     * Initialize the file manager
     */
    async initialize() {
        try {
            // Create base directories
            await this.ensureDirectories();
            // Load existing metadata
            await this.loadMetadataCache();
            // Clean up old files
            await this.cleanupOldFiles();
            console.log('FileManager initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize FileManager:', error);
            throw error;
        }
    }
    /**
     * Register a platform for file operations
     */
    registerPlatform(name, platform) {
        this.platforms.set(name, platform);
    }
    /**
     * Download a file from a platform
     */
    async downloadFile(file, platform, options = {}) {
        try {
            // Validate file
            const validation = await this.validateFile(file, options);
            if (!validation.success) {
                return validation;
            }
            // Generate local file path
            const localPath = await this.generateLocalPath(file);
            // Check if file already exists
            if (!options.overwrite && await this.fileExists(localPath)) {
                const metadata = await this.getFileMetadata(file.id);
                return {
                    success: true,
                    filePath: localPath,
                    metadata: metadata || undefined,
                    details: { cached: true }
                };
            }
            // Get platform instance
            const platformInstance = this.platforms.get(platform);
            if (!platformInstance) {
                return {
                    success: false,
                    error: `Platform ${platform} not registered`
                };
            }
            // Download file with timeout
            await this.downloadWithTimeout(platformInstance, file, localPath, options.timeout || 30000);
            // Verify download
            const stats = await fs_1.promises.stat(localPath);
            if (file.size > 0 && stats.size !== file.size) {
                await fs_1.promises.unlink(localPath).catch(() => { }); // Clean up partial download
                return {
                    success: false,
                    error: 'File size mismatch after download'
                };
            }
            // Calculate file hash
            const hash = await this.calculateFileHash(localPath);
            // Create metadata
            const metadata = {
                original: {
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    size: file.size,
                    platform,
                    url: file.url,
                    caption: file.caption
                },
                local: {
                    path: localPath,
                    filename: path_1.default.basename(localPath),
                    storedAt: new Date(),
                    hash,
                    size: stats.size
                },
                processing: {
                    downloaded: true,
                    validated: true,
                    errors: []
                },
                security: {
                    scanned: false,
                    safe: true // Assume safe until proven otherwise
                }
            };
            // Perform security scan if enabled
            if (this.config.enableVirusScanning) {
                await this.performSecurityScan(metadata);
            }
            // Save metadata
            await this.saveFileMetadata(file.id, metadata);
            this.metadataCache.set(file.id, metadata);
            return {
                success: true,
                filePath: localPath,
                metadata
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Download failed: ${error}`
            };
        }
    }
    /**
     * Upload a file to a platform
     */
    async uploadFile(localPath, options) {
        try {
            // Validate local file
            if (!await this.fileExists(localPath)) {
                return {
                    success: false,
                    error: 'Local file does not exist'
                };
            }
            const stats = await fs_1.promises.stat(localPath);
            if (stats.size > this.config.maxFileSize) {
                return {
                    success: false,
                    error: 'File exceeds maximum size limit'
                };
            }
            // Get platform instance
            const platform = this.platforms.get(options.platform);
            if (!platform) {
                return {
                    success: false,
                    error: `Platform ${options.platform} not registered`
                };
            }
            // Read file for upload
            const fileBuffer = await fs_1.promises.readFile(localPath);
            const filename = path_1.default.basename(localPath);
            // Upload file
            const messageId = await platform.sendMessage('', {
                chatId: options.chatId,
                attachments: [{
                        file: fileBuffer,
                        filename,
                        caption: options.caption
                    }]
            });
            // Clean up local file if requested
            if (options.deleteAfterUpload) {
                await fs_1.promises.unlink(localPath).catch(() => { });
            }
            return {
                success: true,
                details: {
                    messageId,
                    platform: options.platform,
                    chatId: options.chatId
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Upload failed: ${error}`
            };
        }
    }
    /**
     * Get file metadata by file ID
     */
    async getFileMetadata(fileId) {
        // Check cache first
        if (this.metadataCache.has(fileId)) {
            return this.metadataCache.get(fileId);
        }
        // Load from disk
        try {
            const metadataPath = this.getMetadataPath(fileId);
            const metadataJson = await fs_1.promises.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataJson);
            // Update cache
            this.metadataCache.set(fileId, metadata);
            return metadata;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * List all stored files
     */
    async listFiles() {
        const files = [];
        try {
            const metadataDir = path_1.default.join(this.config.baseDir, 'metadata');
            const metadataFiles = await fs_1.promises.readdir(metadataDir);
            for (const filename of metadataFiles) {
                if (filename.endsWith('.json')) {
                    const fileId = filename.replace('.json', '');
                    const metadata = await this.getFileMetadata(fileId);
                    if (metadata) {
                        files.push(metadata);
                    }
                }
            }
        }
        catch (error) {
            console.error('Error listing files:', error);
        }
        return files;
    }
    /**
     * Delete a file and its metadata
     */
    async deleteFile(fileId) {
        try {
            const metadata = await this.getFileMetadata(fileId);
            if (!metadata) {
                return false;
            }
            // Delete local file
            await fs_1.promises.unlink(metadata.local.path).catch(() => { });
            // Delete metadata file
            const metadataPath = this.getMetadataPath(fileId);
            await fs_1.promises.unlink(metadataPath).catch(() => { });
            // Remove from cache
            this.metadataCache.delete(fileId);
            return true;
        }
        catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }
    /**
     * Get storage statistics
     */
    async getStorageStats() {
        const files = await this.listFiles();
        let totalSize = 0;
        let oldestFile;
        let newestFile;
        for (const file of files) {
            totalSize += file.local.size;
            if (!oldestFile || file.local.storedAt < oldestFile) {
                oldestFile = file.local.storedAt;
            }
            if (!newestFile || file.local.storedAt > newestFile) {
                newestFile = file.local.storedAt;
            }
        }
        return {
            totalFiles: files.length,
            totalSize,
            availableSpace: this.config.maxTotalSize - totalSize,
            oldestFile,
            newestFile
        };
    }
    /**
     * Clean up old files based on retention policy
     */
    async cleanupOldFiles() {
        const files = await this.listFiles();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        let deletedCount = 0;
        for (const file of files) {
            if (file.local.storedAt < cutoffDate) {
                const deleted = await this.deleteFile(file.original.id);
                if (deleted) {
                    deletedCount++;
                }
            }
        }
        return deletedCount;
    }
    /**
     * Validate file before download
     */
    async validateFile(file, options) {
        // Check file size
        if (options.maxSize && file.size > options.maxSize) {
            return {
                success: false,
                error: `File size (${file.size}) exceeds maximum allowed (${options.maxSize})`
            };
        }
        if (file.size > this.config.maxFileSize) {
            return {
                success: false,
                error: `File size (${file.size}) exceeds system maximum (${this.config.maxFileSize})`
            };
        }
        // Check MIME type
        if (this.config.blockedMimeTypes.includes(file.mimeType)) {
            return {
                success: false,
                error: `MIME type ${file.mimeType} is blocked`
            };
        }
        if (this.config.allowedMimeTypes.length > 0 &&
            !this.config.allowedMimeTypes.includes(file.mimeType)) {
            return {
                success: false,
                error: `MIME type ${file.mimeType} is not allowed`
            };
        }
        // Check available storage space
        const stats = await this.getStorageStats();
        if (stats.availableSpace < file.size) {
            return {
                success: false,
                error: 'Insufficient storage space'
            };
        }
        return { success: true };
    }
    /**
     * Generate local file path
     */
    async generateLocalPath(file) {
        // Create safe filename
        const safeFilename = this.sanitizeFilename(file.name);
        const extension = path_1.default.extname(safeFilename);
        const basename = path_1.default.basename(safeFilename, extension);
        // Add hash to prevent conflicts
        const hash = crypto_1.default.createHash('md5').update(file.id).digest('hex').substring(0, 8);
        const filename = `${basename}_${hash}${extension}`;
        return path_1.default.join(this.config.baseDir, 'files', filename);
    }
    /**
     * Sanitize filename for safe storage
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .substring(0, 100); // Limit length
    }
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs_1.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Download file with timeout
     */
    async downloadWithTimeout(platform, file, localPath, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Download timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            platform.downloadFile(file, localPath)
                .then(() => {
                clearTimeout(timeout);
                resolve();
            })
                .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
    /**
     * Calculate file hash for integrity verification
     */
    async calculateFileHash(filePath) {
        const fileBuffer = await fs_1.promises.readFile(filePath);
        return crypto_1.default.createHash('sha256').update(fileBuffer).digest('hex');
    }
    /**
     * Perform security scan on file
     */
    async performSecurityScan(metadata) {
        // Placeholder for virus scanning integration
        // In a real implementation, this would integrate with antivirus APIs
        metadata.security.scanned = true;
        metadata.security.safe = true;
        metadata.security.scanResults = {
            scannedAt: new Date(),
            engine: 'placeholder',
            result: 'clean'
        };
    }
    /**
     * Save file metadata to disk
     */
    async saveFileMetadata(fileId, metadata) {
        const metadataPath = this.getMetadataPath(fileId);
        const metadataJson = JSON.stringify(metadata, null, 2);
        await fs_1.promises.writeFile(metadataPath, metadataJson, 'utf-8');
    }
    /**
     * Get metadata file path
     */
    getMetadataPath(fileId) {
        return path_1.default.join(this.config.baseDir, 'metadata', `${fileId}.json`);
    }
    /**
     * Ensure required directories exist
     */
    async ensureDirectories() {
        const dirs = [
            this.config.baseDir,
            path_1.default.join(this.config.baseDir, 'files'),
            path_1.default.join(this.config.baseDir, 'metadata')
        ];
        for (const dir of dirs) {
            await fs_1.promises.mkdir(dir, { recursive: true });
        }
    }
    /**
     * Load metadata cache from disk
     */
    async loadMetadataCache() {
        try {
            const metadataDir = path_1.default.join(this.config.baseDir, 'metadata');
            const files = await fs_1.promises.readdir(metadataDir);
            for (const filename of files) {
                if (filename.endsWith('.json')) {
                    const fileId = filename.replace('.json', '');
                    const metadata = await this.getFileMetadata(fileId);
                    if (metadata) {
                        this.metadataCache.set(fileId, metadata);
                    }
                }
            }
        }
        catch (error) {
            // Directory might not exist yet, which is fine
        }
    }
}
exports.FileManager = FileManager;
/**
 * Create a file manager with default configuration
 */
function createFileManager(config = {}) {
    return new FileManager(config);
}
