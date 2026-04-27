"use strict";
/**
 * EverFern Desktop — Artifact Resolver
 *
 * Resolves natural language references to artifacts using:
 * - Recency tracking (most recently created/edited)
 * - Exact filename matching
 * - Fuzzy matching by title/description
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactResolver = void 0;
const artifacts_1 = require("../../store/artifacts");
const string_similarity_1 = require("string-similarity");
class ArtifactResolver {
    recentCache = {};
    FUZZY_THRESHOLD = 0.6;
    /**
     * Sets the most recently created or edited artifact for a session.
     */
    setMostRecent(chatId, filename) {
        this.recentCache[chatId] = {
            filename,
            timestamp: Date.now()
        };
    }
    /**
     * Gets the most recently created or edited artifact for a session.
     */
    getMostRecent(chatId) {
        const recent = this.recentCache[chatId];
        if (!recent)
            return null;
        const artifacts = (0, artifacts_1.listArtifacts)(chatId);
        const artifact = artifacts.find(a => a.name === recent.filename);
        if (!artifact)
            return null;
        return this.toReference(artifact);
    }
    /**
     * Resolves a natural language reference to an artifact.
     *
     * @param chatId - The chat session identifier
     * @param reference - Natural language reference (e.g., "the artifact", "sales dashboard")
     * @param filename - Exact filename (e.g., "sales-dashboard.html")
     * @returns ArtifactReference or null if not found
     * @throws Error if reference is ambiguous
     */
    resolve(chatId, reference, filename) {
        // 1. Exact filename match (highest priority)
        if (filename) {
            const artifacts = (0, artifacts_1.listArtifacts)(chatId);
            const artifact = artifacts.find(a => a.name === filename);
            return artifact ? this.toReference(artifact) : null;
        }
        // 2. Natural language reference
        if (reference) {
            // 2a. Check for recency indicators
            if (/^(the|that|this|it)$/i.test(reference.trim())) {
                return this.getMostRecent(chatId);
            }
            // 2b. Fuzzy match by title/description
            const matches = this.fuzzyMatch(chatId, reference);
            if (matches.length === 1) {
                return matches[0];
            }
            else if (matches.length > 1) {
                const matchList = matches.map((m, i) => `${i + 1}. ${m.title || m.filename}`).join('\n');
                throw new Error(`Ambiguous reference. Did you mean:\n${matchList}`);
            }
            return null;
        }
        // 3. No reference provided - use most recent
        return this.getMostRecent(chatId);
    }
    /**
     * Fuzzy matches artifacts by title or filename.
     */
    fuzzyMatch(chatId, query) {
        const artifacts = (0, artifacts_1.listArtifacts)(chatId);
        const matches = [];
        for (const artifact of artifacts) {
            const titleScore = artifact.name ? (0, string_similarity_1.compareTwoStrings)(query.toLowerCase(), artifact.name.toLowerCase()) : 0;
            const filenameScore = (0, string_similarity_1.compareTwoStrings)(query.toLowerCase(), artifact.name.toLowerCase());
            const maxScore = Math.max(titleScore, filenameScore);
            if (maxScore >= this.FUZZY_THRESHOLD) {
                matches.push({
                    ref: this.toReference(artifact),
                    score: maxScore
                });
            }
        }
        // Sort by score descending
        matches.sort((a, b) => b.score - a.score);
        return matches.map(m => m.ref);
    }
    /**
     * Lists all artifacts for a session, sorted by lastEdited descending.
     */
    listArtifacts(chatId) {
        const artifacts = (0, artifacts_1.listArtifacts)(chatId);
        return artifacts.map(a => this.toReference(a));
    }
    /**
     * Converts ArtifactMeta to ArtifactReference.
     */
    toReference(artifact) {
        return {
            chatId: artifact.chatId,
            filename: artifact.name,
            path: `~/.everfern/artifacts/${artifact.chatId}/${artifact.name}`,
            title: artifact.name,
            lastEdited: artifact.lastEdited
        };
    }
}
exports.ArtifactResolver = ArtifactResolver;
