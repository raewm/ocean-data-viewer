import React from 'react';
import Plot from 'react-plotly.js';

/**
 * Renders a Power Spectral Density (PSD) plot for current velocities
 * Helps identify periodicities (waves, tides, etc.)
 */
/**
 * Basic PSD via Discrete Fourier Transform.
 * Limited to first 512 points for UI responsiveness.
 * samplingRateHz should be derived from the actual ensemble interval.
 */
function calculatePSD(signal, samplingRateHz = 1) {
    const N = Math.min(signal.length, 512);
    const mean = signal.slice(0, N).reduce((a, b) => a + b, 0) / N;
    const detrended = signal.slice(0, N).map(v => v - mean);

    const frequencies = [];
    const power = [];

    for (let k = 0; k < N / 2; k++) {
        let re = 0;
        let im = 0;
        for (let n = 0; n < N; n++) {
            const angle = (2 * Math.PI * k * n) / N;
            re += detrended[n] * Math.cos(angle);
            im -= detrended[n] * Math.sin(angle);
        }
        frequencies.push((k * samplingRateHz) / N);
        power.push((re * re + im * im) / N);
    }

    return { frequencies, power };
}

function SpectrumPlot({ data }) {
    const plotData = React.useMemo(() => {
        if (!data || data.length < 16) return null;

        // Extract velocity series
        // Try to find the first beam that has non-zero values to use as the signal
        const signal = data.map(r => {
            if (r.speed !== undefined) return r.speed;
            
            // Check normalized keys (v1, v2, v3...)
            const vKeys = ['v1', 'v2', 'v3', 'v4', 'velocity1', 'velocity2', 'velocity3'];
            for (const key of vKeys) {
                const val = r.velocities?.[key]?.[0];
                if (val !== undefined && val !== null) return val;
            }
            
            return 0;
        });

        // Estimate sampling rate from timestamps if available
        let samplingRateHz = 1;
        if (data.length >= 2 && data[0].timestamp && data[1].timestamp) {
            const dtMs = new Date(data[1].timestamp) - new Date(data[0].timestamp);
            if (dtMs > 0) samplingRateHz = 1000 / dtMs;
        }

        const psd = calculatePSD(signal, samplingRateHz);
        
        return [{
            x: psd.frequencies,
            y: psd.power,
            type: 'scatter',
            mode: 'lines',
            name: 'Velocity PSD',
            line: { color: 'var(--ocean-mid)', width: 2 },
            fill: 'tozeroy',
            fillcolor: 'rgba(36, 123, 160, 0.1)'
        }];
    }, [data]);

    const layout = {
        title: {
            text: 'Velocity Power Spectrum (PSD)',
            font: { size: 18, color: '#0A2463' }
        },
        xaxis: {
            title: 'Frequency (Hz)',
            type: 'log',
            showgrid: true,
            gridcolor: '#E5E7EB'
        },
        yaxis: {
            title: {
                text: 'Power (m²/s²/Hz)',
                standoff: 20
            },
            type: 'log',
            showgrid: true,
            gridcolor: '#E5E7EB'
        },
        plot_bgcolor: '#F9FAFB',
        margin: { l: 100, r: 40, b: 80, t: 80 }
    };

    if (!plotData) {
        return (
            <div className="card">
                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                    Not enough data points for spectral analysis (minimum 16 required).
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3>🌊 Current Spectrum</h3>
            </div>
            <p className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>
                Frequency-domain analysis of the primary velocity component. Peaks indicate dominant periodicities like waves or tides.
            </p>
            <Plot
                data={plotData}
                layout={layout}
                config={{ responsive: true }}
                style={{ width: '100%', height: '500px' }}
            />
        </div>
    );
}

export default SpectrumPlot;
