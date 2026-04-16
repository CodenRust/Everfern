"use strict";
/**
 * End-to-End Encryption Service
 *
 * Provides encryption capabilities for sensitive data in the multi-platform
 * integration system, including message encryption, key management, and
 * secure data storage.
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
exports.EncryptionService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = require("os");
const security_logger_1 = require("./security-logger");
/**
 * Encryption Service for secure data handling
 */
class EncryptionService {
    config;
    securityLogger;
    keyStore = new Map();
    keyStoreFile;
    masterKey;
    constructor(securityLogger) {
        this.securityLogger = securityLogger;
        // Default encryption configuration
        this.config = {
            algorithm: 'aes-256-gcm',
            keyDerivation: 'pbkdf2',
            keyLength: 32, // 256 bits
            ivLength: 16, // 128 bits
            tagLength: 16, // 128 bits
            saltLength: 32, // 256 bits
            iterations: 100000
        };
        this.keyStoreFile = path.join((0, os_1.homedir)(), '.everfern', 'encryption', 'keystore.json');
    }
    /**
     * Initialize the encryption service
     */
    async initialize(masterPassword) {
        try {
            const encryptionDir = path.dirname(this.keyStoreFile);
            await fs.mkdir(encryptionDir, { recursive: true });
            // Initialize or load master key
            if (masterPassword) {
                this.masterKey = await this.deriveMasterKey(masterPassword);
            }
            else {
                // Generate a random master key (for development/testing)
                this.masterKey = crypto.randomBytes(this.config.keyLength);
            }
            await this.loadKeyStore();
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.LOW, 'encryption-service', 'Encryption service initialized', { algorithm: this.config.algorithm });
            console.log('Encryption service initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize encryption service:', error);
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.CRITICAL, 'encryption-service', 'Failed to initialize encryption service', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Encrypt data using symmetric encryption
     */
    async encryptData(data, keyId) {
        try {
            const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            const key = keyId ? await this.getEncryptionKey(keyId) : this.masterKey;
            if (!key) {
                throw new Error('No encryption key available');
            }
            const salt = crypto.randomBytes(this.config.saltLength);
            const iv = crypto.randomBytes(this.config.ivLength);
            let cipher;
            let encrypted;
            let tag;
            if (this.config.algorithm === 'aes-256-gcm') {
                cipher = crypto.createCipher('aes-256-gcm', key);
                cipher.setAAD(salt); // Use salt as additional authenticated data
                encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
                tag = cipher.getAuthTag();
            }
            else {
                cipher = crypto.createCipher('aes-256-cbc', key);
                encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
            }
            const result = {
                algorithm: this.config.algorithm,
                iv: iv.toString('base64'),
                salt: salt.toString('base64'),
                data: encrypted.toString('base64'),
                timestamp: Date.now()
            };
            if (tag) {
                result.tag = tag.toString('base64');
            }
            return result;
        }
        catch (error) {
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.HIGH, 'encryption-service', 'Failed to encrypt data', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Decrypt data using symmetric encryption
     */
    async decryptData(encryptedData, keyId) {
        try {
            const key = keyId ? await this.getEncryptionKey(keyId) : this.masterKey;
            if (!key) {
                throw new Error('No decryption key available');
            }
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const salt = Buffer.from(encryptedData.salt, 'base64');
            const data = Buffer.from(encryptedData.data, 'base64');
            let decipher;
            let decrypted;
            if (encryptedData.algorithm === 'aes-256-gcm') {
                if (!encryptedData.tag) {
                    throw new Error('Authentication tag missing for GCM mode');
                }
                decipher = crypto.createDecipher('aes-256-gcm', key);
                decipher.setAAD(salt);
                decipher.setAuthTag(Buffer.from(encryptedData.tag, 'base64'));
                decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
            }
            else {
                decipher = crypto.createDecipher('aes-256-cbc', key);
                decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
            }
            return decrypted;
        }
        catch (error) {
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.HIGH, 'encryption-service', 'Failed to decrypt data', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Generate a new encryption key pair for asymmetric encryption
     */
    async generateKeyPair(algorithm = 'rsa', keySize = 2048) {
        try {
            let keyPair;
            if (algorithm === 'rsa') {
                keyPair = crypto.generateKeyPairSync('rsa', {
                    modulusLength: keySize,
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
            }
            else {
                keyPair = crypto.generateKeyPairSync('ed25519', {
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
            }
            const result = {
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey,
                algorithm,
                keySize,
                createdAt: new Date()
            };
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.LOW, 'encryption-service', `Generated new ${algorithm} key pair`, { algorithm, keySize });
            return result;
        }
        catch (error) {
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.HIGH, 'encryption-service', 'Failed to generate key pair', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Encrypt data using public key (asymmetric encryption)
     */
    async encryptWithPublicKey(data, publicKey) {
        try {
            const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            const encrypted = crypto.publicEncrypt(publicKey, dataBuffer);
            return encrypted.toString('base64');
        }
        catch (error) {
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.HIGH, 'encryption-service', 'Failed to encrypt with public key', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Decrypt data using private key (asymmetric encryption)
     */
    async decryptWithPrivateKey(encryptedData, privateKey) {
        try {
            const data = Buffer.from(encryptedData, 'base64');
            const decrypted = crypto.privateDecrypt(privateKey, data);
            return decrypted;
        }
        catch (error) {
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.HIGH, 'encryption-service', 'Failed to decrypt with private key', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Sign data using private key
     */
    async signData(data, privateKey, algorithm = 'sha256') {
        try {
            const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            const sign = crypto.createSign(algorithm);
            sign.update(dataBuffer);
            const signature = sign.sign(privateKey, 'base64');
            return signature;
        }
        catch (error) {
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.HIGH, 'encryption-service', 'Failed to sign data', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Verify signature using public key
     */
    async verifySignature(data, signature, publicKey, algorithm = 'sha256') {
        try {
            const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            const verify = crypto.createVerify(algorithm);
            verify.update(dataBuffer);
            return verify.verify(publicKey, signature, 'base64');
        }
        catch (error) {
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.ENCRYPTION_FAILURE, security_logger_1.SecurityEventSeverity.MEDIUM, 'encryption-service', 'Failed to verify signature', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    /**
     * Generate a secure hash of data
     */
    generateHash(data, algorithm = 'sha256') {
        const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
        const hash = crypto.createHash(algorithm);
        hash.update(dataBuffer);
        return hash.digest('hex');
    }
    /**
     * Generate a secure random token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    /**
     * Create an encryption key and store it
     */
    async createEncryptionKey(name, usage = 'encryption', expiresAt) {
        const keyId = this.generateKeyId();
        const keyData = crypto.randomBytes(this.config.keyLength);
        const encryptionKey = {
            id: keyId,
            name,
            algorithm: this.config.algorithm,
            keyData: keyData.toString('base64'),
            createdAt: new Date(),
            expiresAt,
            usage,
            active: true
        };
        this.keyStore.set(keyId, encryptionKey);
        await this.saveKeyStore();
        await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.LOW, 'encryption-service', `Created new encryption key: ${name}`, { keyId, usage });
        return keyId;
    }
    /**
     * Get encryption key by ID
     */
    async getEncryptionKey(keyId) {
        const key = this.keyStore.get(keyId);
        if (!key || !key.active) {
            return null;
        }
        // Check if key has expired
        if (key.expiresAt && key.expiresAt < new Date()) {
            key.active = false;
            await this.saveKeyStore();
            return null;
        }
        return Buffer.from(key.keyData, 'base64');
    }
    /**
     * Derive master key from password
     */
    async deriveMasterKey(password) {
        const salt = crypto.randomBytes(this.config.saltLength);
        if (this.config.keyDerivation === 'pbkdf2') {
            return new Promise((resolve, reject) => {
                crypto.pbkdf2(password, salt, this.config.iterations, this.config.keyLength, 'sha256', (err, derivedKey) => {
                    if (err)
                        reject(err);
                    else
                        resolve(derivedKey);
                });
            });
        }
        else {
            return new Promise((resolve, reject) => {
                crypto.scrypt(password, salt, this.config.keyLength, (err, derivedKey) => {
                    if (err)
                        reject(err);
                    else
                        resolve(derivedKey);
                });
            });
        }
    }
    /**
     * Generate unique key ID
     */
    generateKeyId() {
        return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    /**
     * Load key store from file
     */
    async loadKeyStore() {
        try {
            const fileExists = await fs.access(this.keyStoreFile).then(() => true).catch(() => false);
            if (fileExists) {
                const content = await fs.readFile(this.keyStoreFile, 'utf8');
                const keyStoreData = JSON.parse(content);
                // Decrypt the key store if it's encrypted
                if (keyStoreData.encrypted && this.masterKey) {
                    const decryptedData = await this.decryptData(keyStoreData.data);
                    const keys = JSON.parse(decryptedData.toString('utf8'));
                    for (const [keyId, keyData] of Object.entries(keys)) {
                        this.keyStore.set(keyId, keyData);
                    }
                }
                else if (!keyStoreData.encrypted) {
                    // Unencrypted key store (for development)
                    for (const [keyId, keyData] of Object.entries(keyStoreData)) {
                        this.keyStore.set(keyId, keyData);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to load key store:', error);
            // Continue with empty key store
        }
    }
    /**
     * Save key store to file
     */
    async saveKeyStore() {
        try {
            const keyStoreData = {};
            for (const [keyId, keyData] of this.keyStore.entries()) {
                keyStoreData[keyId] = keyData;
            }
            let fileContent;
            if (this.masterKey) {
                // Encrypt the key store
                const encryptedData = await this.encryptData(JSON.stringify(keyStoreData));
                fileContent = {
                    encrypted: true,
                    data: encryptedData
                };
            }
            else {
                // Store unencrypted (for development)
                fileContent = keyStoreData;
            }
            await fs.writeFile(this.keyStoreFile, JSON.stringify(fileContent, null, 2));
        }
        catch (error) {
            console.error('Failed to save key store:', error);
        }
    }
    /**
     * Get encryption configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update encryption configuration
     */
    async updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.MEDIUM, 'encryption-service', 'Encryption configuration updated', { updates });
    }
    /**
     * List available encryption keys
     */
    listKeys() {
        return Array.from(this.keyStore.values()).map(key => ({
            ...key,
            keyData: '[REDACTED]' // Don't expose actual key data
        }));
    }
    /**
     * Deactivate an encryption key
     */
    async deactivateKey(keyId) {
        const key = this.keyStore.get(keyId);
        if (key) {
            key.active = false;
            await this.saveKeyStore();
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.MEDIUM, 'encryption-service', `Deactivated encryption key: ${key.name}`, { keyId });
        }
    }
}
exports.EncryptionService = EncryptionService;
// Export the encryption service
