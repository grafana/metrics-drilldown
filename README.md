# Grafana Metrics Drilldown

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/grafana/metrics-drilldown)](https://github.com/grafana/metrics-drilldown/releases)
[![GitHub contributors](https://img.shields.io/github/contributors/grafana/metrics-drilldown)](https://github.com/grafana/metrics-drilldown/graphs/contributors)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

A queryless experience for browsing Prometheus-compatible metrics. Quickly find related metrics without writing PromQL queries.

![Metrics Drilldown](src/img/metrics-drilldown.png)

## 📖 Overview

Grafana Metrics Drilldown transforms how you explore Prometheus-compatible metrics by providing an intuitive, queryless interface. Built with React 18 and Grafana's Scenes framework for declarative state management, it uses WASM optimizations for performance-critical operations like sorting. Instead of writing complex PromQL queries, simply click through your metrics to discover insights and relationships.

### Key Features

- **🔍 Queryless Exploration**: Browse metrics without writing PromQL
- **🏷️ Smart Segmentation**: Filter and segment metrics by labels to spot anomalies
- **📊 Auto-Visualization**: Optimal chart types selected automatically (gauge vs counter)
- **🔗 Metric Relationships**: Discover related metrics effortlessly
- **🌐 Telemetry Pivoting**: Seamlessly jump between metrics and logs
- **⚡ Advanced Filtering**: Filter by metric name prefixes/suffixes and group by labels
- **📱 Modern UI**: Collapsible sidebar and enhanced user experience

### Recent Enhancements

- **Native Histogram Support**: Higher resolution for Prometheus-compatible histograms
- **OpenTelemetry Integration**: Automated label joins for OTel metrics
- **Exemplars**: Direct links from metrics to corresponding traces
- **Enhanced Filtering**: Prefix/suffix filtering and label grouping
- **Scenes Framework**: Declarative UI state management instead of Redux
- **Event-Driven Architecture**: Components communicate via scene events (MetricSelectedEvent, EventFiltersChanged)
- **WASM Performance**: Optimized sorting algorithms for large metric sets

## 🚀 Quick Start

### Installation

#### Via Grafana CLI (Recommended)

```bash
grafana cli plugins install grafana-metricsdrilldown-app
```

#### Via Grafana Cloud

One-click installation available through the Grafana Cloud marketplace.

#### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/grafana/metrics-drilldown/releases)
2. Extract to your Grafana plugins directory (default: `/var/lib/grafana/plugins`)
3. Restart Grafana
4. Enable the plugin in Grafana's plugin configuration

### Enabling the Plugin

1. Navigate to **Configuration > Plugins** in Grafana
2. Find "Grafana Metrics Drilldown" in the Apps section
3. Click **Config** and then **Enable**

## 🎯 Usage

### Basic Workflow

1. **Navigate** to the Metrics Drilldown app in Grafana
2. **Select** a Prometheus-compatible data source
3. **Filter** metrics using the sidebar controls
4. **Segment** data by labels to identify patterns
5. **Drill down** into specific metrics for detailed analysis
6. **Export** or share your findings

### Advanced Features

#### Filtering Options

- **Prefix/Suffix Filtering**: Leverage metric naming conventions
- **Label Grouping**: Group metrics by specific label names
- **Pattern Matching**: Find metrics matching specific patterns

#### Visualization

- Automatic chart type selection based on metric type
- Native histogram support for enhanced detail
- Exemplar integration for trace correlation

## 🐛 Troubleshooting

### Common Issues

#### Data Source Compatibility

**Requirement**: Prometheus or Prometheus-compatible data sources only  
**Solution**: Ensure your data source supports PromQL queries

### Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/grafana/metrics-drilldown/issues)
- **Grafana Community**: [Community forums](https://community.grafana.com/)
- **Grafana Cloud Support**: Open a support ticket for urgent issues
- **Documentation**: [Official plugin docs](https://grafana.com/docs/plugins/grafana-metricsdrilldown-app/)

## 🛠️ Development Setup

### Prerequisites

- **Node.js 22+** (required)
- **Docker Desktop** (or alternative like OrbStack)
- **Git**

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/grafana/metrics-drilldown.git
   cd metrics-drilldown
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development environment**

   ```bash
   # Start Grafana server (default port 3001)
   npm run server

   # In another terminal, run plugin in watch mode
   npm run dev
   ```

4. **Access the plugin**
   Visit `http://localhost:3001/a/grafana-metricsdrilldown-app`

### Configuration

Customize the Grafana port via a `.env` file:

```bash
GRAFANA_PORT=3001
```

### Testing

```bash
# Run tests in watch mode
npm run tdd

# Run all tests with coverage
npm run test

# End-to-end tests
npm run e2e

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Build
npm run build
npm run analyze    # Bundle analysis
```

## 📁 Project Structure

```
metrics-drilldown/
├── src/
│   ├── WingmanDataTrail/     # Main metrics exploration interface
│   ├── autoQuery/            # Automatic query generation for different metric types
│   ├── Breakdown/            # Label breakdown and search functionality
│   ├── MetricSelect/         # Metric selection interface
│   ├── TrailStore/           # State persistence and bookmarks
│   ├── tracking/             # Analytics and telemetry (Faro/Rudderstack)
│   ├── App/                  # Main app components and routing
│   └── utils/                # Shared utilities
├── e2e/                      # Playwright end-to-end tests
├── docs/                     # Documentation
├── scripts/                  # Build and utility scripts
├── provisioning/             # Grafana/Docker configuration
└── README.md
```

## 🤝 Contributing

We welcome contributions! This project doesn't have a formal proposal process.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes following the existing code style
4. **Test** your changes thoroughly
5. **Commit** your changes (`git commit -m 'Add amazing feature'`)
6. **Push** to the branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting
- Use meaningful commit messages

### Code Style

- TypeScript (98.7% of codebase)
- ESLint configuration provided
- Prettier formatting enforced

For VSCode users, here's a handy project configuration:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Plugin Page**: [Grafana Plugins](https://grafana.com/grafana/plugins/grafana-metricsdrilldown-app/)
- **Documentation**: [Official Docs](https://grafana.com/docs/plugins/grafana-metricsdrilldown-app/)
- **Demo**: [Grafana Play](https://play.grafana.org/a/grafana-metricsdrilldown-app/trail)
- **Blog**: [What's New in Metrics Drilldown](https://grafana.com/blog/2025/05/29/whats-new-in-grafana-metrics-drilldown-advanced-filtering-options-ui-enhancements-and-more/)

## 🌟 Future Roadmap

- Default installation in all Grafana instances
- Enhanced OTel integration
- Additional data source support
- Improved performance optimizations

---

**Note**: Grafana Metrics Drilldown will be preinstalled by default in all Grafana instances in the near future.

_Maintained by [Grafana Labs](https://grafana.com) with ❤️ from the community_
