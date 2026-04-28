import React from 'react';

/**
 * Form for manual entry of missing instrument metadata
 */
function MetadataEntryForm({ initialMetadata, onMetadataUpdate }) {
    const [source, setSource] = React.useState(initialMetadata.source || 'Binary File');
    const [formData, setFormData] = React.useState(() => {
        // cellSize from Nortek binary is in raw counts (typically 50-2000);
        // from RDI it's already in meters (depthCellLength, cm→m conversion applied).
        // Heuristic: if value < 5 assume metres, otherwise convert from counts.
        const rawCell  = initialMetadata.cellSize  || 0;
        const rawBlank = initialMetadata.blankingDistance || 0;
        const cellSizeM  = rawCell  < 5 ? rawCell  : rawCell  / 256;
        const blankDistM = rawBlank < 5 ? rawBlank : rawBlank / 44;

        return {
            frequency:        initialMetadata.frequency       || 1000,
            cellSize:         cellSizeM  || 0.5,
            numCells:         initialMetadata.numCells        || 20,
            blankingDistance: blankDistM || 0.4,
        };
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
        setSource('Manual Entry');
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // formData values are already in SI units (metres, kHz, count).
        // Do NOT multiply back to raw instrument counts — the rest of the
        // app operates in SI units throughout.
        const updatedMetadata = {
            ...initialMetadata,
            frequency:        formData.frequency,
            numCells:         formData.numCells,
            cellSize:         formData.cellSize,
            blankingDistance: formData.blankingDistance,
            isComplete:       true,
            manuallyEntered:  true,
            source
        };

        // Re-calculate distance bins
        updatedMetadata.distance = calculateDistanceBins(
            formData.frequency,
            formData.blankingDistance,
            formData.cellSize,
            formData.numCells
        );

        onMetadataUpdate(updatedMetadata);
    };

    /**
     * Helper to calculate distance bins (Meters)
     * Matches logic in NortekBinaryParser but works with SI units
     */
    const calculateDistanceBins = (freq, blankDistM, cellSizeM, ncells) => {
        const cosAngle = Math.cos(25 * Math.PI / 180);
        const distance = [];
        for (let i = 0; i < ncells; i++) {
            distance.push(blankDistM * cosAngle + i * cellSizeM * cosAngle + cellSizeM * cosAngle);
        }
        return distance;
    };

    const getSourceColor = () => {
        if (source === 'Manual Entry') return 'var(--coral, #FF6B6B)';
        if (source?.toLowerCase().includes('log')) return 'var(--success, #10B981)';
        return 'var(--ocean-mid, #247BA0)';
    };

    return (
        <div className="card" style={{ borderLeft: `6px solid ${getSourceColor()}`, background: '#fcfcfc' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>📡 Instrument Deployment Configuration</h3>
                <span className="badge" style={{ 
                    backgroundColor: getSourceColor(), 
                    color: 'white', 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    fontWeight: 'bold'
                }}>
                    SOURCE: {source.toUpperCase()}
                </span>
            </div>
            <p className="mb-2 text-muted" style={{ fontSize: '0.9rem', padding: '0 1.5rem' }}>
                Verify or adjust the deployment settings below. These parameters directly affect velocity scaling and bin depth calculations.
            </p>
            
            <form onSubmit={handleSubmit} className="grid grid-2" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                <div className="form-group">
                    <label htmlFor="frequency">Instrument Frequency (kHz)</label>
                    <select id="frequency" name="frequency" value={formData.frequency} onChange={handleChange}>
                        <optgroup label="Nortek">
                            <option value="400">400 kHz</option>
                            <option value="600">600 kHz</option>
                            <option value="1000">1000 kHz</option>
                            <option value="2000">2000 kHz</option>
                        </optgroup>
                        <optgroup label="Teledyne RDI">
                            <option value="38">38 kHz</option>
                            <option value="75">75 kHz</option>
                            <option value="150">150 kHz</option>
                            <option value="300">300 kHz</option>
                            <option value="600">600 kHz</option>
                            <option value="1200">1200 kHz</option>
                            <option value="2400">2400 kHz</option>
                        </optgroup>
                    </select>
                </div>
                
                <div className="form-group">
                    <label htmlFor="numCells">Number of Cells</label>
                    <input 
                        type="number" 
                        id="numCells" 
                        name="numCells" 
                        value={formData.numCells} 
                        onChange={handleChange}
                        min="1"
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="cellSize">Cell Size (m)</label>
                    <input 
                        type="number" 
                        id="cellSize" 
                        name="cellSize" 
                        value={formData.cellSize} 
                        onChange={handleChange}
                        step="0.01"
                        min="0.01"
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="blankingDistance">Blanking Distance (m)</label>
                    <input 
                        type="number" 
                        id="blankingDistance" 
                        name="blankingDistance" 
                        value={formData.blankingDistance} 
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                    />
                </div>

                <div className="grid-full" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                    <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        Update Metadata & Calculations
                    </button>
                </div>
            </form>
        </div>
    );
}

export default MetadataEntryForm;
