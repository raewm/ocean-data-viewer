# Ocean Data Viewer

A comprehensive web application for viewing, analyzing, and performing QA/QC on oceanographic current meter data.

## Features

- **Multi-Instrument Support**: Handles data from Nortek Aquadopp, AWAC, and Teledyne RDI Workhorse ADCP instruments
- **Interactive Visualizations**: Time series plots, velocity profiles, and data tables
- **Quality Control**: Automated QA/QC analysis based on IOOS QARTOD standards
- **Data Export**: Export data and graphics in multiple formats (CSV, Excel, PNG, SVG)
- **Time Range Filtering**: Focus on specific time periods
- **Modern UI**: Clean, oceanographic-themed interface

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

### Setup

1. Navigate to the project directory:
```bash
cd ocean-data-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (usually http://localhost:3000)

## Usage

### Loading Data

1. Click the upload area or drag and drop files
2. For **Nortek instruments**: Upload multiple files (.hdr, .sen, .v1/.v2/.v3, .a1/.a2/.a3) from the same deployment
3. For **RDI instruments**: Upload CSV or ASCII export files

### Analyzing Data

1. **View Data**: Use the tabs to switch between time series, profile, and table views
2. **Adjust Time Range**: Use the time range selector to focus on specific periods
3. **Run QA/QC**: Configure thresholds and run automated quality control tests
4. **Export Results**: Download data and graphics in your preferred format

### QA/QC Tests

The application implements the following quality control tests:

- **Range Test**: Values within sensor and expected ranges
- **Spike Test**: Detection of unrealistic spikes
- **Rate of Change Test**: Excessive temporal gradients
- **Pitch/Roll Test**: Instrument tilt monitoring
- **Correlation Test**: Beam correlation quality (ADCP)
- **Echo Intensity Test**: Signal strength evaluation
- **Percent Good Test**: Ping success rate

## Supported File Formats

### Nortek Aquadopp/AWAC

- `.hdr` - Header file with instrument configuration
- `.sen` - Sensor data (heading, pitch, roll, temperature, pressure)
- `.v1`, `.v2`, `.v3` - Velocity components
- `.a1`, `.a2`, `.a3` - Amplitude data
- `.dat` - Combined velocity and direction data

### Teledyne RDI Workhorse ADCP

- `.csv` - CSV export from RDI software
- `.txt` - ASCII format export

## Sample Data

Sample data files are provided in the `sample-data` directory for testing:

- `sample-data/nortek/` - Example Nortek files
- `sample-data/rdi/` - Example RDI files

## Building for Production

To create an optimized production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technology Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Plotly.js** - Interactive charts
- **AG-Grid** - High-performance data tables
- **Papa Parse** - CSV parsing
- **XLSX** - Excel export

## Future Enhancements

Planned for future versions:

- Binary file format support (direct parsing of `.prf`, `.wpr` files)
- Machine learning-based anomaly detection
- Advanced statistical analysis
- Multi-deployment comparison
- Spectral analysis tools
- Custom report generation

## Development Guidelines

### Versioning
This project follows a strict **MAJOR.MINOR.PATCH** semantic versioning system. All changes MUST be accompanied by a version increment:
- **MAJOR**: Incompatible API changes or complete architectural overhauls.
- **MINOR**: New features (backwards compatible) or significant functional enhancements (e.g., v1.4.3 -> v1.5.0).
- **PATCH**: Bug fixes, performance improvements, or minor styling tweaks.

The version must be updated in:
1. `package.json` ("version" field)
2. `src/App.jsx` (Footer display)

## License

MIT License

## Support

For issues or questions, please contact your system administrator.
