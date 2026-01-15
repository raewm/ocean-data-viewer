import React from 'react';
import {
    exportToCSV,
    exportToExcel,
    exportSummaryAsJSON,
    formatQCSummaryForExport,
    exportAsText
} from '../utils/exportHelpers';

export default function ExportPanel({ data, metadata, qcResults, qcSummary, chartRefs }) {
    const [exportFormat, setExportFormat] = React.useState('csv');

    const handleExportData = () => {
        try {
            switch (exportFormat) {
                case 'csv':
                    exportToCSV(data, 'ocean_data.csv');
                    break;
                case 'excel':
                    exportToExcel(data, metadata, qcResults, 'ocean_data.xlsx');
                    break;
                case 'json':
                    const jsonData = {
                        metadata,
                        data,
                        qcResults: qcResults || []
                    };
                    exportSummaryAsJSON(jsonData, 'ocean_data.json');
                    break;
                default:
                    alert('Unknown export format');
            }
            alert(`Data exported successfully as ${exportFormat.toUpperCase()}`);
        } catch (error) {
            alert(`Error exporting data: ${error.message}`);
        }
    };

    const handleExportQCSummary = () => {
        if (!qcSummary) {
            alert('No QC summary available. Run QA/QC analysis first.');
            return;
        }

        try {
            const formattedSummary = formatQCSummaryForExport(qcSummary);
            exportAsText(formattedSummary, 'qc_summary.txt');
            alert('QC summary exported successfully');
        } catch (error) {
            alert(`Error exporting QC summary: ${error.message}`);
        }
    };

    const handleExportChart = async (chartType) => {
        const chartRef = chartRefs?.[chartType];

        if (!chartRef || !chartRef.current) {
            alert('Chart not available for export');
            return;
        }

        try {
            // Use Plotly's built-in download button functionality
            alert('Use the camera icon in the chart toolbar to download the image');
        } catch (error) {
            alert(`Error exporting chart: ${error.message}`);
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h3>💾 Export Data & Graphics</h3>
            </div>

            <div className="grid grid-2">
                <div>
                    <h3>Export Data</h3>
                    <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="export-format">Format</label>
                        <select
                            id="export-format"
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value)}
                        >
                            <option value="csv">CSV (Spreadsheet)</option>
                            <option value="excel">Excel (.xlsx)</option>
                            <option value="json">JSON</option>
                        </select>
                    </div>

                    <button
                        className="btn-primary"
                        onClick={handleExportData}
                        disabled={!data || data.length === 0}
                        style={{ width: '100%' }}
                    >
                        📥 Export Data
                    </button>

                    <button
                        className="btn-secondary mt-1"
                        onClick={handleExportQCSummary}
                        disabled={!qcSummary}
                        style={{ width: '100%' }}
                    >
                        📋 Export QC Summary
                    </button>
                </div>

                <div>
                    <h3>Export Graphics</h3>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                        Use the camera icon (📷) in each chart's toolbar to download as PNG or SVG
                    </p>

                    <div className="alert alert-info">
                        <strong>Tip:</strong> Hover over any chart to see the modebar with export options
                    </div>
                </div>
            </div>

            {data && data.length > 0 && (
                <div className="mt-3">
                    <div className="alert alert-success">
                        <strong>✓ Ready to Export</strong>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                            {data.length} records loaded
                            {qcResults && ` • QC analysis complete`}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
