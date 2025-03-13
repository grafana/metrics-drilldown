#!/bin/bash

commit_sha=$(git rev-parse HEAD)

echo "export const GIT_COMMIT = '$commit_sha';" > src/version.ts
