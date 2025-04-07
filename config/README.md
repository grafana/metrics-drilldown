# Configuration Files

## Prometheus Configuration

The Prometheus configuration is set up to use different files based on the Grafana port.

### How it works

1. In `docker-compose.yaml`, we mount a configuration file based on the current `GRAFANA_PORT` value:

   ```yaml
   volumes:
     - ./config/prometheus.${GRAFANA_PORT:-3001}.yaml:/etc/prometheus/prometheus.yml
   ```

2. This means:
   - If `GRAFANA_PORT=3000`, it will use `prometheus.3000.yaml`
   - If `GRAFANA_PORT=3001`, it will use `prometheus.3001.yaml`
   - And so on...

### Adding support for a new port

If you need to run Grafana on a different port (e.g., 3002):

1. Create a new file named `config/prometheus.3002.yaml`
2. Copy the content from an existing file (e.g., `prometheus.3001.yaml`)
3. Update the port in the targets section:

   ```yaml
   scrape_configs:
     - job_name: grafana
       static_configs:
         - targets:
             - host.docker.internal:3002
   ```

4. Set `GRAFANA_PORT=3002` in your `.env` file
5. Restart the containers with `docker-compose down && docker-compose up -d`

This approach allows flexible port configuration while keeping the configuration files simple and explicit.
