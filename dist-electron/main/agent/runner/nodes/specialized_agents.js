"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDataAnalystNode = exports.createCodingSpecialistNode = void 0;
const createCodingSpecialistNode = (runner) => {
    return async (state) => {
        runner.telemetry.info('Coding Specialist: Analyzing request...');
        // Add logic to focus on code-specific tool output filtering
        return { activeAgent: 'coding_specialist' };
    };
};
exports.createCodingSpecialistNode = createCodingSpecialistNode;
const createDataAnalystNode = (runner) => {
    return async (state) => {
        runner.telemetry.info('Data Analyst: Processing dataset...');
        // Add logic to focus on analytical tools
        return { activeAgent: 'data_analyst' };
    };
};
exports.createDataAnalystNode = createDataAnalystNode;
