/**
 * Factory to auto-detect instrument type and select appropriate parser
 */

import { NortekParser } from './NortekParser';
import { RDIParser } from './RDIParser';

export class ParserFactory {
    /**
     * Detect instrument type based on file extensions and content
     */
    static detectInstrumentType(files) {
        const fileNames = files.map(f => f.name.toLowerCase());

        // Check for Nortek file extensions
        const hasNortekFiles = fileNames.some(name =>
            name.endsWith('.hdr') ||
            name.endsWith('.sen') ||
            name.endsWith('.v1') ||
            name.endsWith('.v2') ||
            name.endsWith('.v3') ||
            name.endsWith('.a1') ||
            name.endsWith('.a2') ||
            name.endsWith('.a3')
        );

        if (hasNortekFiles) {
            return 'nortek';
        }

        // Check for RDI files (typically .csv or generic ASCII)
        const hasRDIFiles = fileNames.some(name =>
            name.includes('rdi') ||
            name.includes('adcp') ||
            name.includes('workhorse')
        );

        if (hasRDIFiles) {
            return 'rdi';
        }

        // Default based on file extension
        if (fileNames.some(name => name.endsWith('.csv'))) {
            return 'rdi'; // Assume RDI for CSV files
        }

        // If we can't detect, assume Nortek
        return 'nortek';
    }

    /**
     * Get appropriate parser based on instrument type
     */
    static getParser(instrumentType) {
        switch (instrumentType.toLowerCase()) {
            case 'nortek':
            case 'aquadopp':
            case 'awac':
                return new NortekParser();

            case 'rdi':
            case 'teledyne':
            case 'workhorse':
            case 'adcp':
                return new RDIParser();

            default:
                throw new Error(`Unknown instrument type: ${instrumentType}`);
        }
    }

    /**
     * Parse files with automatic instrument detection
     */
    static async parse(files) {
        if (!files || files.length === 0) {
            throw new Error('No files provided');
        }

        // Detect instrument type
        const instrumentType = this.detectInstrumentType(files);

        // Get appropriate parser
        const parser = this.getParser(instrumentType);

        // Parse files
        const result = await parser.parse(files);

        // Add detection info
        result.detectedType = instrumentType;

        return result;
    }
}
