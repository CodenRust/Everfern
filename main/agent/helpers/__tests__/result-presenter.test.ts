/**
 * EverFern Desktop — Result Presenter Tests
 *
 * Unit tests for the result presenter module
 */

import { describe, it, expect } from 'vitest';
import {
    createResultPresenter,
    formatNumerical,
    formatDataFrame,
    formatStatistics,
    formatMultipleResults,
    type DataFrameData,
    type AnalysisResult,
} from '../result-presenter';

describe('ResultPresenter', () => {
    describe('formatNumerical', () => {
        it('should format integers with 2 decimal places', () => {
            const result = formatNumerical(42);
            expect(result).toBe('42.00');
        });

        it('should format large numbers with 2 decimal places', () => {
            const result = formatNumerical(1234.5678);
            expect(result).toBe('1234.57');
        });

        it('should format small numbers with 4 decimal places', () => {
            const result = formatNumerical(0.0123);
            expect(result).toBe('0.0123');
        });

        it('should use scientific notation for very large numbers', () => {
            const result = formatNumerical(1234567890);
            expect(result).toContain('e+');
        });

        it('should use scientific notation for very small numbers', () => {
            const result = formatNumerical(0.00001);
            expect(result).toContain('e-');
        });

        it('should handle custom precision', () => {
            const result = formatNumerical(3.14159, { precision: 3 });
            expect(result).toBe('3.142');
        });

        it('should handle infinity', () => {
            const result = formatNumerical(Infinity);
            expect(result).toBe('Infinity');
        });

        it('should handle NaN', () => {
            const result = formatNumerical(NaN);
            expect(result).toBe('NaN');
        });
    });

    describe('formatDataFrame', () => {
        it('should format a simple DataFrame', () => {
            const df: DataFrameData = {
                columns: ['A', 'B', 'C'],
                rows: [
                    [1, 2, 3],
                    [4, 5, 6],
                ],
                shape: [2, 3],
            };

            const result = formatDataFrame(df);
            expect(result).toContain('**Shape:** 2 rows × 3 columns');
            expect(result).toContain('| A | B | C |');
            expect(result).toContain('| 1.00 | 2.00 | 3.00 |');
        });

        it('should paginate large DataFrames', () => {
            const rows = Array.from({ length: 200 }, (_, i) => [i, i * 2, i * 3]);
            const df: DataFrameData = {
                columns: ['A', 'B', 'C'],
                rows,
                shape: [200, 3],
            };

            const result = formatDataFrame(df);
            expect(result).toContain('Showing first 50 and last 50 of 200 rows');
            expect(result).toContain('...');
        });

        it('should handle empty DataFrames', () => {
            const df: DataFrameData = {
                columns: ['A', 'B'],
                rows: [],
            };

            const result = formatDataFrame(df);
            expect(result).toContain('*(empty)*');
        });

        it('should handle null and undefined values', () => {
            const df: DataFrameData = {
                columns: ['A', 'B'],
                rows: [[null, undefined]],
            };

            const result = formatDataFrame(df);
            expect(result).toContain('|  |  |');
        });
    });

    describe('formatStatistics', () => {
        it('should format statistics with key metrics highlighted', () => {
            const stats = {
                mean: 42.5,
                median: 40.0,
                'std dev': 8.7,
                count: 100,
                min: 10,
                max: 90,
            };

            const result = formatStatistics(stats);
            expect(result).toContain('**mean**');
            expect(result).toContain('**median**');
            expect(result).toContain('**std dev**');
            expect(result).toContain('**count**');
            expect(result).toContain('**min**');
            expect(result).toContain('**max**');
            expect(result).toContain('42.50');
        });

        it('should format non-key metrics without highlighting', () => {
            const stats = {
                custom_metric: 123.456,
            };

            const result = formatStatistics(stats);
            expect(result).toContain('custom_metric');
            expect(result).not.toContain('**custom_metric**');
        });

        it('should handle empty statistics', () => {
            const result = formatStatistics({});
            expect(result).toBe('*(no statistics)*');
        });
    });

    describe('formatMultipleResults', () => {
        it('should format a single result without collapsible sections', () => {
            const results: AnalysisResult[] = [
                {
                    type: 'numerical',
                    content: 42,
                    timestamp: Date.now(),
                    title: 'Test Result',
                },
            ];

            const result = formatMultipleResults(results);
            expect(result).toContain('## Test Result');
            expect(result).not.toContain('<details>');
        });

        it('should format multiple results with collapsible sections', () => {
            const results: AnalysisResult[] = [
                {
                    type: 'numerical',
                    content: 42,
                    timestamp: Date.now(),
                    title: 'Result 1',
                },
                {
                    type: 'text',
                    content: 'Some text',
                    timestamp: Date.now(),
                    title: 'Result 2',
                },
            ];

            const result = formatMultipleResults(results);
            expect(result).toContain('## Analysis Results');
            expect(result).toContain('### Result 1');
            expect(result).toContain('### Result 2');
            expect(result).toContain('<details>');
            expect(result).toContain('Click to expand');
        });

        it('should include timestamps in results', () => {
            const timestamp = new Date('2024-01-15T14:30:22').getTime();
            const results: AnalysisResult[] = [
                {
                    type: 'numerical',
                    content: 42,
                    timestamp,
                    title: 'Test',
                },
            ];

            const result = formatMultipleResults(results);
            expect(result).toContain('2024-01-15 14:30:22');
        });

        it('should handle empty results', () => {
            const result = formatMultipleResults([]);
            expect(result).toBe('*(no results)*');
        });

        it('should format different result types correctly', () => {
            const df: DataFrameData = {
                columns: ['A', 'B'],
                rows: [[1, 2]],
            };

            const results: AnalysisResult[] = [
                {
                    type: 'numerical',
                    content: 42.5,
                    timestamp: Date.now(),
                    title: 'Numerical',
                },
                {
                    type: 'dataframe',
                    content: df,
                    timestamp: Date.now(),
                    title: 'DataFrame',
                },
                {
                    type: 'statistics',
                    content: { mean: 10, median: 9 },
                    timestamp: Date.now(),
                    title: 'Statistics',
                },
                {
                    type: 'visualization',
                    content: null,
                    timestamp: Date.now(),
                    title: 'Visualization',
                },
                {
                    type: 'text',
                    content: 'Some text',
                    timestamp: Date.now(),
                    title: 'Text',
                },
            ];

            const result = formatMultipleResults(results);
            expect(result).toContain('42.50');
            expect(result).toContain('| A | B |');
            expect(result).toContain('**mean**');
            expect(result).toContain('*(visualization rendered inline)*');
            expect(result).toContain('Some text');
        });
    });

    describe('createResultPresenter', () => {
        it('should create a result presenter instance', () => {
            const presenter = createResultPresenter();
            expect(presenter).toBeDefined();
            expect(presenter.formatNumerical).toBeDefined();
            expect(presenter.formatDataFrame).toBeDefined();
            expect(presenter.formatStatistics).toBeDefined();
            expect(presenter.formatMultipleResults).toBeDefined();
        });
    });
});
