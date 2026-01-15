import React from 'react';
import FileUploader from './components/FileUploader';
import TimeRangeSelector from './components/TimeRangeSelector';
import QAQCPanel from './components/QAQCPanel';
import ExportPanel from './components/ExportPanel';
import TimeSeriesPlot from './components/TimeSeriesPlot';
import ProfilePlot from './components/ProfilePlot';
import DataTable from './components/DataTable';
import { ParserFactory } from './parsers/ParserFactory';
import { QAQCEngine } from './qaqc/QAQCEngine';
import { filterByTimeRange } from './utils/dataProcessing';

function App() {
    const [rawData, setRawData] = React.useState(null);
    const [filteredData, setFilteredData] = React.useState(null);
    const [metadata, setMetadata] = React.useState({});
    const [qcResults, setQcResults] = React.useState(null);
    const [qcSummary, setQcSummary] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('timeseries');
    const [selectedParameter, setSelectedParameter] = React.useState('velocity');
    const [timeRange, setTimeRange] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isRunningQC, setIsRunningQC] = React.useState(false);

    const chartRefs = {
        timeseries: React.useRef(),
        profile: React.useRef()
    };

    // Handle file selection
    const handleFilesSelected = async (files) => {
        setIsLoading(true);

        try {
            const result = await ParserFactory.parse(files);

            setRawData(result.data);
            setFilteredData(result.data);
            setMetadata(result.metadata);
            setQcResults(null);
            setQcSummary(null);

            // Set initial time range
            if (result.data.length > 0) {
                const timestamps = result.data.map(r => new Date(r.timestamp)).filter(t => !isNaN(t));
                if (timestamps.length > 0) {
                    setTimeRange({
                        start: new Date(Math.min(...timestamps)).toISOString(),
                        end: new Date(Math.max(...timestamps)).toISOString()
                    });
                }
            }

            alert(`✓ Successfully loaded ${result.data.length} records from ${result.detectedType} instrument`);
        } catch (error) {
            console.error('Error parsing files:', error);
            alert(`Error loading files: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle time range change
    const handleTimeRangeChange = (newRange) => {
        setTimeRange(newRange);

        if (rawData) {
            const filtered = filterByTimeRange(rawData, newRange.start, newRange.end);
            setFilteredData(filtered);

            // Re-run QC if it was previously run
            if (qcResults) {
                alert('Time range changed. Please re-run QA/QC analysis for the new range.');
                setQcResults(null);
                setQcSummary(null);
            }
        }
    };

    // Handle QA/QC analysis
    const handleRunQAQC = (config) => {
        if (!filteredData || filteredData.length === 0) {
            alert('No data available for QC analysis');
            return;
        }

        setIsRunningQC(true);

        // Run in timeout to allow UI to update
        setTimeout(() => {
            try {
                const qcEngine = new QAQCEngine({
                    velocity: {
                        min: config.velocityMin,
                        max: config.velocityMax,
                        suspectMin: config.velocityMin * 0.8,
                        suspectMax: config.velocityMax * 0.8
                    },
                    spikeThreshold: config.spikeThreshold,
                    pitch: {
                        max: config.pitchMax,
                        suspect: config.pitchMax * 0.75
                    },
                    roll: {
                        max: config.rollMax,
                        suspect: config.rollMax * 0.75
                    }
                });

                const results = qcEngine.runAllTests(filteredData);
                const summary = qcEngine.generateSummary(results);

                setQcResults(results);
                setQcSummary(summary);

                alert('✓ QA/QC analysis complete');
            } catch (error) {
                console.error('Error running QC:', error);
                alert(`Error running QC: ${error.message}`);
            } finally {
                setIsRunningQC(false);
            }
        }, 100);
    };

    return (
        <div className="app-container">
            {/* Header */}
            <div className="app-header">
                <h1>🌊 Ocean Data Viewer</h1>
                <p>Oceanographic Current Meter Data Analysis & Quality Control</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.8 }}>
                    Supports Nortek Aquadopp, AWAC, and Teledyne RDI Workhorse ADCP instruments
                </p>
            </div>

            {/* File Upload */}
            <FileUploader onFilesSelected={handleFilesSelected} />

            {isLoading && (
                <div className="card">
                    <div className="spinner"></div>
                    <p className="text-center text-muted">Loading and parsing data...</p>
                </div>
            )}

            {/* Main Content - Only show if data is loaded */}
            {filteredData && filteredData.length > 0 && (
                <>
                    {/* Metadata Display */}
                    <div className="card">
                        <div className="card-header">
                            <h3>ℹ️ Dataset Information</h3>
                        </div>
                        <div className="grid grid-3">
                            <div className="stat-card">
                                <span className="stat-value">{filteredData.length}</span>
                                <span className="stat-label">Records</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{metadata.instrumentType || 'Unknown'}</span>
                                <span className="stat-label">Instrument Type</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">
                                    {metadata.fields?.length || Object.keys(filteredData[0] || {}).length}
                                </span>
                                <span className="stat-label">Parameters</span>
                            </div>
                        </div>
                    </div>

                    {/* Time Range Selector */}
                    <TimeRangeSelector
                        data={rawData}
                        onRangeChange={handleTimeRangeChange}
                        currentRange={timeRange}
                    />

                    {/* QA/QC Panel */}
                    <QAQCPanel
                        onRunQAQC={handleRunQAQC}
                        qcSummary={qcSummary}
                        isRunning={isRunningQC}
                    />

                    {/* Visualization Tabs */}
                    <div className="card">
                        <div className="tabs">
                            <button
                                className={`tab ${activeTab === 'timeseries' ? 'active' : ''}`}
                                onClick={() => setActiveTab('timeseries')}
                            >
                                📈 Time Series
                            </button>
                            <button
                                className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
                                onClick={() => setActiveTab('profile')}
                            >
                                📊 Profile
                            </button>
                            <button
                                className={`tab ${activeTab === 'table' ? 'active' : ''}`}
                                onClick={() => setActiveTab('table')}
                            >
                                📋 Data Table
                            </button>
                        </div>

                        {activeTab === 'timeseries' && (
                            <>
                                <div style={{ marginBottom: '1rem', padding: '0 1.5rem' }}>
                                    <label htmlFor="parameter-select">Parameter to Display</label>
                                    <select
                                        id="parameter-select"
                                        value={selectedParameter}
                                        onChange={(e) => setSelectedParameter(e.target.value)}
                                    >
                                        <option value="velocity">Velocity</option>
                                        {filteredData[0]?.temperature !== undefined && <option value="temperature">Temperature</option>}
                                        {filteredData[0]?.heading !== undefined && <option value="heading">Heading</option>}
                                        {filteredData[0]?.pitch !== undefined && <option value="pitch">Pitch</option>}
                                        {filteredData[0]?.roll !== undefined && <option value="roll">Roll</option>}
                                        {filteredData[0]?.pressure !== undefined && <option value="pressure">Pressure</option>}
                                    </select>
                                </div>
                                <TimeSeriesPlot
                                    data={filteredData}
                                    qcResults={qcResults}
                                    parameter={selectedParameter}
                                />
                            </>
                        )}

                        {activeTab === 'profile' && (
                            <ProfilePlot data={filteredData} timeIndex={0} />
                        )}

                        {activeTab === 'table' && (
                            <DataTable data={filteredData} qcResults={qcResults} />
                        )}
                    </div>

                    {/* Export Panel */}
                    <ExportPanel
                        data={filteredData}
                        metadata={metadata}
                        qcResults={qcResults}
                        qcSummary={qcSummary}
                        chartRefs={chartRefs}
                    />
                </>
            )}

            {/* Footer */}
            <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: 'var(--text-light)',
                fontSize: '0.85rem'
            }}>
                <p>Ocean Data Viewer v1.0 • QA/QC based on IOOS QARTOD standards</p>
            </div>
        </div>
    );
}

export default App;
