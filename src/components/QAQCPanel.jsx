import React from 'react';
import { QC_FLAG_LABELS, QC_FLAGS } from '../qaqc/QAQCEngine';

export default function QAQCPanel({ onRunQAQC, qcSummary, isRunning }) {
    const [config, setConfig] = React.useState({
        velocityMax: 5.0,
        velocityMin: -5.0,
        spikeThreshold: 2.5,
        pitchMax: 20,
        rollMax: 20
    });

    const handleRun = () => {
        onRunQAQC(config);
    };

    return (
        <div className="card">
            <div className="card-header">
                <h3>🔍 Quality Control Analysis</h3>
            </div>

            <div className="alert alert-info">
                <strong>IOOS QARTOD Standards</strong>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                    Quality control tests follow Integrated Ocean Observing System (IOOS)
                    Quality Assurance/Quality Control of Real-Time Oceanographic Data (QARTOD) guidelines.
                </p>
            </div>

            <h3 className="mt-2">Configuration</h3>

            <div className="grid grid-3">
                <div>
                    <label htmlFor="vel-min">Velocity Min (m/s)</label>
                    <input
                        id="vel-min"
                        type="number"
                        step="0.1"
                        value={config.velocityMin}
                        onChange={(e) => setConfig({ ...config, velocityMin: parseFloat(e.target.value) })}
                    />
                </div>

                <div>
                    <label htmlFor="vel-max">Velocity Max (m/s)</label>
                    <input
                        id="vel-max"
                        type="number"
                        step="0.1"
                        value={config.velocityMax}
                        onChange={(e) => setConfig({ ...config, velocityMax: parseFloat(e.target.value) })}
                    />
                </div>

                <div>
                    <label htmlFor="spike">Spike Threshold (σ)</label>
                    <input
                        id="spike"
                        type="number"
                        step="0.1"
                        value={config.spikeThreshold}
                        onChange={(e) => setConfig({ ...config, spikeThreshold: parseFloat(e.target.value) })}
                    />
                </div>

                <div>
                    <label htmlFor="pitch-max">Max Pitch (°)</label>
                    <input
                        id="pitch-max"
                        type="number"
                        step="1"
                        value={config.pitchMax}
                        onChange={(e) => setConfig({ ...config, pitchMax: parseFloat(e.target.value) })}
                    />
                </div>

                <div>
                    <label htmlFor="roll-max">Max Roll (°)</label>
                    <input
                        id="roll-max"
                        type="number"
                        step="1"
                        value={config.rollMax}
                        onChange={(e) => setConfig({ ...config, rollMax: parseFloat(e.target.value) })}
                    />
                </div>
            </div>

            <button
                className="btn-success mt-2"
                onClick={handleRun}
                disabled={isRunning}
            >
                {isRunning ? '⏳ Running Analysis...' : '▶ Run QA/QC Analysis'}
            </button>

            {qcSummary && (
                <div className="mt-3">
                    <h3>Results Summary</h3>

                    <div className="stats-grid">
                        <div className="stat-card">
                            <span className="stat-value" style={{ color: 'var(--success)' }}>
                                {qcSummary.passPercent}%
                            </span>
                            <span className="stat-label">Pass</span>
                        </div>

                        <div className="stat-card">
                            <span className="stat-value" style={{ color: 'var(--warning)' }}>
                                {qcSummary.suspectPercent}%
                            </span>
                            <span className="stat-label">Suspect</span>
                        </div>

                        <div className="stat-card">
                            <span className="stat-value" style={{ color: 'var(--coral)' }}>
                                {qcSummary.failPercent}%
                            </span>
                            <span className="stat-label">Fail</span>
                        </div>

                        <div className="stat-card">
                            <span className="stat-value">{qcSummary.total}</span>
                            <span className="stat-label">Total Records</span>
                        </div>
                    </div>

                    <h3 className="mt-2">Test Details</h3>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Test</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Pass</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Suspect</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Fail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(qcSummary.testResults).map(([test, results]) => (
                                    <tr key={test} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.5rem' }}>{test}</td>
                                        <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--success)' }}>
                                            {results.pass}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--warning)' }}>
                                            {results.suspect}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--coral)' }}>
                                            {results.fail}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
