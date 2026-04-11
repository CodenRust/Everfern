"use strict";
/**
 * EverFern Desktop — AGI Telemetry Logger
 *
 * Provides structured, high-fidelity logs for the AGI execution graph with an animated CLI feel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryLogger = void 0;
class TelemetryLogger {
    agentId;
    startTime;
    currentHeading = 'IDLE';
    iteration = 0;
    totalTokens = 0;
    spinnerFrames = [
        '[=         ]',
        '[==        ]',
        '[===       ]',
        '[====      ]',
        '[=====     ]',
        '[======    ]',
        '[=======   ]',
        '[========  ]',
        '[========= ]',
        '[==========]',
        '[ =========]',
        '[  ========]',
        '[   =======]',
        '[    ======]',
        '[     =====]',
        '[      ====]',
        '[       ===]',
        '[        ==]',
        '[         =]',
        '[          ]'
    ];
    currentFrame = 0;
    spinTimer = null;
    currentTask = 'Initializing...';
    constructor(agentId = 'EverFern-1') {
        this.agentId = agentId;
        this.startTime = Date.now();
    }
    setAgentId(id) {
        this.agentId = id;
    }
    getTimestamp() {
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(3);
        // Dark gray timestamp
        return `\x1b[90m[T+${elapsed}s]\x1b[0m`;
    }
    stopSpinner() {
        if (this.spinTimer) {
            clearInterval(this.spinTimer);
            this.spinTimer = null;
            // Clear line completely
            process.stdout.write('\r\x1b[K');
        }
    }
    startSpinner(task) {
        this.stopSpinner();
        this.currentTask = task;
        this.spinTimer = setInterval(() => {
            process.stdout.write(`\r\x1b[K\x1b[36m${this.spinnerFrames[this.currentFrame]}\x1b[0m \x1b[3m${this.currentTask}\x1b[0m`);
            this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
        }, 80);
    }
    printLog(msg, resumeSpinnerTask) {
        this.stopSpinner();
        console.log(msg);
        if (resumeSpinnerTask) {
            this.startSpinner(resumeSpinnerTask);
        }
    }
    /**
     * Session Initiate
     */
    begin(task) {
        this.stopSpinner();
        const divider = `\x1b[90m${'='.repeat(90)}\x1b[0m`;
        const header = `\x1b[1m\x1b[34m[🚀 INITIATE]\x1b[0m Agent: \x1b[33m${this.agentId}\x1b[0m | Objective: \x1b[97m${task.substring(0, 60)}${task.length > 60 ? '...' : ''}\x1b[0m`;
        console.log(`\n${divider}\n${this.getTimestamp()} ${header}\n${divider}`);
        this.startSpinner('Booting up intelligence core...');
    }
    /**
     * Graph Node Transition
     */
    transition(node) {
        this.currentHeading = node.toUpperCase();
        this.printLog(`${this.getTimestamp()} \x1b[35m[🧭 NODE    ]\x1b[0m Entering: \x1b[1m${this.currentHeading}\x1b[0m`, `Thinking in ${this.currentHeading}...`);
    }
    /**
     * Performance Metrics
     */
    metrics(iteration, tokens) {
        this.iteration = iteration;
        if (tokens)
            this.totalTokens += tokens;
        const fuelStr = this.totalTokens > 0 ? ` | Context: \x1b[36m${this.totalTokens.toLocaleString()}\x1b[0m tokens` : '';
        this.printLog(`${this.getTimestamp()} \x1b[32m[📊 METRICS ]\x1b[0m Step: \x1b[1m${this.iteration}\x1b[0m${fuelStr} | Health: \x1b[32mACTIVE\x1b[0m`, `Thinking in ${this.currentHeading}...`);
    }
    /**
     * Information log
     */
    info(msg) {
        this.printLog(`${this.getTimestamp()} \x1b[36m[🤖 ${this.currentHeading.padEnd(7)}]\x1b[0m ${msg}`, `Evaluating in ${this.currentHeading}...`);
    }
    /**
     * Action log (Specific operations like tool calls)
     */
    action(tool, args) {
        const argStr = JSON.stringify(args).substring(0, 90);
        this.printLog(`${this.getTimestamp()} \x1b[33m[🛠️  ACTION ]\x1b[0m Executing: \x1b[1m${tool}\x1b[0m (\x1b[90m${argStr}${argStr.length >= 90 ? '...' : ''}\x1b[0m)`, `Waiting for ${tool} to complete...`);
    }
    /**
     * Warning/Alert log
     */
    warn(msg) {
        this.printLog(`${this.getTimestamp()} \x1b[31m[⚠️  ALERT  ]\x1b[0m \x1b[31m${msg}\x1b[0m`, `Thinking in ${this.currentHeading}...`);
    }
    /**
     * Session Terminate
     */
    terminate(success, responseSummary) {
        this.stopSpinner();
        const status = success ? '\x1b[32mCOMPLETED\x1b[0m' : '\x1b[31mABORTED\x1b[0m';
        const summary = responseSummary ? ` | Result: \x1b[97m${responseSummary.substring(0, 50)}...\x1b[0m` : '';
        const divider = `\x1b[90m${'='.repeat(90)}\x1b[0m`;
        const finishLine = `\x1b[1m\x1b[32m[🏁 COMPLETE]\x1b[0m Mission ${status} | Final Steps: \x1b[1m${this.iteration}\x1b[0m${summary}`;
        console.log(`${divider}\n${this.getTimestamp()} ${finishLine}\n${divider}\n`);
    }
}
exports.TelemetryLogger = TelemetryLogger;
