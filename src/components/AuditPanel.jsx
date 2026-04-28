import React from 'react';
import { APP_VERSION } from '../version';

/**
 * AuditPanel Component
 * Replaces the manual Excel data check workflow.
 * Provides automated statistics and a checklist for manual reviews.
 */
export default function AuditPanel({ data, metadata, auditData, setAuditData }) {
    if (!data || data.length === 0) return null;

    const first = data[0];
    const last = data[data.length - 1];
    
    const startTime = new Date(first.timestamp);
    const stopTime = new Date(last.timestamp);
    const durationMs = stopTime - startTime;
    const durationDays = durationMs / (1000 * 60 * 60 * 24);
    const durationHours = durationMs / (1000 * 60 * 60);

    // Calculate actual counts
    const actualCurrents = data.length;
    // For waves, we'd need to check if there are wave-specific records or bursts.
    // Heuristic: if instrument is AWAC, we assume wave data exists.
    const isWaveCapable = metadata.instrumentType?.toLowerCase().includes('awac');
    
    // Battery stats
    // batteryStart: median of first 5 valid readings to suppress startup transients.
    // batteryMin: true deployment nadir — the physically meaningful drain value.
    // batteryEnd: last recorded value (often inflated by post-recovery voltage rebound).
    const validBatteryValues = data.map(r => r.battery).filter(v => v != null && v > 0);
    const startWindow = validBatteryValues.slice(0, 5).sort((a, b) => a - b);
    const batteryStart = startWindow.length > 0
        ? startWindow[Math.floor(startWindow.length / 2)]
        : 0;
    const batteryMin = validBatteryValues.length > 0
        ? Math.min(...validBatteryValues)
        : 0;
    const batteryEnd = last.battery || 0;
    // Drop is start → minimum (nadir), not start → last (which rebounds after recovery)
    const batteryDrop = (batteryStart - batteryMin).toFixed(1);

    const handleCheckChange = (key, value) => {
        setAuditData(prev => ({
            ...prev,
            checks: { ...prev.checks, [key]: value }
        }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setAuditData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getStatusColor = (diffPercent) => {
        if (Math.abs(diffPercent) < 5) return 'var(--success)';
        if (Math.abs(diffPercent) < 10) return 'var(--warning)';
        return 'var(--coral)';
    };

    const actualFileSize = metadata.actualFileSizeMB || 0;
    const diffFileSize = auditData.plannedFileSize ? actualFileSize - auditData.plannedFileSize : 0;
    const sizeDiffPercent = auditData.plannedFileSize ? (diffFileSize / auditData.plannedFileSize) * 100 : 0;

    const diffEnsembles = auditData.plannedCurrentEnsembles ? actualCurrents - auditData.plannedCurrentEnsembles : 0;
    const diffPercent = auditData.plannedCurrentEnsembles ? (diffEnsembles / auditData.plannedCurrentEnsembles) * 100 : 0;

    const renderToggle = (key, label) => (
        <div className="audit-check-row">
            <span>{label}</span>
            <div className="btn-group">
                <button 
                    className={`btn-toggle ${auditData.checks[key] === true ? 'active-yes' : ''}`}
                    onClick={() => handleCheckChange(key, true)}
                >
                    Yes
                </button>
                <button 
                    className={`btn-toggle ${auditData.checks[key] === false ? 'active-no' : ''}`}
                    onClick={() => handleCheckChange(key, false)}
                >
                    No
                </button>
            </div>
        </div>
    );

    return (
        <div className="audit-panel printable-area">
            <div className="card-header no-print">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📋 Deployment Data Audit
                </h3>
                <button className="btn-primary" onClick={() => window.print()}>
                    🖨️ Print Audit Report
                </button>
            </div>

            <div className="print-only mb-3">
                <h1 style={{ textAlign: 'center' }}>Ocean Data Deployment Audit Report</h1>
                <p style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                    Generated on {new Date().toLocaleString()} • Ocean Data Viewer v{APP_VERSION}
                </p>
                <hr style={{ margin: '1rem 0', borderColor: 'var(--ocean-light)' }} />
            </div>

            <div className="grid grid-2">
                {/* Deployment Metadata Section */}
                <div className="card">
                    <h3>Project & Deployment</h3>
                    <div className="form-group mb-2">
                        <label>PROJECT NAME</label>
                        <input 
                            name="project" 
                            value={auditData.project} 
                            onChange={handleInputChange} 
                            placeholder="e.g. Fort George"
                        />
                    </div>
                    <div className="form-group mb-2">
                        <label>DEPLOYMENT ID</label>
                        <input 
                            name="deployment" 
                            value={auditData.deployment} 
                            onChange={handleInputChange} 
                            placeholder="e.g. Deployment 1"
                        />
                    </div>
                </div>

                {/* File Statistics Section */}
                <div className="card">
                    <h3>File Metadata</h3>
                    <div className="form-group mb-2">
                        <label>Expected File Size (MB)</label>
                        <input 
                            type="number"
                            name="plannedFileSize" 
                            value={auditData.plannedFileSize} 
                            onChange={handleInputChange} 
                        />
                    </div>
                    <div className="audit-stat-row">
                        <span>Actual File Size:</span>
                        <span><strong>{actualFileSize.toFixed(2)} MB</strong></span>
                    </div>
                    <div className="audit-stat-row">
                        <span>Status (5% error cutoff):</span>
                        <span className="badge" style={{ backgroundColor: getStatusColor(sizeDiffPercent), color: 'white' }}>
                            {Math.abs(sizeDiffPercent) < 5 ? 'Acceptable' : Math.abs(sizeDiffPercent) < 10 ? 'Suspect' : 'Error'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Timing & Ensembles Section */}
            <div className="card">
                <h3>Temporal & Ensemble Verification</h3>
                <div className="grid grid-2">
                    <table className="audit-table">
                        <tbody>
                            <tr>
                                <td>Start Date/Time (UTC)</td>
                                <td className="text-right"><strong>{startTime.toISOString().replace('T', ' ').slice(0, 19)}</strong></td>
                            </tr>
                            <tr>
                                <td>Stop Date/Time (UTC)</td>
                                <td className="text-right"><strong>{stopTime.toISOString().replace('T', ' ').slice(0, 19)}</strong></td>
                            </tr>
                            <tr>
                                <td>Total Time</td>
                                <td className="text-right">{durationDays.toFixed(2)} days ({durationHours.toFixed(1)} hours)</td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="audit-table">
                        <tbody>
                            <tr>
                                <td>Actual Ensembles</td>
                                <td className="text-right"><strong>{actualCurrents}</strong></td>
                            </tr>
                            <tr>
                                <td>Planned Ensembles</td>
                                <td className="text-right">
                                    <input 
                                        type="number"
                                        name="plannedCurrentEnsembles"
                                        className="inline-input"
                                        value={auditData.plannedCurrentEnsembles}
                                        onChange={handleInputChange}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>Difference</td>
                                <td className="text-right" style={{ color: getStatusColor(diffPercent) }}>
                                    {diffEnsembles} ({diffPercent.toFixed(1)}%)
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual Review Checklist */}
            <div className="grid grid-2">
                <div className="card">
                    <h3>Currents Review</h3>
                    <div className="audit-checklist">
                        {renderToggle('pressureReasonable', 'Does pressure graph look reasonable?')}
                        {renderToggle('tempReasonable', 'Does temperature graph look reasonable?')}
                        {renderToggle('pitchStable', 'Is pitch stable and < 15%?')}
                        {renderToggle('rollStable', 'Is roll stable and < 15%?')}
                        {renderToggle('headingReasonable', 'Is heading reasonable?')}
                        <div className="audit-check-row mt-1">
                            <span>Battery Voltage Drop:</span>
                            <span style={{ fontWeight: 600 }}>
                                {batteryStart.toFixed(1)}V → {batteryMin.toFixed(1)}V ({batteryDrop}V)
                                <span style={{ fontWeight: 400, fontSize: '0.8em', color: 'var(--text-light)', marginLeft: '0.5rem' }}>
                                    (final: {batteryEnd.toFixed(1)}V)
                                </span>
                            </span>
                        </div>
                        {renderToggle('voltageSmooth', 'Is the voltage drop smooth?')}
                        {renderToggle('velocityContourReasonable', 'Does velocity contour look reasonable?')}
                    </div>
                </div>

                <div className="card" style={{ opacity: isWaveCapable ? 1 : 0.5 }}>
                    <h3>Waves Review {!isWaveCapable && '(N/A)'}</h3>
                    <div className="audit-checklist">
                        {renderToggle('firstBurstInWater', 'Time of first burst in water?')}
                        {renderToggle('waveDataReasonable', 'Does wave data look reasonable?')}
                        {renderToggle('excursivePressureContinuous', 'Is plot of excursive pressure continuous?')}
                        {renderToggle('excursivePressureVaries', 'Does excursive pressure vary over time?')}
                        {renderToggle('processedWaveContinuous', 'Does processed wave show continuous line?')}
                        {renderToggle('processedWaveReasonable', 'Does processed wave data look reasonable?')}
                    </div>
                </div>
            </div>

            {/* Styles for .audit-panel, .audit-table, .audit-check-row, etc. live in index.css */}
        </div>
    );
}
