/**
 * Factory to auto-detect instrument type and select appropriate parser
 */

import { NortekParser } from './NortekParser';
import { NortekBinaryParser } from './NortekBinaryParser';
import { RDIParser } from './RDIParser';
import { RDIBinaryParser } from './RDIBinaryParser';

export class ParserFactory {
    // Nortek binary extensions
    static NORTEK_BINARY_EXTS = ['wpr', 'prf', 'aqd', 'vec', 'ad2cp', 'wpb'];

    // Nortek ASCII extensions
    static NORTEK_ASCII_EXTS = ['hdr', 'sen', 'v1', 'v2', 'v3', 'a1', 'a2', 'a3', 'dat'];

    // RDI binary extensions
    static RDI_BINARY_EXTS = ['000', '001', '002', '003', '004', '005', 'pd0', 'pdo'];

    /**
     * Detect instrument type and format based on file extensions
     */
    static detectParser(files) {
        const fileNames = files.map(f => f.name.toLowerCase());
        const getExt = name => name.split('.').pop();

        // Check for Nortek binary files first
        if (fileNames.some(name => this.NORTEK_BINARY_EXTS.includes(getExt(name)))) {
            return 'nortek-binary';
        }

        // Check for RDI binary files
        if (fileNames.some(name => this.RDI_BINARY_EXTS.includes(getExt(name)))) {
            return 'rdi-binary';
        }

        // Check for Nortek ASCII files
        if (fileNames.some(name => this.NORTEK_ASCII_EXTS.includes(getExt(name)))) {
            return 'nortek-ascii';
        }

        // Check for RDI ASCII/CSV files
        const hasRDIFiles = fileNames.some(name =>
            name.includes('rdi') ||
            name.includes('adcp') ||
            name.includes('workhorse')
        );
        if (hasRDIFiles || fileNames.some(name => name.endsWith('.csv'))) {
            return 'rdi-ascii';
        }

        // Default: try Nortek ASCII
        return 'nortek-ascii';
    }

    /**
     * Get appropriate parser instance based on detected type
     */
    static getParser(parserType) {
        switch (parserType) {
            case 'nortek-binary':
                return new NortekBinaryParser();
            case 'nortek-ascii':
                return new NortekParser();
            case 'rdi-binary':
                return new RDIBinaryParser();
            case 'rdi-ascii':
                return new RDIParser();
            default:
                throw new Error(`Unknown parser type: ${parserType}`);
        }
    }

    /**
     * Parse files with automatic instrument/format detection
     */
    static async parse(files) {
        if (!files || files.length === 0) {
            throw new Error('No files provided');
        }

        const parserType = this.detectParser(files);
        const parser = this.getParser(parserType);

        console.log(`[ParserFactory] Detected parser type: ${parserType}`);

        const result = await parser.parse(files);

        result.detectedType = parserType;

        return result;
    }
}
