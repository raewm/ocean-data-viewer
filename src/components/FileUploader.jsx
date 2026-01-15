import React, { useCallback } from 'react';

export default function FileUploader({ onFilesSelected }) {
    const [isDragging, setIsDragging] = React.useState(false);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFilesSelected(files);
        }
    }, [onFilesSelected]);

    const handleFileInput = useCallback((e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            onFilesSelected(files);
        }
    }, [onFilesSelected]);

    return (
        <div className="card">
            <div className="card-header">
                <h3>📂 Load Data Files</h3>
            </div>

            <div
                className={`upload-zone ${isDragging ? 'active' : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
            >
                <div className="upload-icon">📊</div>
                <h3>Drop files here or click to browse</h3>
                <p className="text-muted">
                    Supports Nortek (.hdr, .sen, .v1/.v2/.v3, .a1/.a2/.a3, .dat) and RDI (.csv, .txt) files
                </p>
                <p className="text-muted mt-1">
                    <small>Multiple files can be selected for Nortek instruments</small>
                </p>
            </div>

            <input
                id="file-input"
                type="file"
                multiple
                accept=".hdr,.sen,.v1,.v2,.v3,.a1,.a2,.a3,.dat,.csv,.txt"
                onChange={handleFileInput}
                style={{ display: 'none' }}
            />
        </div>
    );
}
