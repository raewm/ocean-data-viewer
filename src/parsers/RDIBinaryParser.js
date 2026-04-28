/**
 * RDI ADCP Binary Parser (PD0 Format)
 * 
 * Custom implementation of PD0 binary parser based on RDI specification
 * Replaces external pd0-parser dependency for Vite compatibility
 * 
 * Reference: Teledyne RDI "WorkHorse Commands and Output Data Format" manual
 */

export class RDIBinaryParser {
    constructor() {
        // PD0 Data Type IDs (from RDI specification)
        this.HEADER_ID = 0x7F;  // First byte of ensemble header
        this.FIXED_LEADER_ID = 0x0000;
        this.VARIABLE_LEADER_ID = 0x0080;  // PD0: file bytes 0x80 0x00 → LE uint16 = 0x0080
        this.VELOCITY_ID = 0x0100;
        this.CORRELATION_ID = 0x0200;
        this.ECHO_INTENSITY_ID = 0x0300;
        this.PERCENT_GOOD_ID = 0x0400;
    }

    /**
     * Parse RDI PD0 binary file(s)
     * @param {File[]} files - Array of file objects
     * @returns {Promise<Object>} Parsed data in standard format
     */
    async parse(files) {
        try {
            const filesArray = Array.isArray(files) ? files : [files];
            let allEnsembles = [];
            let firstFileName = '';
            let logMetadata = null;

            for (const file of filesArray) {
                const ext = file.name.split('.').pop().toLowerCase();
                
                // If it's a deployment log/text file, parse it for settings
                if (ext === 'log' || ext === 'txt' || ext === 'scl') {
                    const text = await file.text();
                    const extracted = this.parseDeploymentLog(text);
                    if (extracted) {
                        logMetadata = { ...logMetadata, ...extracted };
                        console.log('[RDI Parser] Extracted from log:', file.name, extracted);
                    }
                    continue;
                }

                // Check if file is an RDI binary segment
                if (!RDIBinaryParser.canParse(file)) continue;
                
                if (!firstFileName) firstFileName = file.name;

                console.log('[RDI Parser] Scanning file:', file.name, 'Size:', file.size, 'bytes');

                const buffer = await file.arrayBuffer();
                const dataView = new DataView(buffer);
                const fileEnsembles = this.parseEnsembles(dataView);
                
                allEnsembles = [...allEnsembles, ...fileEnsembles];
                console.log(`[RDI Parser] Found ${fileEnsembles.length} ensembles in ${file.name}`);
            }

            if (allEnsembles.length === 0) {
                throw new Error('No valid RDI ensembles found in the provided files.');
            }

            console.log('[RDI Parser] Total ensembles found:', allEnsembles.length);

            // Extract metadata from first valid ensemble, merging with log info
            const metadata = this.extractMetadata(allEnsembles[0], firstFileName, logMetadata);
            console.log('[RDI Parser] Metadata:', metadata);

            // Convert ensembles to standard data format
            const data = this.normalizeData(allEnsembles, metadata);
            console.log('[RDI Parser] Normalized to', data.length, 'records');

            // MANDATORY: Sort data by timestamp to fix jumbled chronology
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            return {
                metadata,
                data,
                instrumentType: 'RDI',
                format: 'binary'
            };
        } catch (error) {
            console.error('Error parsing RDI binary files:', error);
            throw new Error(`Failed to parse RDI binary data: ${error.message}`);
        }
    }

    /**
     * Parse all ensembles from the binary file
     */
    parseEnsembles(dataView) {
        const ensembles = [];
        let offset = 0;

        while (offset < dataView.byteLength - 6) {
            try {
                // PD0 sync requires TWO consecutive 0x7F bytes
                const byte0 = dataView.getUint8(offset);
                const byte1 = dataView.getUint8(offset + 1);

                if (byte0 !== this.HEADER_ID || byte1 !== this.HEADER_ID) {
                    offset++;
                    continue;
                }

                // Read ensemble
                const ensemble = this.parseEnsemble(dataView, offset);
                if (ensemble) {
                    ensembles.push(ensemble);
                    offset += ensemble.totalBytes;
                } else {
                    offset++;
                }
            } catch (e) {
                // Skip to next byte if parsing fails
                offset++;
            }
        }

        return ensembles;
    }

    /**
     * Parse a single ensemble
     */
    parseEnsemble(dataView, offset) {
        const startOffset = offset;

        // Header (6 bytes): two sync bytes 0x7F 0x7F
        const headerId = dataView.getUint8(offset);
        const dataSourceId = dataView.getUint8(offset + 1);

        if (headerId !== this.HEADER_ID || dataSourceId !== this.HEADER_ID) {
            return null;
        }

        const totalBytes = dataView.getUint16(offset + 2, true);
        const spare = dataView.getUint8(offset + 4);
        const numDataTypes = dataView.getUint8(offset + 5);

        // Read offsets for each data type
        const dataTypeOffsets = [];
        let offsetPos = offset + 6;
        for (let i = 0; i < numDataTypes; i++) {
            const dataOffset = dataView.getUint16(offsetPos, true);
            dataTypeOffsets.push(dataOffset);
            offsetPos += 2;
        }

        // Parse each data type
        const ensemble = {
            totalBytes,
            numDataTypes,
            fixedLeader: null,
            variableLeader: null,
            velocity: null,
            correlation: null,
            echoIntensity: null,
            percentGood: null
        };

        // Debug: log first ensemble's data type IDs so we can verify constants
        const isFirst = (startOffset < 10000);
        if (isFirst) {
            const ids = dataTypeOffsets.map(o => '0x' + dataView.getUint16(startOffset + o, true).toString(16).padStart(4, '0'));
            console.log('[RDI] First ensemble data type IDs:', ids,
                '| Expected FL=0x0000 VL=0x0080 Vel=0x0100');
        }

        for (const dataOffset of dataTypeOffsets) {
            const absOffset = startOffset + dataOffset;
            const dataTypeId = dataView.getUint16(absOffset, true);

            switch (dataTypeId) {
                case this.FIXED_LEADER_ID:
                    ensemble.fixedLeader = this.parseFixedLeader(dataView, absOffset);
                    break;
                case this.VARIABLE_LEADER_ID:
                    ensemble.variableLeader = this.parseVariableLeader(dataView, absOffset);
                    break;
                case this.VELOCITY_ID:
                    ensemble.velocity = this.parseVelocityData(dataView, absOffset, ensemble.fixedLeader);
                    break;
                case this.CORRELATION_ID:
                    ensemble.correlation = this.parseCorrelationData(dataView, absOffset, ensemble.fixedLeader);
                    break;
                case this.ECHO_INTENSITY_ID:
                    ensemble.echoIntensity = this.parseEchoIntensityData(dataView, absOffset, ensemble.fixedLeader);
                    break;
                case this.PERCENT_GOOD_ID:
                    ensemble.percentGood = this.parsePercentGoodData(dataView, absOffset, ensemble.fixedLeader);
                    break;
            }
        }

        return ensemble;
    }

    /**
     * Parse Fixed Leader data
     */
    parseFixedLeader(dataView, offset) {
        offset += 2; // Skip ID

        return {
            cpuFirmwareVersion: dataView.getUint8(offset),
            cpuFirmwareRevision: dataView.getUint8(offset + 1),
            systemConfiguration: {
                frequency: this.getFrequency(dataView.getUint8(offset + 2)),
                beamPattern: (dataView.getUint8(offset + 2) & 0x10) ? 'Convex' : 'Concave',
                sensorConfig: dataView.getUint8(offset + 3),
            },
            realSimFlag: dataView.getUint8(offset + 4),
            lagLength: dataView.getUint8(offset + 5),
            numberOfBeams: dataView.getUint8(offset + 6),
            numberOfCells: dataView.getUint8(offset + 7),
            pingsPerEnsemble: dataView.getUint16(offset + 8, true),
            depthCellLength: dataView.getUint16(offset + 10, true) * 0.01, // cm to m
            blankAfterTransmit: dataView.getUint16(offset + 12, true) * 0.01, // cm to m
            profilingMode: dataView.getUint8(offset + 14),
            lowCorrThresh: dataView.getUint8(offset + 15),
            numCodeReps: dataView.getUint8(offset + 16),
            percentGoodMin: dataView.getUint8(offset + 17),
            errorVelocityMax: dataView.getUint16(offset + 18, true),
            timeBetweenPings: this.parseTime(dataView, offset + 20),
            coordinateTransform: (dataView.getUint8(offset + 23) >> 3) & 0x03,
            headingAlignment: dataView.getInt16(offset + 24, true) * 0.01,
            headingBias: dataView.getInt16(offset + 26, true) * 0.01,
            sensorSource: dataView.getUint8(offset + 28),
            sensorsAvailable: dataView.getUint8(offset + 29),
            bin1Distance: dataView.getUint16(offset + 30, true) * 0.01, // cm to m
            xmitPulseLength: dataView.getUint16(offset + 32, true) * 0.01, // cm to m
            refLayerStart: dataView.getUint8(offset + 34),
            refLayerEnd: dataView.getUint8(offset + 35),
            falseLockThresh: dataView.getUint8(offset + 36),
            cpuSerialNumber: this.readString(dataView, offset + 50, 8),
            beamAngle: dataView.getUint8(offset + 48),
        };
    }

    /**
     * Parse Variable Leader data
     */
    parseVariableLeader(dataView, absOffset) {
        return {
            ensembleNumber: dataView.getUint16(absOffset + 2, true),
            rtcYear: dataView.getUint8(absOffset + 4),
            rtcMonth: dataView.getUint8(absOffset + 5),
            rtcDay: dataView.getUint8(absOffset + 6),
            rtcHour: dataView.getUint8(absOffset + 7),
            rtcMinute: dataView.getUint8(absOffset + 8),
            rtcSecond: dataView.getUint8(absOffset + 9),
            rtcHundredths: dataView.getUint8(absOffset + 10),
            ensembleMSB: dataView.getUint8(absOffset + 11),
            bitResult: dataView.getUint16(absOffset + 12, true),
            speedOfSound: dataView.getUint16(absOffset + 14, true) * 0.1, // 0.1 m/s units
            depthOfTransducer: dataView.getUint16(absOffset + 16, true) * 0.1, // dm to m
            heading: dataView.getUint16(absOffset + 18, true) * 0.01, // 0.01 degree units
            pitch: dataView.getInt16(absOffset + 20, true) * 0.01, // 0.01 degree units
            roll: dataView.getInt16(absOffset + 22, true) * 0.01, // 0.01 degree units
            salinity: dataView.getUint16(absOffset + 24, true),
            temperature: dataView.getInt16(absOffset + 26, true) * 0.01, // 0.01 °C units
            mptMinutes: dataView.getUint8(absOffset + 28),
            mptSeconds: dataView.getUint8(absOffset + 29),
            mptHundredths: dataView.getUint8(absOffset + 30),
            headingStdDev: dataView.getUint8(absOffset + 31),
            pitchStdDev: dataView.getUint8(absOffset + 32),
            rollStdDev: dataView.getUint8(absOffset + 33),
            // ADC Channel 0 = System Battery Voltage (PD0 spec: ADC_count × 0.4048 V)
            adcChannel0: dataView.getUint8(absOffset + 34),
            adcChannel1: dataView.getUint8(absOffset + 35),
            adcChannel2: dataView.getUint8(absOffset + 36),
            adcChannel3: dataView.getUint8(absOffset + 37),
            adcChannel4: dataView.getUint8(absOffset + 38),
            adcChannel5: dataView.getUint8(absOffset + 39),
            adcChannel6: dataView.getUint8(absOffset + 40),
            adcChannel7: dataView.getUint8(absOffset + 41),
            error: dataView.getUint32(absOffset + 42, true),
            // +46–47: Reserved (2 bytes per PD0 spec)
            status: dataView.getUint16(absOffset + 46, true),
            pressure: dataView.getUint32(absOffset + 48, true) * 0.001, // 0.001 dbar per count
            pressureVariance: dataView.getUint32(absOffset + 52, true)
        };
    }

    /**
     * Parse velocity data for all beams and cells
     */
    parseVelocityData(dataView, offset, fixedLeader) {
        if (!fixedLeader) return null;

        offset += 2; // Skip ID
        const numBeams = fixedLeader.numberOfBeams;
        const numCells = fixedLeader.numberOfCells;

        const velocity = {};
        for (let beam = 0; beam < numBeams; beam++) {
            const beamData = [];
            for (let cell = 0; cell < numCells; cell++) {
                const cellOffset = offset + (cell * numBeams + beam) * 2;
                const vel = dataView.getInt16(cellOffset, true);
                // Convert mm/s to m/s, handle bad velocity (-32768)
                beamData.push(vel === -32768 ? null : vel * 0.001);
            }
            velocity[`beam${beam + 1}`] = beamData;
        }

        return velocity;
    }

    /**
     * Parse correlation data
     */
    parseCorrelationData(dataView, offset, fixedLeader) {
        if (!fixedLeader) return null;

        offset += 2; // Skip ID
        const numBeams = fixedLeader.numberOfBeams;
        const numCells = fixedLeader.numberOfCells;

        const correlation = {};
        for (let beam = 0; beam < numBeams; beam++) {
            const beamData = [];
            for (let cell = 0; cell < numCells; cell++) {
                const cellOffset = offset + (cell * numBeams + beam);
                beamData.push(dataView.getUint8(cellOffset));
            }
            correlation[`beam${beam + 1}`] = beamData;
        }

        return correlation;
    }

    /**
     * Parse echo intensity data
     */
    parseEchoIntensityData(dataView, offset, fixedLeader) {
        if (!fixedLeader) return null;

        offset += 2; // Skip ID
        const numBeams = fixedLeader.numberOfBeams;
        const numCells = fixedLeader.numberOfCells;

        const echo = {};
        for (let beam = 0; beam < numBeams; beam++) {
            const beamData = [];
            for (let cell = 0; cell < numCells; cell++) {
                const cellOffset = offset + (cell * numBeams + beam);
                beamData.push(dataView.getUint8(cellOffset));
            }
            echo[`beam${beam + 1}`] = beamData;
        }

        return echo;
    }

    /**
     * Parse percent good data
     */
    parsePercentGoodData(dataView, offset, fixedLeader) {
        if (!fixedLeader) return null;

        offset += 2; // Skip ID
        const numBeams = fixedLeader.numberOfBeams;
        const numCells = fixedLeader.numberOfCells;

        const percentGood = {};
        for (let beam = 0; beam < numBeams; beam++) {
            const beamData = [];
            for (let cell = 0; cell < numCells; cell++) {
                const cellOffset = offset + (cell * numBeams + beam);
                beamData.push(dataView.getUint8(cellOffset));
            }
            percentGood[`beam${beam + 1}`] = beamData;
        }

        return percentGood;
    }

    /**
     * Extract metadata from first ensemble
     */
    /**
     * Extract metadata from an ensemble, optionally overriding with log file data
     */
    extractMetadata(ensemble, filename, logOverrides = null) {
        const fl = ensemble.fixedLeader;

        let frequency     = fl.systemConfiguration.frequency;
        let numCells      = fl.numberOfCells;
        let cellSize      = fl.depthCellLength;       // already in metres
        let blanking      = fl.blankAfterTransmit;   // already in metres
        let source        = 'Binary File';

        // Override with log data if available (log data often more reliable for deployment settings)
        if (logOverrides) {
            if (logOverrides.numCells) numCells = logOverrides.numCells;
            if (logOverrides.cellSize) cellSize = logOverrides.cellSize;
            if (logOverrides.blankingDistance) blanking = logOverrides.blankingDistance;
            source = 'Deployment Log';
        }

        const beamAngle = fl.beamAngle || 20;

        // Calculate range bins (centre of each depth cell)
        const distance = [];
        for (let i = 0; i < numCells; i++) {
            distance.push(fl.bin1Distance + i * cellSize);
        }

        return {
            instrumentType:    'RDI_ADCP',
            manufacturer:      'Teledyne RDI',
            model:             this.getModelName(frequency),
            serialNumber:      fl.cpuSerialNumber?.trim() || 'Unknown',
            filename,
            dataFormat:        'PD0 Binary',
            firmwareVersion:   `${fl.cpuFirmwareVersion}.${fl.cpuFirmwareRevision}`,
            frequency,
            beamAngle,
            numBeams:          fl.numberOfBeams,
            numCells,
            cellSize,
            blankingDistance:  blanking,
            bin1Distance:      fl.bin1Distance,
            coordinateSystem:  this.getCoordinateSystem(fl.coordinateTransform),
            distance,
            source,
            // Mark complete when the essential profiling parameters are known
            isComplete:        !!(frequency && numCells && cellSize),
        };
    }

    /**
     * Parse RDI deployment log commands (WN, WS, WF etc.)
     * Example provided: ">WN34", ">WS25", ">WF44"
     */
    parseDeploymentLog(text) {
        const result = {};
        
        // Number of cells (WN[n])
        const wnMatch = text.match(/[>|]\s*WN\s*(\d+)/i);
        if (wnMatch) result.numCells = parseInt(wnMatch[1]);

        // Cell size in cm (WS[n]) -> convert to m
        const wsMatch = text.match(/[>|]\s*WS\s*(\d+)/i);
        if (wsMatch) result.cellSize = parseInt(wsMatch[1]) / 100;

        // Blank after transmit in cm (WF[n]) -> convert to m
        const wfMatch = text.match(/[>|]\s*WF\s*(\d+)/i);
        if (wfMatch) result.blankingDistance = parseInt(wfMatch[1]) / 100;

        return Object.keys(result).length > 0 ? result : null;
    }

    /**
     * Convert ensembles to standard data format
     */
    normalizeData(ensembles, metadata) {
        const data = [];

        console.log('[RDI Parser] Normalizing', ensembles.length, 'ensembles...');

        // Battery: PD0 ADC Channel 0 = System Battery Voltage; scale = 0.4048 V per count.
        // Extract raw values first for median filtering to suppress transient dropouts.
        const rawBattery = ensembles.map(e => {
            if (!e.variableLeader) return null;
            return e.variableLeader.adcChannel0 * 0.4048;
        });

        // Normalize with median filter (window 5) to suppress transient dropouts
        for (let i = 0; i < ensembles.length; i++) {
            const ensemble = ensembles[i];
            const vl = ensemble.variableLeader;
            if (!vl) continue;

            const window = [];
            for (let j = i - 2; j <= i + 2; j++) {
                if (j >= 0 && j < rawBattery.length && rawBattery[j] !== null) {
                    window.push(rawBattery[j]);
                }
            }
            window.sort((a, b) => a - b);
            const filteredBattery = window.length > 0 ? window[Math.floor(window.length / 2)] : null;

            const record = {
                timestamp: this.parseTimestamp(vl),
                heading: vl.heading,
                pitch: vl.pitch,
                roll: vl.roll,
                temperature: vl.temperature,
                pressure: vl.pressure,
                soundSpeed: vl.speedOfSound,
                salinity: vl.salinity,
                error: vl.error,
                status: vl.status,
                battery: filteredBattery
            };

            // Add velocity data — stored under 'velocities' with keys v1/v2/v3/v4
            // so TimeSeriesPlot and ProfilePlot can find them consistently
            if (ensemble.velocity) {
                record.velocities = {};
                for (let i = 1; i <= metadata.numBeams; i++) {
                    record.velocities[`v${i}`] = ensemble.velocity[`beam${i}`];
                }
            }

            // Add quality metrics
            record.echoIntensity = ensemble.echoIntensity;
            record.correlation = ensemble.correlation;
            record.percentGood = ensemble.percentGood;

            data.push(record);
        }

        console.log('[RDI Parser] Created', data.length, 'data records');
        if (data.length > 0) {
            console.log('[RDI Parser] First record sample:', {
                timestamp: data[0].timestamp,
                heading: data[0].heading,
                temperature: data[0].temperature,
                hasVelocity1: !!data[0].velocity1
            });
        }

        return data;
    }

    /**
     * Parse timestamp from variable leader
     */
    parseTimestamp(vl) {
        const year = vl.rtcYear + 2000; // Y2K offset
        const date = new Date(
            year,
            vl.rtcMonth - 1,
            vl.rtcDay,
            vl.rtcHour,
            vl.rtcMinute,
            vl.rtcSecond,
            vl.rtcHundredths * 10
        );
        return date.toISOString();
    }

    /**
     * Get frequency from system configuration byte
     */
    getFrequency(sysConfig) {
        const freqCode = sysConfig & 0x07;
        const frequencies = {
            0: 75,
            1: 150,
            2: 300,
            3: 600,
            4: 1200,
            5: 2400,
            6: 38
        };
        return frequencies[freqCode] || 600;
    }

    /**
     * Get model name from frequency
     */
    getModelName(frequency) {
        const models = {
            75: 'Workhorse 75kHz',
            150: 'Workhorse 150kHz',
            300: 'Workhorse 300kHz',
            600: 'Workhorse 600kHz',
            1200: 'Workhorse 1200kHz',
            2400: 'Workhorse 2400kHz',
        };
        return models[frequency] || 'Workhorse ADCP';
    }

    /**
     * Get coordinate system name
     */
    getCoordinateSystem(transform) {
        const systems = {
            0: 'Beam',
            1: 'Instrument',
            2: 'Ship',
            3: 'Earth'
        };
        return systems[transform] || 'Unknown';
    }

    /**
     * Parse time value (3 bytes: minutes, seconds, hundredths)
     */
    parseTime(dataView, offset) {
        const minutes = dataView.getUint8(offset);
        const seconds = dataView.getUint8(offset + 1);
        const hundredths = dataView.getUint8(offset + 2);
        return minutes * 60 + seconds + hundredths * 0.01;
    }

    /**
     * Read ASCII string from DataView
     */
    readString(dataView, offset, length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            const char = dataView.getUint8(offset + i);
            if (char === 0) break;
            str += String.fromCharCode(char);
        }
        return str;
    }

    /**
     * Check if file is likely an RDI PD0 binary file
     */
    static canParse(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        return ['000', '001', '002', '003', '004', '005', 'pd0', 'pdo'].includes(ext);
    }
}
