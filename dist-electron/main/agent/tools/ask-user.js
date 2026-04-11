"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askUserTool = void 0;
exports.askUserTool = {
    name: 'ask_user_question',
    description: 'Present multiple-choice questions to the user for clarification before starting work. ' +
        'Surfaces tappable options. Do not use for simple text chat.',
    parameters: {
        type: 'object',
        properties: {
            questions: {
                type: 'array',
                description: '1-3 specific clarifying questions.',
                items: {
                    type: 'object',
                    properties: {
                        question: { type: 'string', description: 'The question text.' },
                        options: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Possible answers for the user to pick from.'
                        },
                        multiSelect: { type: 'boolean', description: 'Whether multiple options can be chosen.' }
                    },
                    required: ['question', 'options']
                }
            },
            previewMarkdown: {
                type: 'string',
                description: 'Optional Markdown preview (e.g. ASCII mockup or config snippet) to help the user decide.'
            }
        },
        required: ['questions']
    },
    async execute(args, onUpdate) {
        const questions = args.questions;
        const preview = args.previewMarkdown;
        const formatted = questions.map(q => {
            const opts = q.options.join(' / ');
            return `❓ **${q.question}**\n   Choices: ${opts}`;
        }).join('\n\n');
        onUpdate?.(`🤔 Presenting ${questions.length} clarifying questions to the user...`);
        return {
            success: true,
            output: `Questions presented to the user:\n\n${formatted}\n\n${preview ? `**Preview Context:**\n${preview}\n\n` : ''}Wait for the user's selection.`,
            data: { questions, preview, type: 'ask_user' }
        };
    }
};
