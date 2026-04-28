import React from 'react';
import Plot from 'react-plotly.js';

/**
 * Renders a 2D Contour (Heatmap) of velocity profiles over time
 * Y-axis: Depth (m) or Bin Number
 * X-axis: Time
 * Z-axis: Velocity Magnitude
 */
function ContourPlot({ data, metadata }) {
    const plotData = React.useMemo(() => {
        if (!data || data.length === 0) return null;

        // Check for profile data
        const sampleRecord = data[0];
        if (!sampleRecord.velocities) return null;

        // Find a velocity key that has array data (length >= 1)
        const velocityKey = Object.keys(sampleRecord.velocities).find(key =>
            Array.isArray(sampleRecord.velocities[key]) && sampleRecord.velocities[key].length >= 1
        );

        if (!velocityKey) return null;

        const timestamps = data.map(r => r.timestamp);
        const yAxis = metadata.distance && metadata.distance.length > 0 
            ? metadata.distance 
            : Array.from({ length: sampleRecord.velocities[velocityKey].length }, (_, i) => i + 1);

        // Prepare Z matrix (rows = depth, cols = time)
        const z = [];
        const numBins = sampleRecord.velocities[velocityKey].length;

        for (let bin = 0; bin < numBins; bin++) {
            const row = data.map(record => {
                const vel = record.velocities?.[velocityKey]?.[bin];
                return (vel === undefined || vel === null) ? null : vel;
            });
            z.push(row);
        }

        return [{
            z: z,
            x: timestamps,
            y: yAxis,
            type: 'heatmap',
            colorscale: 'Viridis',
            colorbar: {
                title: 'm/s',
                titleside: 'right'
            },
            hovertemplate: 'Time: %{x}<br>Depth: %{y}m<br>Velocity: %{z} m/s<extra></extra>'
        }];
    }, [data, metadata]);

    const layout = {
        title: {
            text: 'Velocity Contour Plot',
            font: { size: 18, color: '#0A2463' }
        },
        xaxis: {
            title: 'Time',
            showgrid: false
        },
        yaxis: {
            title: {
                text: metadata.distance?.length > 0 ? 'Depth (m)' : 'Bin Number',
                standoff: 20
            },
            autorange: 'reversed'
        },
        plot_bgcolor: '#F9FAFB',
        margin: { l: 100, r: 100, b: 80, t: 80 }
    };

    if (!plotData) {
        return (
            <div className="card">
                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                    No profile data available for contour plot.
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <Plot
                data={plotData}
                layout={layout}
                config={{ responsive: true }}
                style={{ width: '100%', height: '500px' }}
            />
        </div>
    );
}

export default ContourPlot;
