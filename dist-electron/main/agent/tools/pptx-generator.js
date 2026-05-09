"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pptxGeneratorTool = void 0;
const pptxgenjs_1 = __importDefault(require("pptxgenjs"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const themes = {
    professional: {
        primary: '2E86AB',
        secondary: 'A23B72',
        accent: 'F18F01',
        background: 'FFFFFF',
        text: '333333',
        accentText: '555555'
    },
    modern: {
        primary: '00A8CC',
        secondary: 'F08181',
        accent: 'FFFFFF',
        background: 'F7F7F7',
        text: '2C3E50',
        accentText: '7F8C8D'
    },
    creative: {
        primary: 'FF6B6B',
        secondary: '4ECDC4',
        accent: 'FFE66D',
        background: 'FFFFFF',
        text: '2C3E50',
        accentText: '555555'
    },
    minimal: {
        primary: '34495E',
        secondary: '7F8C8D',
        accent: 'BDC3C7',
        background: 'FFFFFF',
        text: '2C3E50',
        accentText: '95A5A6'
    },
    dark: {
        primary: '3498DB',
        secondary: 'E74C3C',
        accent: '1ABC9C',
        background: '1A1A2E',
        text: 'ECF0F1',
        accentText: 'BDC3C7'
    },
    gradient: {
        primary: '667EEA',
        secondary: '764BA2',
        accent: 'F093FB',
        background: 'FFFFFF',
        text: '2D3748',
        accentText: '718096'
    }
};
exports.pptxGeneratorTool = {
    name: 'pptx_generator',
    description: 'Create beautiful PowerPoint presentations (PPTX) with professional themes, layouts, and formatting. Supports multiple slide layouts, color themes, and rich content.',
    parameters: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'The main title of the presentation'
            },
            subtitle: {
                type: 'string',
                description: 'Optional subtitle for the presentation'
            },
            author: {
                type: 'string',
                description: 'Optional author name'
            },
            outputPath: {
                type: 'string',
                description: 'Full file path where the PPTX should be saved (e.g., C:\\Users\\name\\Documents\\presentation.pptx)'
            },
            slides: {
                type: 'array',
                description: 'Array of slide objects defining each slide content',
                items: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Slide title' },
                        layout: {
                            type: 'string',
                            enum: ['title', 'titleContent', 'twoColumn', 'imageText', 'quote', 'blank'],
                            description: 'Slide layout type'
                        },
                        content: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Bullet points or content for the slide'
                        },
                        leftContent: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Content for left column (twoColumn layout)'
                        },
                        rightContent: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Content for right column (twoColumn layout)'
                        },
                        imageUrl: {
                            type: 'string',
                            description: 'URL of image (for imageText layout)'
                        },
                        imagePath: {
                            type: 'string',
                            description: 'Local file path of image (for imageText layout)'
                        },
                        quote: {
                            type: 'string',
                            description: 'Quote text (for quote layout)'
                        },
                        quoteAuthor: {
                            type: 'string',
                            description: 'Quote author (for quote layout)'
                        },
                        notes: {
                            type: 'string',
                            description: 'Speaker notes for the slide'
                        }
                    },
                    required: ['title']
                }
            },
            theme: {
                type: 'string',
                enum: ['professional', 'modern', 'creative', 'minimal', 'dark', 'gradient'],
                description: 'Color theme for the presentation'
            },
            includeTitleSlide: {
                type: 'boolean',
                description: 'Whether to include a title slide (default: true)'
            }
        },
        required: ['title', 'outputPath', 'slides']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        try {
            const { title, subtitle, author, outputPath, slides, theme = 'professional', includeTitleSlide = true } = args;
            onUpdate?.(`Creating presentation: ${title}`);
            const pres = new pptxgenjs_1.default();
            const themeColors = themes[theme];
            pres.author = author || 'EverFern AI';
            pres.title = title;
            pres.subject = subtitle || '';
            const addSlideWithBackground = () => {
                const slide = pres.addSlide();
                slide.background = { color: themeColors.background };
                return slide;
            };
            const addTextWithStyle = (slide, text, options) => {
                slide.addText(text, {
                    ...options,
                    color: options.color || themeColors.text,
                    fontFace: options.fontFace || 'Arial',
                });
            };
            if (includeTitleSlide) {
                const titleSlide = addSlideWithBackground();
                if (theme === 'gradient') {
                    titleSlide.background = { fill: themeColors.primary };
                }
                titleSlide.addText(title, {
                    x: 0.5,
                    y: 2.0,
                    w: '90%',
                    h: 1.5,
                    fontSize: 44,
                    bold: true,
                    color: theme === 'dark' || theme === 'gradient' ? 'FFFFFF' : themeColors.primary,
                    align: 'center',
                    fontFace: 'Arial'
                });
                if (subtitle) {
                    titleSlide.addText(subtitle, {
                        x: 0.5,
                        y: 3.5,
                        w: '90%',
                        h: 1.0,
                        fontSize: 24,
                        color: theme === 'dark' || theme === 'gradient' ? 'ECF0F1' : themeColors.accentText,
                        align: 'center',
                        fontFace: 'Arial'
                    });
                }
                if (author) {
                    titleSlide.addText(`By ${author}`, {
                        x: 0.5,
                        y: 5.0,
                        w: '90%',
                        h: 0.5,
                        fontSize: 16,
                        color: theme === 'dark' || theme === 'gradient' ? 'BDC3C7' : themeColors.accent,
                        align: 'center',
                        fontFace: 'Arial'
                    });
                }
            }
            for (const slideData of slides) {
                const slide = addSlideWithBackground();
                const layout = slideData.layout || 'titleContent';
                slide.addText(slideData.title, {
                    x: 0.5,
                    y: 0.3,
                    w: '90%',
                    h: 0.6,
                    fontSize: 32,
                    bold: true,
                    color: themeColors.primary,
                    fontFace: 'Arial'
                });
                slide.addShape(pres.ShapeType.rect, {
                    x: 0.5,
                    y: 0.95,
                    w: 9.0,
                    h: 0.03,
                    fill: { color: themeColors.accent },
                    line: { type: 'none' }
                });
                switch (layout) {
                    case 'title':
                        break;
                    case 'titleContent':
                        if (slideData.content && slideData.content.length > 0) {
                            slide.addText(slideData.content.map((item, i) => ({
                                text: item,
                                options: { bullet: true, fontSize: 18, color: themeColors.text }
                            })), {
                                x: 0.8,
                                y: 1.3,
                                w: 8.4,
                                h: 4.0,
                                fontSize: 18,
                                color: themeColors.text,
                                fontFace: 'Arial'
                            });
                        }
                        break;
                    case 'twoColumn':
                        if (slideData.leftContent) {
                            slide.addText(slideData.leftContent.map((item, i) => ({
                                text: item,
                                options: { bullet: true, fontSize: 16, color: themeColors.text }
                            })), {
                                x: 0.8,
                                y: 1.3,
                                w: 4.0,
                                h: 4.0,
                                fontSize: 16,
                                color: themeColors.text,
                                fontFace: 'Arial'
                            });
                        }
                        if (slideData.rightContent) {
                            slide.addText(slideData.rightContent.map((item, i) => ({
                                text: item,
                                options: { bullet: true, fontSize: 16, color: themeColors.text }
                            })), {
                                x: 5.2,
                                y: 1.3,
                                w: 4.0,
                                h: 4.0,
                                fontSize: 16,
                                color: themeColors.text,
                                fontFace: 'Arial'
                            });
                        }
                        break;
                    case 'imageText':
                        if (slideData.imageUrl || slideData.imagePath) {
                            const imgOptions = {
                                x: 0.8,
                                y: 1.3,
                                w: 4.0,
                                h: 3.5
                            };
                            if (slideData.imageUrl) {
                                imgOptions.path = slideData.imageUrl;
                            }
                            else if (slideData.imagePath) {
                                imgOptions.path = slideData.imagePath;
                            }
                            slide.addImage(imgOptions);
                        }
                        if (slideData.content) {
                            slide.addText(slideData.content.map((item, i) => ({
                                text: item,
                                options: { bullet: true, fontSize: 16, color: themeColors.text }
                            })), {
                                x: 5.2,
                                y: 1.3,
                                w: 4.0,
                                h: 4.0,
                                fontSize: 16,
                                color: themeColors.text,
                                fontFace: 'Arial'
                            });
                        }
                        break;
                    case 'quote':
                        if (slideData.quote) {
                            slide.addText(`"${slideData.quote}"`, {
                                x: 1.0,
                                y: 2.0,
                                w: 8.0,
                                h: 2.0,
                                fontSize: 28,
                                italic: true,
                                color: themeColors.primary,
                                align: 'center',
                                fontFace: 'Georgia'
                            });
                        }
                        if (slideData.quoteAuthor) {
                            slide.addText(`— ${slideData.quoteAuthor}`, {
                                x: 1.0,
                                y: 4.2,
                                w: 8.0,
                                h: 0.5,
                                fontSize: 20,
                                color: themeColors.accentText,
                                align: 'center',
                                fontFace: 'Arial'
                            });
                        }
                        break;
                    case 'blank':
                        if (slideData.content) {
                            slide.addText(slideData.content.join('\n'), {
                                x: 0.8,
                                y: 1.3,
                                w: 8.4,
                                h: 4.0,
                                fontSize: 18,
                                color: themeColors.text,
                                fontFace: 'Arial'
                            });
                        }
                        break;
                }
                if (slideData.notes) {
                    slide.notes = slideData.notes;
                }
            }
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            await pres.writeFile({ fileName: outputPath });
            onUpdate?.(`Presentation created successfully: ${outputPath}`);
            return {
                success: true,
                output: `Successfully created presentation "${title}" with ${slides.length} slides at: ${outputPath}`
            };
        }
        catch (err) {
            return {
                success: false,
                output: `Failed to create presentation: ${err.message}`
            };
        }
    }
};
