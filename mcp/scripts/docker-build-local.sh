#!/bin/bash

# Local Docker Build Script for Hello MCP Server
# Builds image locally for testing (no push to Docker Hub)

set -e  # Exit on any error

# Configuration
DOCKER_USERNAME="hellocoop"
IMAGE_NAME="mcp"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}🐳 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
print_status "Building Hello MCP Server v${VERSION} locally..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build local image
print_status "Building local Docker image..."
docker build \
    --tag "${FULL_IMAGE_NAME}:latest" \
    --tag "${FULL_IMAGE_NAME}:v${VERSION}" \
    --tag "${FULL_IMAGE_NAME}:local" \
    .

print_success "Successfully built ${FULL_IMAGE_NAME} locally"
print_success "Available local tags:"
echo "  - ${FULL_IMAGE_NAME}:latest"
echo "  - ${FULL_IMAGE_NAME}:v${VERSION}"
echo "  - ${FULL_IMAGE_NAME}:local"

print_status "Test the image with:"
echo "  docker run -p 3000:3000 ${FULL_IMAGE_NAME}:local"
echo ""
print_status "Or with environment variables:"
echo "  docker run -p 3000:3000 ${FULL_IMAGE_NAME}:local"

print_success "Local build completed!" 