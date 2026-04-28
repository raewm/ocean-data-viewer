import React from 'react';
import Plot from 'react-plotly.js';
import { QC_FLAGS } from '../qaqc/QAQCEngine';

export default function TimeSeriesPlot({ data, qcResults, parameter = 'velocity' }) {
    const plotRef = React.useRef();

    const plotData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        // Extract timestamps
        const timestamps = data.map(r => r.timestamp);

        // Extract values based on parameter
        let values = [];
        let yAxisLabel = parameter;

        switch (parameter) {
            case 'velocity':
                values = data.map(r => {
                    if (r.velocities?.v1) {
                        return Array.isArray(r.velocities.v1) ? r.velocities.v1[0] : r.velocities.v1;
                    }
                    if (r.velocities) {
                        const keys = Object.keys(r.velocities);
                        if (keys.length > 0) return r.velocities[keys[0]];
                    }
                    return null;
                });
                yAxisLabel = 'Velocity (m/s)';
                break;

            case 'speed':
                values = data.map(r => {
                    if (r.speed !== undefined) {
                        return Array.isArray(r.speed) ? r.speed[0] : r.speed;
                    }
                    return null;
                });
                yAxisLabel = 'Speed (m/s)';
                break;

            case 'direction':
                values = data.map(r => {
                    if (r.direction !== undefined) {
                        return Array.isArray(r.direction) ? r.direction[0] : r.direction;
                    }
                    return null;
                });
                yAxisLabel = 'Direction (°)';
                break;

            case 'temperature':
                values = data.map(r => r.temperature ?? null);
                yAxisLabel = 'Temperature (°C)';
                break;

            case 'heading':
                values = data.map(r => r.heading ?? null);
                yAxisLabel = 'Heading (°)';
                break;

            case 'pitch':
                values = data.map(r => r.pitch ?? null);
                yAxisLabel = 'Pitch (°)';
                break;

            case 'roll':
                values = data.map(r => r.roll ?? null);
                yAxisLabel = 'Roll (°)';
                break;

            case 'pressure':
                values = data.map(r => r.pressure ?? null);
                yAxisLabel = 'Pressure (dbar)';
                break;

            case 'battery':
                values = data.map(r => r.battery ?? null);
                yAxisLabel = 'Battery (V)';
                break;

            default:
                values = data.map(() => null);
        }

        const traces = [{
            type: 'scatter',
            mode: 'lines+markers',
            x: timestamps,
            y: values,
            name: parameter,
            line: { color: '#247BA0', width: 2 },
            marker: { size: 4, color: '#247BA0' }
        }];

        // Add QC flags as overlay if available
        if (qcResults && qcResults.length > 0) {
            const failPoints = {
                x: [],
                y: [],
                type: 'scatter',
                mode: 'markers',
                name: 'Fail',
                marker: { size: 8, color: '#FF6B6B', symbol: 'x' }
            };

            const suspectPoints = {
                x: [],
                y: [],
                type: 'scatter',
                mode: 'markers',
                name: 'Suspect',
                marker: { size: 8, color: '#F59E0B', symbol: 'diamond' }
            };

            qcResults.forEach((qc, i) => {
                if (qc.overallFlag === QC_FLAGS.FAIL && values[i] !== null) {
                    failPoints.x.push(timestamps[i]);
                    failPoints.y.push(values[i]);
                } else if (qc.overallFlag === QC_FLAGS.SUSPECT && values[i] !== null) {
                    suspectPoints.x.push(timestamps[i]);
                    suspectPoints.y.push(values[i]);
                }
            });

            if (failPoints.x.length > 0) traces.push(failPoints);
            if (suspectPoints.x.length > 0) traces.push(suspectPoints);
        }

        return { traces, yAxisLabel };
    }, [data, qcResults, parameter]);

    const layout = {
        title: {
            text: `${parameter.charAt(0).toUpperCase() + parameter.slice(1)} Time Series`,
            font: { size: 18, color: '#0A2463' }
        },
        xaxis: {
            title: 'Time',
            showgrid: true,
            gridcolor: '#E5E7EB'
        },
        yaxis: {
            title: plotData.yAxisLabel,
            showgrid: true,
            gridcolor: '#E5E7EB',
            range: parameter === 'direction' ? [0, 360] : undefined,
            dtick: parameter === 'direction' ? 45 : undefined
        },
        plot_bgcolor: '#F9FAFB',
        paper_bgcolor: 'white',
        hovermode: 'closest',
        showlegend: true,
        legend: {
            x: 1,
            xanchor: 'right',
            y: 1
        }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        toImageButtonOptions: {
            format: 'png',
            filename: `timeseries_${parameter}`,
            height: 800,
            width: 1200,
            scale: 2
        }
    };

    if (!data || data.length === 0) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3>📈 Time Series Plot</h3>
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
                <h3>📈 Time Series Plot</h3>
            </div>

            <Plot
                ref={plotRef}
                data={plotData.traces}
                layout={layout}
                config={config}
                style={{ width: '100%', height: '500px' }}
            />
        </div>
    );
}
