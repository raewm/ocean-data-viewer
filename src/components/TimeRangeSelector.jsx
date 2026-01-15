import React from 'react';

export default function TimeRangeSelector({ data, onRangeChange, currentRange }) {
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');

    React.useEffect(() => {
        if (data && data.length > 0) {
            const timestamps = data.map(r => new Date(r.timestamp)).filter(t => !isNaN(t));

            if (timestamps.length > 0) {
                const minDate = new Date(Math.min(...timestamps));
                const maxDate = new Date(Math.max(...timestamps));

                // Format for datetime-local input
                const formatForInput = (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                };

                setStartDate(formatForInput(minDate));
                setEndDate(formatForInput(maxDate));
            }
        }
    }, [data]);

    const handleApply = () => {
        if (startDate && endDate) {
            onRangeChange({
                start: new Date(startDate).toISOString(),
                end: new Date(endDate).toISOString()
            });
        }
    };

    const handleReset = () => {
        if (data && data.length > 0) {
            const timestamps = data.map(r => new Date(r.timestamp)).filter(t => !isNaN(t));

            if (timestamps.length > 0) {
                onRangeChange({
                    start: new Date(Math.min(...timestamps)).toISOString(),
                    end: new Date(Math.max(...timestamps)).toISOString()
                });
            }
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h3>🕐 Time Range</h3>
            </div>

            <div className="grid grid-2">
                <div>
                    <label htmlFor="start-date">Start Time</label>
                    <input
                        id="start-date"
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="end-date">End Time</label>
                    <input
                        id="end-date"
                        type="datetime-local"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex gap-2 mt-2">
                <button className="btn-primary" onClick={handleApply}>
                    Apply Range
                </button>
                <button className="btn-secondary" onClick={handleReset}>
                    Reset to Full Range
                </button>
            </div>
        </div>
    );
}
