/**
 * QA/QC Engine implementing IOOS QARTOD-based quality control tests
 * for oceanographic current meter data
 */

export const QC_FLAGS = {
    PASS: 1,
    NOT_EVALUATED: 2,
    SUSPECT: 3,
    FAIL: 4,
    MISSING: 9
};

export const QC_FLAG_LABELS = {
    [QC_FLAGS.PASS]: 'Pass',
    [QC_FLAGS.NOT_EVALUATED]: 'Not Evaluated',
    [QC_FLAGS.SUSPECT]: 'Suspect',
    [QC_FLAGS.FAIL]: 'Fail',
    [QC_FLAGS.MISSING]: 'Missing'
};

export class QAQCEngine {
    constructor(config = {}) {
        // Default thresholds based on IOOS QARTOD recommendations
        this.config = {
            velocity: {
                min: -5.0,          // m/s (sensor range)
                max: 5.0,           // m/s (sensor range)
                suspectMin: -4.0,   // m/s (suspect range)
                suspectMax: 4.0,    // m/s (suspect range)
            },
            spikeThreshold: 2.5,   // Standard deviations for spike detection
            rateOfChange: {
                max: 1.0,            // m/s per reading
                suspect: 0.5         // m/s per reading
            },
            pitch: {
                max: 20,             // degrees
                suspect: 15          // degrees
            },
            roll: {
                max: 20,             // degrees
                suspect: 15          // degrees
            },
            correlation: {
                min: 64,             // counts (typical threshold)
                suspect: 80          // counts
            },
            echoIntensity: {
                min: 30,             // counts
                suspect: 40          // counts
            },
            percentGood: {
                min: 50,             // percent
                suspect: 70          // percent
            },
            ...config
        };
    }

    /**
     * Range Test - Check if values are within sensor and user-specified ranges
     */
    rangeTest(value, param = 'velocity') {
        if (value === null || value === undefined || isNaN(value)) {
            return QC_FLAGS.MISSING;
        }

        const ranges = this.config[param];
        if (!ranges) return QC_FLAGS.NOT_EVALUATED;

        if (value < ranges.min || value > ranges.max) {
            return QC_FLAGS.FAIL;
        }

        if (ranges.suspectMin !== undefined && ranges.suspectMax !== undefined) {
            if (value < ranges.suspectMin || value > ranges.suspectMax) {
                return QC_FLAGS.SUSPECT;
            }
        }

        return QC_FLAGS.PASS;
    }

    /**
     * Spike Test - Detect unrealistic spikes in time series
     */
    spikeTest(values, index) {
        if (index < 1 || index >= values.length - 1) {
            return QC_FLAGS.NOT_EVALUATED;
        }

        const prev = values[index - 1];
        const current = values[index];
        const next = values[index + 1];

        if ([prev, current, next].some(v => v === null || v === undefined || isNaN(v))) {
            return QC_FLAGS.MISSING;
        }

        // Calculate differences
        const diff1 = Math.abs(current - prev);
        const diff2 = Math.abs(current - next);
        const refDiff = Math.abs(next - prev);

        // Spike detected if current value differs significantly from neighbors
        // compared to the difference between neighbors
        const threshold = this.config.spikeThreshold;

        if (diff1 > threshold * refDiff && diff2 > threshold * refDiff) {
            return QC_FLAGS.FAIL;
        }

        return QC_FLAGS.PASS;
    }

    /**
     * Rate of Change Test - Detect excessive temporal gradients
     */
    rateOfChangeTest(values, index) {
        if (index < 1) {
            return QC_FLAGS.NOT_EVALUATED;
        }

        const prev = values[index - 1];
        const current = values[index];

        if (prev === null || prev === undefined || isNaN(prev) ||
            current === null || current === undefined || isNaN(current)) {
            return QC_FLAGS.MISSING;
        }

        const change = Math.abs(current - prev);

        if (change > this.config.rateOfChange.max) {
            return QC_FLAGS.FAIL;
        }

        if (change > this.config.rateOfChange.suspect) {
            return QC_FLAGS.SUSPECT;
        }

        return QC_FLAGS.PASS;
    }

    /**
     * Pitch/Roll Test - Check for excessive instrument tilt
     */
    tiltTest(pitch, roll) {
        if ((pitch === null || pitch === undefined || isNaN(pitch)) &&
            (roll === null || roll === undefined || isNaN(roll))) {
            return QC_FLAGS.MISSING;
        }

        const pitchAbs = Math.abs(pitch || 0);
        const rollAbs = Math.abs(roll || 0);

        if (pitchAbs > this.config.pitch.max || rollAbs > this.config.roll.max) {
            return QC_FLAGS.FAIL;
        }

        if (pitchAbs > this.config.pitch.suspect || rollAbs > this.config.roll.suspect) {
            return QC_FLAGS.SUSPECT;
        }

        return QC_FLAGS.PASS;
    }

    /**
     * Correlation Test - Check beam correlation
     */
    correlationTest(correlation) {
        if (correlation === null || correlation === undefined || isNaN(correlation)) {
            return QC_FLAGS.MISSING;
        }

        if (correlation < this.config.correlation.min) {
            return QC_FLAGS.FAIL;
        }

        if (correlation < this.config.correlation.suspect) {
            return QC_FLAGS.SUSPECT;
        }

        return QC_FLAGS.PASS;
    }

    /**
     * Echo Intensity Test - Check signal strength
     */
    echoIntensityTest(echo) {
        if (echo === null || echo === undefined || isNaN(echo)) {
            return QC_FLAGS.MISSING;
        }

        if (echo < this.config.echoIntensity.min) {
            return QC_FLAGS.FAIL;
        }

        if (echo < this.config.echoIntensity.suspect) {
            return QC_FLAGS.SUSPECT;
        }

        return QC_FLAGS.PASS;
    }

    /**
     * Percent Good Test - Check percentage of good pings
     */
    percentGoodTest(percentGood) {
        if (percentGood === null || percentGood === undefined || isNaN(percentGood)) {
            return QC_FLAGS.MISSING;
        }

        if (percentGood < this.config.percentGood.min) {
            return QC_FLAGS.FAIL;
        }

        if (percentGood < this.config.percentGood.suspect) {
            return QC_FLAGS.SUSPECT;
        }

        return QC_FLAGS.PASS;
    }

    /**
     * Run all QA/QC tests on dataset
     */
    runAllTests(data) {
        const results = data.map((record, index) => {
            const qc = {
                timestamp: record.timestamp,
                flags: {},
                overallFlag: QC_FLAGS.PASS
            };

            // Extract velocity values for time-series tests
            const velocityValues = data.map(r => {
                // Handle different data structures
                if (r.speed !== undefined) return r.speed;
                if (r.velocities?.v1?.[0] !== undefined) return r.velocities.v1[0];
                if (r.velocities?.Vel1 !== undefined) return r.velocities.Vel1;
                return null;
            });

            // Range tests
            const velocity = velocityValues[index];
            if (velocity !== null) {
                qc.flags.velocityRange = this.rangeTest(velocity, 'velocity');
            }

            if (record.pitch !== undefined) {
                qc.flags.pitchRange = this.rangeTest(record.pitch, 'pitch');
            }

            if (record.roll !== undefined) {
                qc.flags.rollRange = this.rangeTest(record.roll, 'roll');
            }

            // Time-series tests
            if (velocity !== null) {
                qc.flags.spike = this.spikeTest(velocityValues, index);
                qc.flags.rateOfChange = this.rateOfChangeTest(velocityValues, index);
            }

            // Tilt test
            if (record.pitch !== undefined || record.roll !== undefined) {
                qc.flags.tilt = this.tiltTest(record.pitch, record.roll);
            }

            // Correlation test (for ADCP data)
            if (record.correlation) {
                const corrValue = Object.values(record.correlation)[0];
                if (corrValue !== undefined) {
                    qc.flags.correlation = this.correlationTest(corrValue);
                }
            }

            // Echo intensity test
            if (record.echo) {
                const echoValue = Object.values(record.echo)[0];
                if (echoValue !== undefined) {
                    qc.flags.echo = this.echoIntensityTest(echoValue);
                }
            }

            // Percent good test
            if (record.percentGood) {
                const pgValue = Object.values(record.percentGood)[0];
                if (pgValue !== undefined) {
                    qc.flags.percentGood = this.percentGoodTest(pgValue);
                }
            }

            // Calculate overall flag (worst flag wins)
            const flagValues = Object.values(qc.flags).filter(f => f !== QC_FLAGS.NOT_EVALUATED);
            if (flagValues.length > 0) {
                qc.overallFlag = Math.max(...flagValues);
            }

            return qc;
        });

        return results;
    }

    /**
     * Generate QA/QC summary statistics
     */
    generateSummary(qcResults) {
        const summary = {
            total: qcResults.length,
            pass: 0,
            suspect: 0,
            fail: 0,
            missing: 0,
            notEvaluated: 0,
            testResults: {}
        };

        // Count overall flags
        qcResults.forEach(result => {
            switch (result.overallFlag) {
                case QC_FLAGS.PASS:
                    summary.pass++;
                    break;
                case QC_FLAGS.SUSPECT:
                    summary.suspect++;
                    break;
                case QC_FLAGS.FAIL:
                    summary.fail++;
                    break;
                case QC_FLAGS.MISSING:
                    summary.missing++;
                    break;
                case QC_FLAGS.NOT_EVALUATED:
                    summary.notEvaluated++;
                    break;
            }

            // Count individual test results
            Object.entries(result.flags).forEach(([test, flag]) => {
                if (!summary.testResults[test]) {
                    summary.testResults[test] = {
                        pass: 0,
                        suspect: 0,
                        fail: 0,
                        missing: 0,
                        notEvaluated: 0
                    };
                }

                switch (flag) {
                    case QC_FLAGS.PASS:
                        summary.testResults[test].pass++;
                        break;
                    case QC_FLAGS.SUSPECT:
                        summary.testResults[test].suspect++;
                        break;
                    case QC_FLAGS.FAIL:
                        summary.testResults[test].fail++;
                        break;
                    case QC_FLAGS.MISSING:
                        summary.testResults[test].missing++;
                        break;
                    case QC_FLAGS.NOT_EVALUATED:
                        summary.testResults[test].notEvaluated++;
                        break;
                }
            });
        });

        // Calculate percentages
        summary.passPercent = ((summary.pass / summary.total) * 100).toFixed(1);
        summary.suspectPercent = ((summary.suspect / summary.total) * 100).toFixed(1);
        summary.failPercent = ((summary.fail / summary.total) * 100).toFixed(1);

        return summary;
    }
}
