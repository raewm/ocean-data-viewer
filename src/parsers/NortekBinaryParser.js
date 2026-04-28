/**
 * Nortek Binary Parser
 * 
 * Parses binary files from Nortek instruments (AWAC, Aquadopp, Vector)
 * Based on Nortek System Integrator Guide and IMOS toolbox implementation
 * 
 * Supported formats:
 * - .wpr (AWAC)
 * - .prf (Aquadopp Profiler)
 * - .aqd (Aquadopp)
 * - .vec (Vector)
 */

import { NortekParser } from './NortekParser';

export class NortekBinaryParser {
    constructor() {
        // Sector IDs from Nortek specification
        this.SECTOR_IDS = {
            USER_CONFIG: 0x00,      // User configuration
            VELOCITY_DATA: 0x01,    // Velocity data
            HEAD_CONFIG: 0x04,      // Head configuration
            HARDWARE_CONFIG: 0x05,  // Hardware configuration
            AQUADOPP_VELOCITY: 0x21, // Aquadopp profiler velocity (33)
            AWAC_VELOCITY: 0x20,    // AWAC velocity (32)
            AWAC_WAVE: 0x36,        // AWAC wave data (54)
            HR_VELOCITY: 0x2A,      // HR Profiler velocity (42)
        };

        this.SYNC_BYTE = 0xA5;
        this.textParser = new NortekParser();
    }

    /**
     * Parse Nortek binary file(s)
     * @param {File[]} files - Array of file objects
     * @returns {Promise<Object>} Parsed data in standard format
     */
    async parse(files) {
        try {
            const filesArray = Array.isArray(files) ? files : [files];
            let allSectors = [];
            let textMetadata = {};

            for (const file of filesArray) {
                const ext = file.name.split('.').pop().toLowerCase();
                
                // If it's a text metadata file, parse it for sidecar info
                if (ext === 'log' || ext === 'dep' || ext === 'hdr') {
                    const content = await file.text();
                    const meta = this.textParser.parseMetadata(content);
                    textMetadata = { ...textMetadata, ...meta };
                    continue;
                }

                // Process binary files
                const binaryExts = ['wpr', 'prf', 'aqd', 'vec', 'ad2cp', 'wpb'];
                if (!binaryExts.includes(ext)) continue;

                console.log('[Nortek] Scanning file:', file.name, 'Size:', file.size, 'bytes');
                const buffer = await file.arrayBuffer();
                const dataView = new DataView(buffer);
                const fileSectors = this.readAllSectors(dataView);
                allSectors = [...allSectors, ...fileSectors];
                console.log(`[Nortek] Found ${fileSectors.length} sectors in ${file.name}`);

                // Log a summary of sector types found
                const sectorCounts = {};
                for (const s of fileSectors) {
                    const hexId = '0x' + s.id.toString(16).padStart(2, '0').toUpperCase();
                    sectorCounts[hexId] = (sectorCounts[hexId] || 0) + 1;
                }
                console.log('[Nortek] Sector ID breakdown:', sectorCounts);
            }

            if (allSectors.length === 0) {
                throw new Error('No valid Nortek binary sectors found in the provided files.');
            }

            // Extract configuration (taking the first unique config sector found)
            const hardware = allSectors.find(s => s.id === this.SECTOR_IDS.HARDWARE_CONFIG);
            const head = allSectors.find(s => s.id === this.SECTOR_IDS.HEAD_CONFIG);
            const user = allSectors.find(s => s.id === this.SECTOR_IDS.USER_CONFIG);

            console.log('[Nortek] Config sectors found — Hardware:', !!hardware, 'Head:', !!head, 'User:', !!user);

            // Determine instrument type
            const instrumentType = this.detectInstrumentType(allSectors, hardware);
            console.log('[Nortek] Detected instrument type:', instrumentType);
            
            // Extract metadata from binary
            let metadata = this.extractMetadata(hardware, head, user, filesArray[0].name, instrumentType);
            console.log('[Nortek] Metadata from binary:', metadata);
            
            // Merge metadata from text files (they take priority for units like cell size if binary is missing)
            if (Object.keys(textMetadata).length > 0) {
                metadata = { ...metadata, ...textMetadata };
                metadata.source = 'Sidecar Metadata (.hdr/.log)';
            }

            // Check if metadata is complete enough for plotting
            metadata.isComplete = !!(metadata.frequency && metadata.cellSize && metadata.numCells);
            console.log('[Nortek] Final metadata:', metadata);

            // Extract data
            let data = this.extractData(allSectors, metadata, instrumentType);
            console.log('[Nortek] Extracted', data.length, 'data records');
            if (data.length > 0) {
                console.log('[Nortek] First record sample:', {
                    timestamp: data[0].timestamp,
                    heading: data[0].heading,
                    temperature: data[0].temperature,
                    hasVelocities: !!data[0].velocities,
                    velocityKeys: data[0].velocities ? Object.keys(data[0].velocities) : []
                });
            }

            // MANDATORY: Ensure data is sorted by time to prevent jumbled plots
            if (data && data.length > 0) {
                try {
                    data.sort((a, b) => {
                        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                        return tA - tB;
                    });
                } catch (e) {
                    console.warn('Failed to sort data:', e);
                }
            }

            return {
                metadata,
                data,
                instrumentType: 'Nortek',
                format: 'binary',
                isComplete: metadata.isComplete
            };
        } catch (error) {
            console.error('Error parsing Nortek binary files:', error);
            throw new Error(`Failed to parse Nortek binary data: ${error.message}`);
        }
    }

    /**
     * Read all sectors from the binary file
     */
    readAllSectors(dataView) {
        const sectors = [];
        let offset = 0;

        while (offset < dataView.byteLength - 4) {
            // Look for sync byte
            const sync = dataView.getUint8(offset);

            if (sync !== this.SYNC_BYTE) {
                offset++;
                continue;
            }

            try {
                // Read sector header
                const id = dataView.getUint8(offset + 1);
                // Per Nortek spec: Size field = total record size in 16-bit words,
                // INCLUDING the 4-byte header. So total bytes = words * 2.
                const totalBytes = dataView.getUint16(offset + 2, true) * 2;

                if (totalBytes <= 4 || offset + totalBytes > dataView.byteLength) {
                    offset++;
                    continue;
                }

                // Read entire sector (header + body)
                const sectorData = new DataView(dataView.buffer, dataView.byteOffset + offset, totalBytes);

                sectors.push({
                    id,
                    size: totalBytes,
                    offset,
                    data: sectorData
                });

                offset += totalBytes; // Move to next sector
            } catch (e) {
                offset++;
            }
        }

        return sectors;
    }

    /**
     * Detect instrument type from sectors
     */
    detectInstrumentType(sectors, hardware) {
        const hasAWAC = sectors.some(s => s.id === this.SECTOR_IDS.AWAC_VELOCITY);
        const hasAquadopp = sectors.some(s => s.id === this.SECTOR_IDS.AQUADOPP_VELOCITY);
        const hasHR = sectors.some(s => s.id === this.SECTOR_IDS.HR_VELOCITY);

        if (hasAWAC) return 'AWAC';
        if (hasHR) return 'Aquadopp_HR';
        if (hasAquadopp) return 'Aquadopp';
        return 'Unknown';
    }

    /**
     * Extract metadata from configuration sectors
     */
    extractMetadata(hardware, head, user, filename, instrumentType) {
        const hwData = hardware?.data;
        const headData = head?.data;
        const userData = user?.data;

        // Parse hardware configuration (ID 0x05)
        // byte 0=sync, 1=ID, 2-3=size, 4-17=serial number (14 chars)
        const serialNumber = hwData ? this.readString(hwData, 4, 14) : 'Unknown';
        
        // Parse head configuration (ID 0x04)
        // byte 0-3=header, 4-5=Config, 6-7=Frequency (kHz), 8-9=Type
        const frequency = headData ? headData.getUint16(6, true) : null;

        // Parse user configuration (ID 0x00)
        // All offsets are from byte 0 (sync byte) of the sector DataView.
        // byte 0-3: header
        // byte 4-5:  T1 (transmit pulse length)
        // byte 6-7:  T2 (blanking distance)        ← blankingDistance
        // byte 8-9:  T3 (receive length)
        // byte 10-11: T4 (time between pings)
        // byte 12-13: T5 (burst interval)
        // byte 14-15: NPings (pings per burst)
        // byte 16-17: AvgInterval
        // byte 18-19: NBeams                       ← numBeams
        // byte 20-33: TimCtrlReg…CoordSystem (skip)
        // byte 34-35: NBins (number of cells)      ← numCells
        // byte 36-37: BinLength (cell size counts) ← cellSize
        let numBeams = 0, numCells = 0, cellSize = 0, blankingDistance = 0;
        
        if (userData) {
            blankingDistance = userData.getUint16(6,  true);  // T2
            numBeams         = userData.getUint16(18, true);  // NBeams
            numCells         = userData.getUint16(34, true);  // NBins
            cellSize         = userData.getUint16(36, true);  // BinLength
        }

        // Calculate distance bins
        const distance = frequency ? this.calculateDistanceBins(frequency, blankingDistance, cellSize, numCells) : [];

        return {
            instrumentType: `Nortek ${instrumentType}`,
            manufacturer: 'Nortek',
            model: instrumentType,
            serialNumber: serialNumber.trim(),
            filename,
            dataFormat: 'Nortek Binary',
            source: 'Binary File',
            frequency,
            numBeams,
            numCells,
            cellSize,
            blankingDistance,
            distance,
            beamAngle: 25, // Standard for Nortek instruments
            isComplete: !!(frequency && numCells && cellSize)
        };
    }

    /**
     * Calculate distance bins from metadata
     * Based on IMOS toolbox calculation
     */
    calculateDistanceBins(freq, blankDist, cellSize, ncells) {
        // If values are already in meters (from .log or manual entry), use them directly
        // Otherwise convert from instrument counts
        const isMeters = cellSize < 10 && blankDist < 10; // Simple heuristic: counts are usually > 100
        
        if (isMeters) {
            const cosAngle = Math.cos(25 * Math.PI / 180);
            const distance = [];
            for (let i = 0; i < ncells; i++) {
                distance.push(blankDist * cosAngle + i * cellSize * cosAngle + cellSize * cosAngle);
            }
            return distance;
        }

        let factor = 0;
        switch (freq) {
            case 400: factor = 0.1195; break;
            case 600: factor = 0.0797; break;
            case 1000: factor = 0.0478; break;
            case 2000: factor = 0.0239; break;
            default: factor = 0.0478; 
        }

        const cosAngle = Math.cos(25 * Math.PI / 180);
        const cellSizeM = (cellSize / 256) * factor * cosAngle;
        const blankDistM = blankDist * 0.0229 * cosAngle - cellSizeM;

        const distance = [];
        for (let i = 0; i < ncells; i++) {
            distance.push(blankDistM + i * cellSizeM + cellSizeM); 
        }

        return distance;
    }

    /**
     * Extract data records from velocity sectors
     */
    extractData(sectors, metadata, instrumentType) {
        // Collect ALL velocity sectors (profiler, AWAC, HR, simple)
        const velocityIds = [
            this.SECTOR_IDS.AQUADOPP_VELOCITY,
            this.SECTOR_IDS.AWAC_VELOCITY,
            this.SECTOR_IDS.HR_VELOCITY,
            this.SECTOR_IDS.VELOCITY_DATA
        ];

        const velocitySectors = sectors.filter(s => velocityIds.includes(s.id));
        console.log(`[Nortek] Velocity sectors found: ${velocitySectors.length} out of ${sectors.length} total sectors`);
        console.log('[Nortek] Velocity sector IDs:', velocitySectors.map(s => '0x' + s.id.toString(16).padStart(2, '0').toUpperCase()));

        const data = [];
        for (const sector of velocitySectors) {
            const record = this.parseVelocitySector(sector.data, sector.id, metadata);
            if (record) {
                data.push(record);
            }
        }

        return data;
    }

    /**
     * Parse a velocity data sector.
     * 
     * Per Nortek System Integrator Guide, all velocity record types share
     * the same header layout (bytes 0-53), then velocity data follows.
     * 
     * Type 0x01 (Velocity): 3-beam single-point, NB/NC in bytes 34/35 = 0/1
     * Type 0x20 (AWAC):     profiler, NB/NC in bytes 34/35
     * Type 0x21 (Aquadopp): profiler, NB/NC in bytes 34/35
     * 
     * Header layout (all offsets from start of sector, byte 0 = sync 0xA5):
     *   0-1   Sync+ID
     *   2-3   Size (words)
     *   4-9   Time (BCD: min, sec, day, hour, year, month)
     *   10-11 Error code
     *   12-13 Analog1
     *   14-15 Battery (0.1V)
     *   16-17 Sound speed (0.1 m/s)
     *   18-19 Heading (0.1 deg)
     *   20-21 Pitch (0.1 deg)
     *   22-23 Roll (0.1 deg)
     *   24    Pressure MSB
     *   25    Status
     *   26-27 Pressure LSW (0.001 dbar with MSB)
     *   28-29 Temperature (0.01 °C)
     *   30-31 Analog2
     *   32-33 Spare
     *   34    Num beams
     *   35    Num cells (0 for single-point = treat as 1)
     *   36-53 Spare/checksum area
     *   54+   Velocity data (Int16 per beam*cell, mm/s → ×0.001 m/s)
     */
    parseVelocitySector(dataView, sectorId, metadata) {
        try {
            // Time (bytes 4-9)
            const timestamp = this.parseNortekTime(dataView, 4);

            // Battery voltage (bytes 14-15)
            const battery = dataView.getUint16(14, true) * 0.1;

            // Sound speed (bytes 16-17)
            const soundSpeed = dataView.getUint16(16, true) * 0.1;

            // Heading, pitch, roll (bytes 18-23)
            const heading = dataView.getInt16(18, true) * 0.1;
            const pitch   = dataView.getInt16(20, true) * 0.1;
            const roll    = dataView.getInt16(22, true) * 0.1;

            // Pressure (bytes 24-27)
            const pressureMSB = dataView.getUint8(24);
            const status      = dataView.getUint8(25);
            const pressureLSW = dataView.getUint16(26, true);
            const pressure    = (pressureMSB * 65536 + pressureLSW) * 0.001;

            // Temperature (bytes 28-29)
            const temperature = dataView.getInt16(28, true) * 0.01;

            // Error (bytes 10-11)
            const error = dataView.getInt16(10, true);

            // ---------------------------------------------------------------
            // Determine numBeams / numCells per sector type.
            //
            // 0x21 Aquadopp Profiler: byte 34 = numBeams, byte 35 = numCells
            // 0x20 AWAC:             byte 34-35 = NominalCorrelation (uint16)
            //                         → AWAC always has 3 fixed beams;
            //                           numCells MUST come from User Config.
            // 0x01 Simple velocity:  bytes 34-35 may be 0; fall back to meta.
            // ---------------------------------------------------------------
            let numBeams, numCells;

            if (sectorId === this.SECTOR_IDS.AWAC_VELOCITY) {
                // AWAC: 3 fixed physical beams; cell count from User Config
                numBeams = 3;
                numCells = metadata.numCells || 1;
                console.log(`[Nortek AWAC] Using numBeams=${numBeams}, numCells=${numCells} (from metadata)`);
            } else if (sectorId === this.SECTOR_IDS.AQUADOPP_VELOCITY) {
                // Aquadopp Profiler: beams/cells embedded in bytes 34-35
                numBeams = dataView.getUint8(34) || metadata.numBeams || 3;
                numCells = dataView.getUint8(35) || metadata.numCells || 1;
            } else {
                // Simple/Unknown: bytes may be 0; fall back
                numBeams = dataView.getUint8(34) || metadata.numBeams || 3;
                numCells = dataView.getUint8(35) || metadata.numCells || 1;
            }

            // ---------------------------------------------------------------
            // Velocity data offset:
            //
            // 0x01 (Standard):         36 bytes
            // 0x21 (Aquadopp Profiler): 54 bytes
            // 0x20 (AWAC):             DYNAMIC — derived from record size.
            //
            // The AWAC 0x20 record has a large spare/padding zone between
            // the sensor header (ends at byte ~32) and the velocity block.
            // Empirically the padding fills the gap so that:
            //   velOffset = record_size - vel_bytes - amp_bytes - 2 (checksum)
            // This is robust across different AWAC configurations.
            //
            // NOTE: AWAC 0x20 records contain NO correlation block.
            //       Layout: [header+spare] [vel: B*N*2] [amp: B*N] [checksum: 2]
            // ---------------------------------------------------------------
            const velBytes  = numBeams * numCells * 2; // Int16 per beam*cell
            const ampBytes  = numBeams * numCells;     // Uint8 per beam*cell
            const corrBytes = sectorId === this.SECTOR_IDS.AWAC_VELOCITY ? 0 : numBeams * numCells;

            let velOffset;
            if (sectorId === this.SECTOR_IDS.AWAC_VELOCITY) {
                // Derive offset from the actual record size — avoids any
                // hardcoded assumption about how many spare bytes precede the data.
                velOffset = dataView.byteLength - velBytes - ampBytes - 2;
                if (velOffset < 32 || velOffset >= dataView.byteLength) {
                    console.warn(`[Nortek AWAC] Derived velOffset ${velOffset} is invalid ` +
                        `(record=${dataView.byteLength}B, numBeams=${numBeams}, numCells=${numCells}). Skipping.`);
                    return null;
                }
                console.log(`[Nortek AWAC] Record size=${dataView.byteLength}B, derived velOffset=${velOffset}, ` +
                    `numBeams=${numBeams}, numCells=${numCells}`);
            } else if (sectorId === this.SECTOR_IDS.AQUADOPP_VELOCITY) {
                velOffset = 54;
            } else {
                velOffset = 36;
            }

            // Hard bounds check — prevent DataView out-of-bounds crash
            const totalNeeded = velOffset + velBytes + ampBytes + corrBytes;

            if (totalNeeded > dataView.byteLength) {
                console.warn(
                    `[Nortek] Sector 0x${sectorId.toString(16)} too small: ` +
                    `need ${totalNeeded} bytes but DataView is only ${dataView.byteLength} bytes. ` +
                    `(numBeams=${numBeams}, numCells=${numCells}, velOffset=${velOffset}). ` +
                    `Extracting velocity only (no amplitude/correlation).`
                );
                const velOnly = this.extractVelocityData(dataView, velOffset, numBeams,
                    Math.min(numCells, Math.floor((dataView.byteLength - velOffset) / (numBeams * 2))));
                return {
                    timestamp, heading, pitch, roll, temperature, pressure,
                    battery, soundSpeed, error, status,
                    velocities: velOnly, echoIntensity: null, correlation: null,
                };
            }

            const velocities   = this.extractVelocityData(dataView, velOffset, numBeams, numCells);
            const amplitudes   = this.extractAmplitudeData(dataView, velOffset, numBeams, numCells);
            // AWAC 0x20 has no correlation block (only vel + amp + checksum)
            const correlations = sectorId === this.SECTOR_IDS.AWAC_VELOCITY
                ? null
                : this.extractCorrelationData(dataView, velOffset, numBeams, numCells);

            return {
                timestamp,
                heading,
                pitch,
                roll,
                temperature,
                pressure,
                battery,
                soundSpeed,
                error,
                status,
                velocities,
                echoIntensity: amplitudes,
                correlation:   correlations,
            };
        } catch (e) {
            console.warn('[Nortek] Error parsing velocity sector (id=0x' + sectorId?.toString(16) + '):', e.message);
            return null;
        }
    }

    /**
     * Parse Nortek timestamp format (typically BCD)
     */
    parseNortekTime(dataView, offset) {
        const minute = this.bcdToDec(dataView.getUint8(offset));
        const second = this.bcdToDec(dataView.getUint8(offset + 1));
        const day = this.bcdToDec(dataView.getUint8(offset + 2));
        const hour = this.bcdToDec(dataView.getUint8(offset + 3));
        let year = this.bcdToDec(dataView.getUint8(offset + 4));
        const month = this.bcdToDec(dataView.getUint8(offset + 5));

        // Nortek instruments typically store year as offset from 1900 or 2000
        if (year < 100) {
            year += 2000;
        } else {
            year += 1900;
        }

        const date = new Date(year, month - 1, day, hour, minute, second);
        return date.toISOString();
    }

    /**
     * Convert Binary Coded Decimal (BCD) byte to Decimal
     */
    bcdToDec(bcd) {
        return ((bcd >> 4) * 10) + (bcd & 0x0F);
    }

    /**
     * Extract velocity data for all beams and cells
     */
    extractVelocityData(dataView, offset, numBeams, numCells) {
        const velocities = {};
        let currentOffset = offset;

        for (let beam = 1; beam <= numBeams; beam++) {
            const beamData = [];
            for (let cell = 0; cell < numCells; cell++) {
                const vel = dataView.getInt16(currentOffset, true);
                beamData.push(vel * 0.001); // Convert mm/s to m/s
                currentOffset += 2;
            }
            velocities[`v${beam}`] = beamData; // Normalized to v1, v2, v3
        }

        return velocities;
    }

    /**
     * Extract amplitude (echo intensity) data
     */
    extractAmplitudeData(dataView, offset, numBeams, numCells) {
        const ampOffset = offset + (numBeams * numCells * 2);
        const amplitudes = {};

        let currentOffset = ampOffset;
        for (let beam = 1; beam <= numBeams; beam++) {
            const beamData = [];
            for (let cell = 0; cell < numCells; cell++) {
                const amp = dataView.getUint8(currentOffset);
                beamData.push(amp);
                currentOffset++;
            }
            amplitudes[`beam${beam}`] = beamData;
        }

        return amplitudes;
    }

    /**
     * Extract correlation data
     */
    extractCorrelationData(dataView, offset, numBeams, numCells) {
        const corrOffset = offset + (numBeams * numCells * 2) + (numBeams * numCells);
        const correlations = {};

        let currentOffset = corrOffset;
        for (let beam = 1; beam <= numBeams; beam++) {
            const beamData = [];
            for (let cell = 0; cell < numCells; cell++) {
                const corr = dataView.getUint8(currentOffset);
                beamData.push(corr);
                currentOffset++;
            }
            correlations[`beam${beam}`] = beamData;
        }

        return correlations;
    }

    /**
     * Read ASCII string from DataView
     */
    readString(dataView, offset, length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            const char = dataView.getUint8(offset + i);
            if (char === 0) break; // Null terminator
            str += String.fromCharCode(char);
        }
        return str;
    }

    /**
     * Check if file is likely a Nortek binary file
     * @param {File} file - File to check
     * @returns {boolean} True if file appears to be Nortek format
     */
    static canParse(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        return ['wpr', 'prf', 'aqd', 'vec', 'ad2cp'].includes(ext);
    }
}
