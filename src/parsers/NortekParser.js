/**
 * Parser for Nortek Aquadopp and AWAC ASCII data files
 * Handles .hdr, .sen, .v1/.v2/.v3, .a1/.a2/.a3, .dat files
 */

export class NortekParser {
    constructor() {
        this.metadata = {};
        this.data = [];
    }

    /**
     * Parse Nortek header file (.hdr)
     */
    parseHeader(content) {
        const lines = content.split('\n');
        const header = {};

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('%')) continue;

            const parts = trimmed.split(/\s{2,}|:\s*/);
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(' ').trim();
                header[key] = value;
            }
        }

        return header;
    }

    /**
     * Parse sensor data file (.sen)
     * Format: Month Day Year Hour Minute Second Heading Pitch Roll Temperature Pressure
     */
    parseSensorData(content) {
        const lines = content.split('\n');
        const data = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('%')) continue;

            const values = trimmed.split(/\s+/).map(v => parseFloat(v));
            if (values.length >= 11) {
                data.push({
                    month: values[0],
                    day: values[1],
                    year: values[2],
                    hour: values[3],
                    minute: values[4],
                    second: values[5],
                    heading: values[6],
                    pitch: values[7],
                    roll: values[8],
                    temperature: values[9],
                    pressure: values[10]
                });
            }
        }

        return data;
    }

    /**
     * Parse velocity data files (.v1, .v2, .v3)
     * Each file contains one velocity component
     * Rows are time samples, columns are depth bins (for profilers)
     */
    parseVelocityData(content, component) {
        const lines = content.split('\n');
        const data = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('%')) continue;

            const values = trimmed.split(/\s+/).map(v => parseFloat(v));
            data.push({
                component,
                values
            });
        }

        return data;
    }

    /**
     * Parse amplitude data files (.a1, .a2, .a3)
     * Similar structure to velocity files
     */
    parseAmplitudeData(content, beam) {
        const lines = content.split('\n');
        const data = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('%')) continue;

            const values = trimmed.split(/\s+/).map(v => parseFloat(v));
            data.push({
                beam,
                values
            });
        }

        return data;
    }

    /**
     * Parse .dat file (combined velocity and direction)
     * Format varies by instrument configuration
     */
    parseDatFile(content) {
        const lines = content.split('\n');
        const data = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('%')) continue;

            const values = trimmed.split(/\s+/).map(v => parseFloat(v));
            if (values.length >= 8) {
                data.push({
                    month: values[0],
                    day: values[1],
                    year: values[2],
                    hour: values[3],
                    minute: values[4],
                    second: values[5],
                    speed: values[6],
                    direction: values[7]
                });
            }
        }

        return data;
    }

    /**
     * Combine all parsed data into unified format
     */
    combineData(sensorData, velocityData, amplitudeData) {
        const combined = [];

        for (let i = 0; i < sensorData.length; i++) {
            const sensor = sensorData[i];

            // Create ISO timestamp
            const timestamp = new Date(
                sensor.year,
                sensor.month - 1,
                sensor.day,
                sensor.hour,
                sensor.minute,
                sensor.second
            ).toISOString();

            const record = {
                timestamp,
                heading: sensor.heading,
                pitch: sensor.pitch,
                roll: sensor.roll,
                temperature: sensor.temperature,
                pressure: sensor.pressure,
                velocities: {},
                amplitudes: {}
            };

            // Add velocity data if available
            if (velocityData.v1 && velocityData.v1[i]) {
                record.velocities.v1 = velocityData.v1[i].values;
            }
            if (velocityData.v2 && velocityData.v2[i]) {
                record.velocities.v2 = velocityData.v2[i].values;
            }
            if (velocityData.v3 && velocityData.v3[i]) {
                record.velocities.v3 = velocityData.v3[i].values;
            }

            // Add amplitude data if available
            if (amplitudeData.a1 && amplitudeData.a1[i]) {
                record.amplitudes.a1 = amplitudeData.a1[i].values;
            }
            if (amplitudeData.a2 && amplitudeData.a2[i]) {
                record.amplitudes.a2 = amplitudeData.a2[i].values;
            }
            if (amplitudeData.a3 && amplitudeData.a3[i]) {
                record.amplitudes.a3 = amplitudeData.a3[i].values;
            }

            combined.push(record);
        }

        return combined;
    }

    /**
     * Main parse method
     */
    async parse(files) {
        const result = {
            instrumentType: 'Nortek',
            metadata: {},
            data: [],
            files: []
        };

        let sensorData = null;
        const velocityData = {};
        const amplitudeData = {};

        for (const file of files) {
            const content = await file.text();
            const fileName = file.name.toLowerCase();

            result.files.push(fileName);

            if (fileName.endsWith('.hdr')) {
                result.metadata = this.parseHeader(content);
            } else if (fileName.endsWith('.sen')) {
                sensorData = this.parseSensorData(content);
            } else if (fileName.endsWith('.v1')) {
                velocityData.v1 = this.parseVelocityData(content, 'v1');
            } else if (fileName.endsWith('.v2')) {
                velocityData.v2 = this.parseVelocityData(content, 'v2');
            } else if (fileName.endsWith('.v3')) {
                velocityData.v3 = this.parseVelocityData(content, 'v3');
            } else if (fileName.endsWith('.a1')) {
                amplitudeData.a1 = this.parseAmplitudeData(content, 'a1');
            } else if (fileName.endsWith('.a2')) {
                amplitudeData.a2 = this.parseAmplitudeData(content, 'a2');
            } else if (fileName.endsWith('.a3')) {
                amplitudeData.a3 = this.parseAmplitudeData(content, 'a3');
            } else if (fileName.endsWith('.dat')) {
                const datData = this.parseDatFile(content);
                result.data = datData;
                return result; // .dat file contains complete data
            }
        }

        // Combine separate files if we have sensor data
        if (sensorData) {
            result.data = this.combineData(sensorData, velocityData, amplitudeData);
        }

        return result;
    }
}
