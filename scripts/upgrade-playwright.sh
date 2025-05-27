OLD_VERSION=$1
NEW_VERSION=$2

if [ -z "$OLD_VERSION" ] || [ -z "$NEW_VERSION" ]; then
    echo "Error: Please provide both the old and new Playwright versions!"
    echo "\nUsage: upgrade-playwright [old version number] [new version number]"
    exit 1
fi

npm up @playwright/test --save

find ./e2e/docker/Dockerfile.playwright -type f -exec sed -i "" "s/$OLD_VERSION/$NEW_VERSION/g" {} \;

