#!/bin/bash

url="$1"
expected_response_code="$2"
timeout="$3"
interval="$4"

echo "Checking URL: $url"
echo "Expected response code: $expected_response_code"
echo "Timeout: $timeout seconds"
echo "Interval: $interval seconds"

end_time=$((SECONDS + timeout))

while [ $SECONDS -lt $end_time ]; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

  if [ "$response" -eq "$expected_response_code" ]; then
    echo "Server is up and responding with status code $expected_response_code"
    exit 0
  fi

  echo "Waiting for server to respond with status code $expected_response_code. Current status: $response"
  sleep "$interval"
done

echo "Timeout reached. Server did not respond with status code $expected_response_code within $timeout seconds"
exit 1
