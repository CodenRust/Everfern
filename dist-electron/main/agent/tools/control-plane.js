"use strict";
/**
 * EverFern Desktop — Control Plane Tools
 *
 * Tools for managing workspace permissions, directory access,
 * and high-stakes operations that require user confirmation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowFileDeleteTool = exports.createWorkspaceRequestTool = void 0;
/**
 * request_workspace_directory
 *
 * Requests access to a local directory on the user's COMPUTER.
 * Triggers a native folder picker on the UI.
 */
const createWorkspaceRequestTool = (requestPermission) => ({
    name: 'request_workspace_directory',
    description: 'Request access to a directory on the user\'s computer. Use this to work with local files.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The absolute path to the directory (optional, launches folder picker if omitted)'
            },
            reason: {
                type: 'string',
                description: 'Brief explanation why you need access to this folder.'
            }
        },
        required: []
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        const pathValue = args['path'];
        const reason = args['reason'] || 'Requesting workspace access.';
        if (requestPermission) {
            try {
                const granted = await requestPermission();
                if (granted) {
                    return {
                        success: true,
                        output: `✔ Folder access granted for: ${pathValue || 'Selected Folder'}\nReason: ${reason}`,
                        data: { path: pathValue, granted: true }
                    };
                }
            }
            catch (err) {
                return { success: false, output: `Permission request failed: ${err}`, error: 'permission_request_error' };
            }
        }
        return {
            success: false,
            output: 'Permission request ignored or not supported in this session. Ask the user to click the "Add Folder" button manually.',
            error: 'permission_denied'
        };
    }
});
exports.createWorkspaceRequestTool = createWorkspaceRequestTool;
/**
 * allow_file_delete
 *
 * Requests permission to perform permanent file deletions.
 */
exports.allowFileDeleteTool = {
    name: 'allow_file_delete',
    description: 'Request permission to delete files in a directory. Call this when a delete operation fails with "Operation not permitted".',
    parameters: {
        type: 'object',
        properties: {
            directory: {
                type: 'string',
                description: 'The directory where deletions are planned.'
            },
            reason: {
                type: 'string',
                description: 'Why you need to delete these files (e.g. cleanup, build reset).'
            }
        },
        required: ['directory']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        const dir = args['directory'];
        return {
            success: true,
            output: `✔ Deletion permission requested for: ${dir}. Please inform the user via chat why this is necessary and wait for their explicit manual approval for the next tool call.`,
            data: { directory: dir, status: 'requested' }
        };
    }
};
