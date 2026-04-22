"use strict";
/**
 * EverFern Desktop — Result Presenter
 *
 * Formats and presents data analysis results in a professional, readable format.
 * Handles numerical formatting, DataFrame pagination, statistics highlighting,
 * and multi-result organization with collapsible sections.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultResultPresenter = void 0;
exports.createResultPresenter = createResultPresenter;
exports.formatNumerical = formatNumerical;
exports.formatDataFrame = formatDataFrame;
exports.formatStatistics = formatStatistics;
exports.formatMultipleResults = formatMultipleResults;
/**
 * Default implementation of ResultPresenter
 */
class DefaultResultPresenter {
    DEFAULT_MAX_ROWS = 100;
    DEFAULT_PRECISION = 2;
    KEY_METRICS = ['mean', 'median', 'std', 'std dev', 'count', 'min', 'max'];
    /**
     * Format a numerical value with appropriate precision
     * Uses 2-4 decimal places based on magnitude
     */
    formatNumerical(value, options) {
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
    determinePrecision(value) {
        const absValue = Math.abs(value);
        if (absValue === 0)
            return 2;
        if (absValue >= 1)
            return 2;
        if (absValue >= 0.1)
            return 3;
        return 4;
    }
    /**
     * Format a DataFrame with pagination for large datasets
     */
    formatDataFrame(df, options) {
        const maxRows = options?.maxRows ?? this.DEFAULT_MAX_ROWS;
        const showPagination = options?.showPagination ?? true;
        const totalRows = df.rows.length;
        const totalCols = df.columns.length;
        let output = '';
        // Add shape information
        if (df.shape) {
            output += `**Shape:** ${df.shape[0]} rows × ${df.shape[1]} columns\n\n`;
        }
        else {
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
        }
        else {
            output += this.formatTable(df.columns, df.rows);
        }
        return output;
    }
    /**
     * Format a table with columns and rows
     */
    formatTable(columns, rows) {
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
    formatCell(value) {
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
    formatStatistics(stats) {
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
    isKeyMetric(metric) {
        const normalized = metric.toLowerCase().trim();
        return this.KEY_METRICS.some(key => normalized.includes(key));
    }
    /**
     * Format multiple results with collapsible sections and timestamps
     */
    formatMultipleResults(results) {
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
    formatSingleResult(result) {
        const timestamp = this.formatTimestamp(result.timestamp);
        let output = '';
        if (result.title) {
            output += `## ${result.title} (${timestamp})\n\n`;
        }
        else {
            output += `## Analysis Result (${timestamp})\n\n`;
        }
        output += this.formatResultContent(result);
        return output;
    }
    /**
     * Format the content of a result based on its type
     */
    formatResultContent(result) {
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
    isDataFrameData(value) {
        return (typeof value === 'object' &&
            value !== null &&
            'columns' in value &&
            'rows' in value &&
            Array.isArray(value.columns) &&
            Array.isArray(value.rows));
    }
    /**
     * Type guard for statistics record
     */
    isStatisticsRecord(value) {
        return (typeof value === 'object' &&
            value !== null &&
            Object.values(value).every(v => typeof v === 'number'));
    }
    /**
     * Format a timestamp as a readable string
     */
    formatTimestamp(timestamp) {
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
exports.DefaultResultPresenter = DefaultResultPresenter;
/**
 * Create a new result presenter instance
 */
function createResultPresenter() {
    return new DefaultResultPresenter();
}
/**
 * Convenience function to format a numerical value
 */
function formatNumerical(value, options) {
    const presenter = createResultPresenter();
    return presenter.formatNumerical(value, options);
}
/**
 * Convenience function to format a DataFrame
 */
function formatDataFrame(df, options) {
    const presenter = createResultPresenter();
    return presenter.formatDataFrame(df, options);
}
/**
 * Convenience function to format statistics
 */
function formatStatistics(stats) {
    const presenter = createResultPresenter();
    return presenter.formatStatistics(stats);
}
/**
 * Convenience function to format multiple results
 */
function formatMultipleResults(results) {
    const presenter = createResultPresenter();
    return presenter.formatMultipleResults(results);
}
