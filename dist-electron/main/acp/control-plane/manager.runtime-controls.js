"use strict";
/**
 * EverFern Desktop — ACP Control Plane Runtime Controls
 *
 * Simulates applying specific runtime options (mode, config)
 * to an active session before a turn executes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRuntimeControlSignature = buildRuntimeControlSignature;
exports.applyManagerRuntimeControls = applyManagerRuntimeControls;
function buildRuntimeControlSignature(options) {
    const keys = Object.keys(options).sort();
    return keys.map((k) => `${k}=${options[k]}`).join(';');
}
/**
 * Applies runtime controls (e.g. debug vs act mode) and returns
 * the updated signature if things changed, saving API calls.
 */
async function applyManagerRuntimeControls(params) {
    const options = params.meta.runtimeOptions ?? {};
    const signature = buildRuntimeControlSignature(options);
    if (params.cachedSignature === signature) {
        // No changes since last turn
        return signature;
    }
    // Simulate applying controls to the underlying ACP backend
    console.log(`[ACP/ControlPlane] Applying controls for ${params.sessionKey}:`, options);
    if (params.meta.mode) {
        console.log(`[ACP/ControlPlane] Mode set to: ${params.meta.mode}`);
    }
    return signature;
}
