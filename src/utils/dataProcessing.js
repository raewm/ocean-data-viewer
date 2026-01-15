/**
 * Data processing utilities
 */

/**
 * Filter data by time range
 */
export function filterByTimeRange(data, startTime, endTime) {
    if (!startTime && !endTime) return data;

    return data.filter(record => {
        if (!record.timestamp) return true;

        const timestamp = new Date(record.timestamp);

        if (startTime && timestamp < new Date(startTime)) return false;
        if (endTime && timestamp > new Date(endTime)) return false;

        return true;
    });
}

/**
 * Calculate basic statistics for a numeric array
 */
export function calculateStatistics(values) {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));

    if (validValues.length === 0) {
        return {
            count: 0,
            mean: null,
            median: null,
            min: null,
            max: null,
            stdDev: null
        };
    }

    const sorted = [...validValues].sort((a, b) => a - b);
    const sum = validValues.reduce((acc, v) => acc + v, 0);
    const mean = sum / validValues.length;

    const median = validValues.length % 2 === 0
        ? (sorted[validValues.length / 2 - 1] + sorted[validValues.length / 2]) / 2
        : sorted[Math.floor(validValues.length / 2)];

    const variance = validValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / validValues.length;
    const stdDev = Math.sqrt(variance);

    return {
        count: validValues.length,
        mean: parseFloat(mean.toFixed(4)),
        median: parseFloat(median.toFixed(4)),
        min: parseFloat(Math.min(...validValues).toFixed(4)),
        max: parseFloat(Math.max(...validValues).toFixed(4)),
        stdDev: parseFloat(stdDev.toFixed(4))
    };
}

/**
 * Extract velocity values from different data formats
 */
export function extractVelocities(data, component = 'v1') {
    return data.map(record => {
        // Handle Nortek format
        if (record.velocities?.[component]) {
            const vel = record.velocities[component];
            return Array.isArray(vel) ? vel[0] : vel;
        }

        // Handle RDI format
        if (record.velocities) {
            const keys = Object.keys(record.velocities);
            if (keys.length > 0) {
                return record.velocities[keys[0]];
            }
        }

        // Handle simple speed field
        if (record.speed !== undefined) {
            return record.speed;
        }

        return null;
    });
}

/**
 * Get time range from dataset
 */
export function getTimeRange(data) {
    const timestamps = data
        .map(record => record.timestamp)
        .filter(t => t !== null && t !== undefined)
        .map(t => new Date(t));

    if (timestamps.length === 0) {
        return { start: null, end: null };
    }

    return {
        start: new Date(Math.min(...timestamps)),
        end: new Date(Math.max(...timestamps))
    };
}

/**
 * Interpolate missing values (simple linear interpolation)
 */
export function interpolateMissingValues(values) {
    const result = [...values];

    for (let i = 1; i < result.length - 1; i++) {
        if (result[i] === null || result[i] === undefined || isNaN(result[i])) {
            // Find previous valid value
            let prevIndex = i - 1;
            while (prevIndex >= 0 && (result[prevIndex] === null || result[prevIndex] === undefined || isNaN(result[prevIndex]))) {
                prevIndex--;
            }

            // Find next valid value
            let nextIndex = i + 1;
            while (nextIndex < result.length && (result[nextIndex] === null || result[nextIndex] === undefined || isNaN(result[nextIndex]))) {
                nextIndex++;
            }

            // Interpolate if both neighbors are valid
            if (prevIndex >= 0 && nextIndex < result.length) {
                const prevValue = result[prevIndex];
                const nextValue = result[nextIndex];
                const steps = nextIndex - prevIndex;
                const step = (nextValue - prevValue) / steps;
                result[i] = prevValue + step * (i - prevIndex);
            }
        }
    }

    return result;
}

/**
 * Convert m/s to other velocity units
 */
export function convertVelocity(value, fromUnit, toUnit) {
    // All conversions go through m/s as base unit
    const toMPS = {
        'm/s': 1,
        'cm/s': 0.01,
        'mm/s': 0.001,
        'kt': 0.514444,
        'mph': 0.44704
    };

    const valueInMPS = value * toMPS[fromUnit];
    return valueInMPS / toMPS[toUnit];
}

/**
 * Get available data parameters from dataset
 */
export function getAvailableParameters(data) {
    if (!data || data.length === 0) return [];

    const params = new Set();
    const sample = data[0];

    // Check for standard fields
    if (sample.heading !== undefined) params.add('heading');
    if (sample.pitch !== undefined) params.add('pitch');
    if (sample.roll !== undefined) params.add('roll');
    if (sample.temperature !== undefined) params.add('temperature');
    if (sample.pressure !== undefined) params.add('pressure');
    if (sample.speed !== undefined) params.add('speed');
    if (sample.direction !== undefined) params.add('direction');

    // Check for velocity components
    if (sample.velocities) {
        Object.keys(sample.velocities).forEach(key => params.add(`velocity_${key}`));
    }

    // Check for amplitude
    if (sample.amplitudes) {
        Object.keys(sample.amplitudes).forEach(key => params.add(`amplitude_${key}`));
    }

    // Check for echo
    if (sample.echo) {
        Object.keys(sample.echo).forEach(key => params.add(`echo_${key}`));
    }

    return Array.from(params);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp, format = 'full') {
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) return 'Invalid Date';

    switch (format) {
        case 'date':
            return date.toLocaleDateString();
        case 'time':
            return date.toLocaleTimeString();
        case 'iso':
            return date.toISOString();
        case 'full':
        default:
            return date.toLocaleString();
    }
}

/**
 * Create bins for histogram/distribution analysis
 */
export function createHistogramBins(values, numBins = 20) {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));

    if (validValues.length === 0) return [];

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const binWidth = (max - min) / numBins;

    const bins = Array(numBins).fill(0).map((_, i) => ({
        min: min + i * binWidth,
        max: min + (i + 1) * binWidth,
        count: 0,
        center: min + (i + 0.5) * binWidth
    }));

    validValues.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1);
        bins[binIndex].count++;
    });

    return bins;
}
