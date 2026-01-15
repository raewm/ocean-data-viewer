/**
 * Export utilities for graphics and data
 */

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

/**
 * Export Plotly chart to PNG
 */
export async function exportChartToPNG(plotlyRef, filename = 'chart.png') {
    if (!plotlyRef || !plotlyRef.current) {
        throw new Error('Invalid plotly reference');
    }

    try {
        const plotlyDiv = plotlyRef.current.el;

        // Use Plotly's built-in export
        const Plotly = await import('plotly.js-dist-min');
        await Plotly.downloadImage(plotlyDiv, {
            format: 'png',
            width: 1200,
            height: 800,
            filename: filename.replace('.png', '')
        });
    } catch (error) {
        console.error('Error exporting chart to PNG:', error);
        throw error;
    }
}

/**
 * Export Plotly chart to SVG
 */
export async function exportChartToSVG(plotlyRef, filename = 'chart.svg') {
    if (!plotlyRef || !plotlyRef.current) {
        throw new Error('Invalid plotly reference');
    }

    try {
        const plotlyDiv = plotlyRef.current.el;

        // Use Plotly's built-in export
        const Plotly = await import('plotly.js-dist-min');
        await Plotly.downloadImage(plotlyDiv, {
            format: 'svg',
            width: 1200,
            height: 800,
            filename: filename.replace('.svg', '')
        });
    } catch (error) {
        console.error('Error exporting chart to SVG:', error);
        throw error;
    }
}

/**
 * Export data to CSV
 */
export function exportToCSV(data, filename = 'data.csv') {
    if (!data || data.length === 0) {
        throw new Error('No data to export');
    }

    // Flatten nested objects
    const flattenedData = data.map(record => {
        const flat = {};

        for (const [key, value] of Object.entries(record)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Flatten objects
                for (const [subKey, subValue] of Object.entries(value)) {
                    flat[`${key}_${subKey}`] = subValue;
                }
            } else if (Array.isArray(value)) {
                // Handle arrays (e.g., velocity bins)
                value.forEach((v, i) => {
                    flat[`${key}_${i + 1}`] = v;
                });
            } else {
                flat[key] = value;
            }
        }

        return flat;
    });

    // Get all unique keys
    const allKeys = new Set();
    flattenedData.forEach(record => {
        Object.keys(record).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);

    // Create CSV content
    const csvRows = [];
    csvRows.push(headers.join(','));

    flattenedData.forEach(record => {
        const values = headers.map(header => {
            const value = record[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        });
        csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
}

/**
 * Export data to Excel
 */
export function exportToExcel(data, metadata = {}, qcResults = null, filename = 'ocean_data.xlsx') {
    const wb = XLSX.utils.book_new();

    // Flatten data for main sheet
    const flattenedData = data.map(record => {
        const flat = {};

        for (const [key, value] of Object.entries(record)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                for (const [subKey, subValue] of Object.entries(value)) {
                    flat[`${key}_${subKey}`] = subValue;
                }
            } else if (Array.isArray(value)) {
                value.forEach((v, i) => {
                    flat[`${key}_${i + 1}`] = v;
                });
            } else {
                flat[key] = value;
            }
        }

        return flat;
    });

    // Main data sheet
    const dataWS = XLSX.utils.json_to_sheet(flattenedData);
    XLSX.utils.book_append_sheet(wb, dataWS, 'Data');

    // Metadata sheet
    if (Object.keys(metadata).length > 0) {
        const metadataArray = Object.entries(metadata).map(([key, value]) => ({
            Parameter: key,
            Value: typeof value === 'object' ? JSON.stringify(value) : value
        }));
        const metadataWS = XLSX.utils.json_to_sheet(metadataArray);
        XLSX.utils.book_append_sheet(wb, metadataWS, 'Metadata');
    }

    // QC Results sheet
    if (qcResults && qcResults.length > 0) {
        const qcData = qcResults.map((result, index) => ({
            Index: index,
            Timestamp: result.timestamp,
            OverallFlag: result.overallFlag,
            ...result.flags
        }));
        const qcWS = XLSX.utils.json_to_sheet(qcData);
        XLSX.utils.book_append_sheet(wb, qcWS, 'QC Results');
    }

    // Write file
    XLSX.writeFile(wb, filename);
}

/**
 * Generate summary statistics report
 */
export function generateSummaryReport(data, metadata, qcSummary) {
    const report = {
        generatedAt: new Date().toISOString(),
        metadata: metadata,
        datasetInfo: {
            totalRecords: data.length,
            startTime: data[0]?.timestamp,
            endTime: data[data.length - 1]?.timestamp
        },
        qcSummary: qcSummary
    };

    return report;
}

/**
 * Export summary report as JSON
 */
export function exportSummaryAsJSON(summary, filename = 'summary_report.json') {
    const jsonContent = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    saveAs(blob, filename);
}

/**
 * Create downloadable text file
 */
export function exportAsText(content, filename = 'export.txt') {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    saveAs(blob, filename);
}

/**
 * Format QC summary for export
 */
export function formatQCSummaryForExport(qcSummary) {
    const lines = [];

    lines.push('=== QA/QC Summary Report ===');
    lines.push('');
    lines.push(`Total Records: ${qcSummary.total}`);
    lines.push(`Pass: ${qcSummary.pass} (${qcSummary.passPercent}%)`);
    lines.push(`Suspect: ${qcSummary.suspect} (${qcSummary.suspectPercent}%)`);
    lines.push(`Fail: ${qcSummary.fail} (${qcSummary.failPercent}%)`);
    lines.push(`Missing: ${qcSummary.missing}`);
    lines.push('');
    lines.push('=== Individual Test Results ===');
    lines.push('');

    for (const [test, results] of Object.entries(qcSummary.testResults)) {
        lines.push(`${test}:`);
        lines.push(`  Pass: ${results.pass}`);
        lines.push(`  Suspect: ${results.suspect}`);
        lines.push(`  Fail: ${results.fail}`);
        lines.push(`  Missing: ${results.missing}`);
        lines.push('');
    }

    return lines.join('\n');
}
