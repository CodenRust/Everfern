/**
 * EverFern Desktop — Result Presenter
 *
 * Formats and presents data analysis results in a professional, readable format.
 * Handles numerical formatting, DataFrame pagination, statistics highlighting,
 * and multi-result organization with collapsible sections.
 */

/**
 * Types of analysis results that can be presented
 */
export type AnalysisResultType = 'numerical' | 'dataframe' | 'statistics' | 'visualization' | 'text';

/**
 * Represents a single analysis result with metadata
 */
export interface AnalysisResult {
    type: AnalysisResultType;
    content: unknown;
    timestamp: number;
    title?: string;
}

/**
 * Configuration for DataFrame formatting
 */
export interface DataFrameFormatOptions {
    maxRows?: number;
    showPagination?: boolean;
}

/**
 * Configuration for numerical formatting
 */
export interface NumericalFormatOptions {
    precision?: number;
    useScientific?: boolean;
}

/**
 * Result presenter interface for formatting analysis outputs
 */
export interface ResultPresenter {
    formatNumerical(value: number, options?: NumericalFormatOptions): string;
    formatDataFrame(df: DataFrameData, options?: DataFrameFormatOptions): string;
    formatStatistics(stats: Record<string, number>): string;
    formatMultipleResults(results: AnalysisResult[]): string;
}

/**
 * Represents a DataFrame with rows and columns
 */
export interface DataFrameData {
    columns: string[];
    rows: unknown[][];
    shape?: [number, number];
}

/**
 * Default implementation of ResultPresenter
 */
export class DefaultResultPresenter implements ResultPresenter {
    private readonly DEFAULT_MAX_ROWS = 100;
    private readonly DEFAULT_PRECISION = 2;
    private readonly KEY_METRICS = ['mean', 'median', 'std', 'std dev', 'count', 'min', 'max'];

    /**
     * Format a numerical value with appropriate precision
     * Uses 2-4 decimal places based on magnitude
     */
    formatNumerical(value: number, options?: NumericalFormatOptions): string {
        if (!isFinite(value)) {
            return String(value);
        }

        const precision = options?.precision ?? this.determinePrecision(value);
        const useScientific = options?.useScientific ?? (Math.abs(value) >= 1e6 || (Math.abs(value) < 0.0001 && value !== 0));

        if (useScientific) {
            return value.toExponential(precision);
        }

        return value.toFixed(precision);
    }

    /**
     * Determine appropriate precision based on value magnitude
     */
    private determinePrecision(value: number): number {
        const absValue = Math.abs(value);

        if (absValue === 0) return 2;
        if (absValue >= 1) return 2;
        if (absValue >= 0.1) return 3;
        return 4;
    }

    /**
     * Format a DataFrame with pagination for large datasets
     */
    formatDataFrame(df: DataFrameData, options?: DataFrameFormatOptions): string {
        const maxRows = options?.maxRows ?? this.DEFAULT_MAX_ROWS;
        const showPagination = options?.showPagination ?? true;
        const totalRows = df.rows.length;
        const totalCols = df.columns.length;

        let output = '';

        // Add shape information
        if (df.shape) {
            output += `**Shape:** ${df.shape[0]} rows × ${df.shape[1]} columns\n\n`;
        } else {
            output += `**Shape:** ${totalRows} rows × ${totalCols} columns\n\n`;
        }

        // Handle pagination for large datasets
        if (totalRows > maxRows && showPagination) {
            output += `Showing first 50 and last 50 of ${totalRows} rows\n\n`;
            const firstRows = df.rows.slice(0, 50);
            const lastRows = df.rows.slice(-50);

            output += this.formatTable(df.columns, firstRows);
            output += '\n...\n\n';
            output += this.formatTable(df.columns, lastRows);
        } else {
            output += this.formatTable(df.columns, df.rows);
        }

        return output;
    }

    /**
     * Format a table with columns and rows
     */
    private formatTable(columns: string[], rows: unknown[][]): string {
        if (rows.length === 0) {
            return '*(empty)*';
        }

        // Create header
        const header = `| ${columns.join(' | ')} |`;
        const separator = `| ${columns.map(() => '---').join(' | ')} |`;

        // Create rows
        const formattedRows = rows.map(row => {
            const cells = row.map(cell => this.formatCell(cell));
            return `| ${cells.join(' | ')} |`;
        });

        return [header, separator, ...formattedRows].join('\n');
    }

    /**
     * Format a single cell value
     */
    private formatCell(value: unknown): string {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'number') {
            return this.formatNumerical(value);
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        return String(value);
    }

    /**
     * Format statistics with bold highlighting for key metrics
     */
    formatStatistics(stats: Record<string, number>): string {
        const entries = Object.entries(stats);

        if (entries.length === 0) {
            return '*(no statistics)*';
        }

        let output = '| Metric | Value |\n';
        output += '|--------|-------|\n';

        for (const [key, value] of entries) {
            const formattedKey = this.isKeyMetric(key) ? `**${key}**` : key;
            const formattedValue = this.formatNumerical(value);
            output += `| ${formattedKey} | ${formattedValue} |\n`;
        }

        return output;
    }

    /**
     * Check if a metric is a key metric that should be highlighted
     */
    private isKeyMetric(metric: string): boolean {
        const normalized = metric.toLowerCase().trim();
        return this.KEY_METRICS.some(key => normalized.includes(key));
    }

    /**
     * Format multiple results with collapsible sections and timestamps
     */
    formatMultipleResults(results: AnalysisResult[]): string {
        if (results.length === 0) {
            return '*(no results)*';
        }

        if (results.length === 1) {
            return this.formatSingleResult(results[0]);
        }

        let output = '## Analysis Results\n\n';

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const timestamp = this.formatTimestamp(result.timestamp);
            const title = result.title || `Result ${i + 1}`;

            output += `### ${title} (${timestamp})\n\n`;
            output += '<details>\n';
            output += '<summary>Click to expand</summary>\n\n';
            output += this.formatResultContent(result);
            output += '\n</details>\n\n';
        }

        return output;
    }

    /**
     * Format a single result without collapsible sections
     */
    private formatSingleResult(result: AnalysisResult): string {
        const timestamp = this.formatTimestamp(result.timestamp);
        let output = '';

        if (result.title) {
            output += `## ${result.title} (${timestamp})\n\n`;
        } else {
            output += `## Analysis Result (${timestamp})\n\n`;
        }

        output += this.formatResultContent(result);
        return output;
    }

    /**
     * Format the content of a result based on its type
     */
    private formatResultContent(result: AnalysisResult): string {
        switch (result.type) {
            case 'numerical':
                if (typeof result.content === 'number') {
                    return this.formatNumerical(result.content);
                }
                return String(result.content);

            case 'dataframe':
                if (this.isDataFrameData(result.content)) {
                    return this.formatDataFrame(result.content);
                }
                return String(result.content);

            case 'statistics':
                if (this.isStatisticsRecord(result.content)) {
                    return this.formatStatistics(result.content);
                }
                return String(result.content);

            case 'visualization':
                return '*(visualization rendered inline)*';

            case 'text':
                return String(result.content);

            default:
                return String(result.content);
        }
    }

    /**
     * Type guard for DataFrameData
     */
    private isDataFrameData(value: unknown): value is DataFrameData {
        return (
            typeof value === 'object' &&
            value !== null &&
            'columns' in value &&
            'rows' in value &&
            Array.isArray((value as DataFrameData).columns) &&
            Array.isArray((value as DataFrameData).rows)
        );
    }

    /**
     * Type guard for statistics record
     */
    private isStatisticsRecord(value: unknown): value is Record<string, number> {
        return (
            typeof value === 'object' &&
            value !== null &&
            Object.values(value).every(v => typeof v === 'number')
        );
    }

    /**
     * Format a timestamp as a readable string
     */
    private formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}

/**
 * Create a new result presenter instance
 */
export function createResultPresenter(): ResultPresenter {
    return new DefaultResultPresenter();
}

/**
 * Convenience function to format a numerical value
 */
export function formatNumerical(value: number, options?: NumericalFormatOptions): string {
    const presenter = createResultPresenter();
    return presenter.formatNumerical(value, options);
}

/**
 * Convenience function to format a DataFrame
 */
export function formatDataFrame(df: DataFrameData, options?: DataFrameFormatOptions): string {
    const presenter = createResultPresenter();
    return presenter.formatDataFrame(df, options);
}

/**
 * Convenience function to format statistics
 */
export function formatStatistics(stats: Record<string, number>): string {
    const presenter = createResultPresenter();
    return presenter.formatStatistics(stats);
}

/**
 * Convenience function to format multiple results
 */
export function formatMultipleResults(results: AnalysisResult[]): string {
    const presenter = createResultPresenter();
    return presenter.formatMultipleResults(results);
}
