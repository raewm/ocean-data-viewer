import React from 'react';
import Plot from 'react-plotly.js';

export default function ProfilePlot({ data, timeIndex = 0 }) {
    const plotData = React.useMemo(() => {
        if (!data || data.length === 0) return null;

        const record = data[timeIndex] || data[0];

        // Check if we have profile data (multiple depth bins)
        if (!record.velocities) return null;

        const traces = [];

        // Extract velocity components
        Object.entries(record.velocities).forEach(([component, values]) => {
            if (Array.isArray(values) && values.length > 1) {
                // We have profile data
                const depths = values.map((_, i) => i + 1); // Depth bin numbers

                traces.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: values,
                    y: depths,
                    name: component,
                    line: { width: 2 },
                    marker: { size: 6 }
                });
            }
        });

        return traces.length > 0 ? traces : null;
    }, [data, timeIndex]);

    const layout = {
        title: {
            text: 'Velocity Profile',
            font: { size: 18, color: '#0A2463' }
        },
        xaxis: {
            title: 'Velocity (m/s)',
            showgrid: true,
            gridcolor: '#E5E7EB',
            zeroline: true
        },
        yaxis: {
            title: 'Bin Number (depth)',
            showgrid: true,
            gridcolor: '#E5E7EB',
            autorange: 'reversed' // Depth increases downward
        },
        plot_bgcolor: '#F9FAFB',
        paper_bgcolor: 'white',
        hovermode: 'closest',
        showlegend: true
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        toImageButtonOptions: {
            format: 'png',
            filename: 'velocity_profile',
            height: 800,
            width: 1000,
            scale: 2
        }
    };

    if (!data || data.length === 0 || !plotData) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3>📊 Velocity Profile</h3>
                </div>
                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                    {!data || data.length === 0
                        ? 'No data loaded'
                        : 'No profile data available (single-point instrument)'}
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3>📊 Velocity Profile</h3>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="time-index">Time Index: {timeIndex + 1} / {data.length}</label>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {data[timeIndex]?.timestamp && new Date(data[timeIndex].timestamp).toLocaleString()}
                </p>
            </div>

            <Plot
                data={plotData}
                layout={layout}
                config={config}
                style={{ width: '100%', height: '500px' }}
            />
        </div>
    );
}
