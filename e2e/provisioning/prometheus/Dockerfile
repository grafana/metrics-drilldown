FROM docker.io/prom/prometheus:v3.1.0

USER nobody

# data from ~ 2025-02-18 14:35 to 2025-02-18 17:05
COPY e2e/provisioning/prometheus/data.zip /prometheus/data.zip
RUN unzip /prometheus/data.zip 
RUN rm /prometheus/data.zip 

COPY e2e/provisioning/prometheus/prometheus.yml /etc/prometheus/prometheus.yml
