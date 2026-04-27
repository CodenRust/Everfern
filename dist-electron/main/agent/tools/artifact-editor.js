"use strict";
/**
 * EverFern Desktop — Artifact Editor
 *
 * Applies edit operations to parsed artifacts:
 * - Add content
 * - Remove elements
 * - Modify elements
 * - Update styles
 * - Update scripts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactEditor = void 0;
class ArtifactEditor {
    /**
     * Applies edit operations to parsed artifact.
     * Returns updated artifact and list of changes made.
     */
    applyEdits(parsed, operations) {
        const changes = [];
        const $ = parsed.dom;
        // 1. Add content
        if (operations.addContent) {
            this.addContent($, operations.addContent);
            changes.push('Added new content to body');
        }
        // 2. Remove elements
        if (operations.removeSelector) {
            const count = this.removeElements($, operations.removeSelector);
            changes.push(`Removed ${count} element(s) matching '${operations.removeSelector}'`);
        }
        // 3. Modify elements
        if (operations.modifySelector && operations.modifyContent) {
            const count = this.modifyElements($, operations.modifySelector, operations.modifyContent);
            changes.push(`Modified ${count} element(s) matching '${operations.modifySelector}'`);
        }
        // 4. Update styles
        if (operations.updateStyles) {
            this.updateStyles(parsed, operations.updateStyles);
            changes.push('Updated custom styles');
        }
        // 5. Update script
        if (operations.updateScript) {
            this.updateScript(parsed, operations.updateScript);
            changes.push('Updated custom JavaScript');
        }
        // 6. Update metadata
        if (operations.title) {
            parsed.title = operations.title;
            changes.push(`Updated title to '${operations.title}'`);
        }
        // Update body content from modified DOM
        parsed.bodyContent = $('body').html() || '';
        return { parsed, changes };
    }
    /**
     * Adds content to artifact body.
     */
    addContent($, content) {
        $('body').append(content);
    }
    /**
     * Removes elements matching selector.
     * Returns count of removed elements.
     */
    removeElements($, selector) {
        const count = $(selector).length;
        $(selector).remove();
        return count;
    }
    /**
     * Modifies elements matching selector.
     * Returns count of modified elements.
     */
    modifyElements($, selector, content) {
        const count = $(selector).length;
        $(selector).html(content);
        return count;
    }
    /**
     * Updates or adds CSS styles.
     */
    updateStyles(parsed, css) {
        if (parsed.customCSS) {
            parsed.customCSS += '\n' + css;
        }
        else {
            parsed.customCSS = css;
        }
    }
    /**
     * Updates or adds JavaScript code.
     */
    updateScript(parsed, js) {
        if (parsed.customJS) {
            parsed.customJS += '\n' + js;
        }
        else {
            parsed.customJS = js;
        }
    }
}
exports.ArtifactEditor = ArtifactEditor;
