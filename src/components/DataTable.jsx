import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { QC_FLAG_LABELS, QC_FLAGS } from '../qaqc/QAQCEngine';

export default function DataTable({ data, qcResults }) {
    const gridRef = React.useRef();

    // Cell renderer for QC flags
    const QCFlagRenderer = (params) => {
        if (!params.value) return '';

        const flag = params.value;
        let className = 'badge ';

        switch (flag) {
            case QC_FLAGS.PASS:
                className += 'badge-pass';
                break;
            case QC_FLAGS.SUSPECT:
                className += 'badge-suspect';
                break;
            case QC_FLAGS.FAIL:
                className += 'badge-fail';
                break;
            default:
                className += 'badge-info';
        }

        return `<span class="${className}">${QC_FLAG_LABELS[flag] || flag}</span>`;
    };

    const columnDefs = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const sampleRecord = data[0];
        const cols = [];

        // Timestamp column
        if (sampleRecord.timestamp) {
            cols.push({
                field: 'timestamp',
                headerName: 'Timestamp',
                sortable: true,
                filter: true,
                width: 200,
                valueFormatter: (params) => {
                    if (!params.value) return '';
                    return new Date(params.value).toLocaleString();
                }
            });
        }

        // Add QC flag if available
        if (qcResults && qcResults.length > 0) {
            cols.push({
                field: 'overallFlag',
                headerName: 'QC Flag',
                sortable: true,
                filter: true,
                width: 120,
                cellRenderer: QCFlagRenderer
            });
        }

        // Standard fields
        const standardFields = [
            { field: 'speed', header: 'Speed (m/s)' },
            { field: 'direction', header: 'Direction (°)' },
            { field: 'heading', header: 'Heading (°)' },
            { field: 'pitch', header: 'Pitch (°)' },
            { field: 'roll', header: 'Roll (°)' },
            { field: 'temperature', header: 'Temperature (°C)' },
            { field: 'pressure', header: 'Pressure' }
        ];

        standardFields.forEach(({ field, header }) => {
            if (sampleRecord[field] !== undefined) {
                cols.push({
                    field,
                    headerName: header,
                    sortable: true,
                    filter: 'agNumberColumnFilter',
                    width: 150,
                    valueFormatter: (params) => {
                        if (params.value === null || params.value === undefined) return '';
                        return typeof params.value === 'number' ? params.value.toFixed(3) : params.value;
                    }
                });
            }
        });

        // Velocity components (first bin only for display)
        if (sampleRecord.velocities) {
            Object.keys(sampleRecord.velocities).forEach((key) => {
                cols.push({
                    field: `velocities.${key}`,
                    headerName: `Vel ${key}`,
                    sortable: true,
                    filter: 'agNumberColumnFilter',
                    width: 120,
                    valueFormatter: (params) => {
                        if (!params.value) return '';
                        const val = Array.isArray(params.value) ? params.value[0] : params.value;
                        return typeof val === 'number' ? val.toFixed(3) : val;
                    }
                });
            });
        }

        return cols;
    }, [data, qcResults]);

    const rowData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        return data.map((record, index) => {
            const row = { ...record };

            // Add QC flag if available
            if (qcResults && qcResults[index]) {
                row.overallFlag = qcResults[index].overallFlag;
            }

            return row;
        });
    }, [data, qcResults]);

    const defaultColDef = React.useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true
    }), []);

    if (!data || data.length === 0) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3>📋 Data Table</h3>
                </div>
                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                    No data loaded
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3>📋 Data Table</h3>
                <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                    {rowData.length} records
                </div>
            </div>

            <div className="ag-theme-alpine" style={{ height: '500px', width: '100%' }}>
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    pagination={true}
                    paginationPageSize={20}
                    domLayout='normal'
                />
            </div>
        </div>
    );
}
