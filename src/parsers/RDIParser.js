/**
 * Parser for Teledyne RDI Workhorse ADCP ASCII/CSV data files
 * Handles exported PD0 format data
 */

import Papa from 'papaparse';

export class RDIParser {
    constructor() {
        this.metadata = {};
        this.data = [];
    }

    /**
     * Parse CSV data exported from RDI software
     */
    async parseCSV(content) {
        return new Promise((resolve, reject) => {
            Papa.parse(content, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    resolve(results.data);
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * Parse ASCII format exported from RDI software
     * This handles the common ASCII export format with headers
     */
    parseASCII(content) {
        const lines = content.split('\n');
        const data = [];
        let headers = [];
        let inDataSection = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines and comments
            if (!line || line.startsWith(';') || line.startsWith('#')) {
                continue;
            }

            // Look for header line (typically starts with Date, Time, or Ensemble)
            if (!inDataSection && (line.includes('Date') || line.includes('Time') || line.includes('Ensemble'))) {
                headers = line.split(/[\s,]+/).map(h => h.trim());
                inDataSection = true;
                continue;
            }

            // Parse data lines
            if (inDataSection && headers.length > 0) {
                const values = line.split(/[\s,]+/).map(v => v.trim());

                if (values.length >= headers.length) {
                    const record = {};

                    for (let j = 0; j < headers.length; j++) {
                        const value = values[j];
                        // Try to parse as number, otherwise keep as string
                        record[headers[j]] = isNaN(value) ? value : parseFloat(value);
                    }

                    data.push(record);
                }
            }
        }

        return data;
    }

    /**
     * Parse RDI PD0 format metadata
     */
    extractMetadata(data) {
        if (data.length === 0) return {};

        const firstRecord = data[0];
        const metadata = {
            instrumentType: 'Teledyne RDI Workhorse ADCP',
            recordCount: data.length,
            fields: Object.keys(firstRecord),
            startTime: null,
            endTime: null
        };

        // Try to determine time range
        if (firstRecord.Date || firstRecord.Time || firstRecord.DateTime) {
            const timestamps = data.map(record => {
                if (record.DateTime) {
                    return new Date(record.DateTime);
                } else if (record.Date && record.Time) {
                    return new Date(`${record.Date} ${record.Time}`);
                }
                return null;
            }).filter(t => t !== null);

            if (timestamps.length > 0) {
                metadata.startTime = new Date(Math.min(...timestamps)).toISOString();
                metadata.endTime = new Date(Math.max(...timestamps)).toISOString();
            }
        }

        return metadata;
    }

    /**
     * Normalize RDI data to common format
     */
    normalizeData(rawData) {
        return rawData.map(record => {
            const normalized = {
                timestamp: null,
                ensemble: record.Ensemble || record.ensemble || null,
                velocities: {},
                echo: {},
                correlation: {},
                percentGood: {},
                depth: record.Depth || record.depth || null
            };

            // Extract timestamp
            if (record.DateTime) {
                normalized.timestamp = new Date(record.DateTime).toISOString();
            } else if (record.Date && record.Time) {
                normalized.timestamp = new Date(`${record.Date} ${record.Time}`).toISOString();
            } else if (record.Year && record.Month && record.Day) {
                const hour = record.Hour || 0;
                const minute = record.Minute || 0;
                const second = record.Second || 0;
                normalized.timestamp = new Date(
                    record.Year, record.Month - 1, record.Day, hour, minute, second
                ).toISOString();
            }

            // Extract velocity components (can be multiple bins)
            for (const key in record) {
                if (key.startsWith('Vel') || key.startsWith('V')) {
                    normalized.velocities[key] = record[key];
                } else if (key.startsWith('Echo') || key.startsWith('E')) {
                    normalized.echo[key] = record[key];
                } else if (key.startsWith('Corr') || key.startsWith('C')) {
                    normalized.correlation[key] = record[key];
                } else if (key.startsWith('PG') || key.toLowerCase().includes('percentgood')) {
                    normalized.percentGood[key] = record[key];
                } else if (key.toLowerCase().includes('heading')) {
                    normalized.heading = record[key];
                } else if (key.toLowerCase().includes('pitch')) {
                    normalized.pitch = record[key];
                } else if (key.toLowerCase().includes('roll')) {
                    normalized.roll = record[key];
                } else if (key.toLowerCase().includes('temp')) {
                    normalized.temperature = record[key];
                }
            }

            return normalized;
        });
    }

    /**
     * Main parse method
     */
    async parse(files) {
        const result = {
            instrumentType: 'Teledyne RDI Workhorse ADCP',
            metadata: {},
            data: [],
            files: []
        };

        for (const file of files) {
            const content = await file.text();
            const fileName = file.name.toLowerCase();

            result.files.push(fileName);

            let rawData;

            // Determine file type and parse accordingly
            if (fileName.endsWith('.csv')) {
                rawData = await this.parseCSV(content);
            } else {
                // Assume ASCII format
                rawData = this.parseASCII(content);
            }

            // Extract metadata
            result.metadata = this.extractMetadata(rawData);

            // Normalize data to common format
            result.data = this.normalizeData(rawData);
        }

        return result;
    }
}
