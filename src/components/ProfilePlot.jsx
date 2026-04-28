import React from 'react';
import Plot from 'react-plotly.js';

export default function ProfilePlot({ data, timeIndex = 0 }) {
    const [mode, setMode] = React.useState('speed'); // 'components', 'speed', 'direction'

    const plotData = React.useMemo(() => {
        if (!data || data.length === 0) return null;

        const record = data[timeIndex] || data[0];
        const traces = [];
        const depths = (record.speed || record.velocities?.v1 || []).map((_, i) => i + 1);

        if (mode === 'components' && record.velocities) {
            // Extract velocity components
            Object.entries(record.velocities).forEach(([component, values]) => {
                if (Array.isArray(values) && values.length > 1) {
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
        } else if (mode === 'speed' && record.speed) {
            traces.push({
                type: 'scatter',
                mode: 'lines+markers',
                x: record.speed,
                y: depths,
                name: 'Speed',
                line: { width: 3, color: '#247BA0' },
                marker: { size: 8, color: '#247BA0' }
            });
        } else if (mode === 'direction' && record.direction) {
            traces.push({
                type: 'scatter',
                mode: 'markers',
                x: record.direction,
                y: depths,
                name: 'Direction',
                marker: { 
                    size: 10, 
                    color: '#FF1654',
                    symbol: 'triangle-up',
                    angle: record.direction // This might not work in all Plotly versions as a property, but let's try
                }
            });
        }

        return traces.length > 0 ? traces : null;
    }, [data, timeIndex, mode]);

    const layout = {
        title: {
            text: 'Velocity Profile',
            font: { size: 18, color: '#0A2463' }
        },
        xaxis: {
            title: mode === 'direction' ? 'Direction (°)' : (mode === 'speed' ? 'Speed (m/s)' : 'Velocity (m/s)'),
            showgrid: true,
            gridcolor: '#E5E7EB',
            zeroline: true,
            range: mode === 'direction' ? [0, 360] : undefined
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <label htmlFor="time-index">Time Index: {timeIndex + 1} / {data.length}</label>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        {data[timeIndex]?.timestamp && new Date(data[timeIndex].timestamp).toLocaleString()}
                    </p>
                </div>
                
                <div className="btn-group" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        className={`btn btn-sm ${mode === 'speed' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setMode('speed')}
                    >
                        Speed
                    </button>
                    <button 
                        className={`btn btn-sm ${mode === 'direction' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setMode('direction')}
                    >
                        Direction
                    </button>
                    <button 
                        className={`btn btn-sm ${mode === 'components' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setMode('components')}
                    >
                        Components
                    </button>
                </div>
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
