# List of projects to provide to the make-docs script.
# Format is PROJECT[:[VERSION][:[REPOSITORY][:[DIRECTORY]]]]
# The following PROJECTS value mounts:
REPO_DIR := $(notdir $(basename $(shell git rev-parse --show-toplevel)))
PROJECTS := grafana-cloud/visualizations/simplified-exploration/metrics:UNVERSIONED:$(REPO_DIR):
