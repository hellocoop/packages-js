#!/bin/bash

# Docker Publish Script for Hello MCP Server
# Builds multi-architecture images (arm64, amd64) and pushes to Docker Hub
# Only publishes if the version doesn't already exist

set -e  # Exit on any error

# Configuration
DOCKER_USERNAME="hellocoop"
IMAGE_NAME="mcp"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🐳 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
print_status "Checking Hello MCP Server v${VERSION} for publish"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if version already exists on Docker Hub
print_status "Checking if v${VERSION} already exists on Docker Hub..."
if curl -s "https://registry.hub.docker.com/v2/repositories/${FULL_IMAGE_NAME}/tags/v${VERSION}/" | grep -q '"name"'; then
    print_warning "Version v${VERSION} already exists on Docker Hub"
    print_status "Skipping publish. Use Lerna to bump version if needed."
    exit 0
fi

print_success "Version v${VERSION} not found on Docker Hub. Proceeding with publish..."

# Test authentication by checking if we can access Docker Hub
if ! docker pull hello-world >/dev/null 2>&1; then
    print_warning "Unable to pull from Docker Hub. Please check your Docker login."
    print_status "To authenticate, run: docker login"
    exit 1
fi

print_status "Will push to: ${FULL_IMAGE_NAME}"

# Create builder instance if it doesn't exist
print_status "Setting up Docker buildx..."
docker buildx create --name multiarch-builder --use --bootstrap 2>/dev/null || docker buildx use multiarch-builder

# Build and push multi-architecture image
print_status "Building and pushing multi-architecture image..."
print_status "Platforms: linux/amd64, linux/arm64"
print_status "Tags: latest, v${VERSION}"

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag "${FULL_IMAGE_NAME}:latest" \
    --tag "${FULL_IMAGE_NAME}:v${VERSION}" \
    --push \
    .

print_success "Successfully published ${FULL_IMAGE_NAME}:v${VERSION}"
print_success "Available tags:"
echo "  - ${FULL_IMAGE_NAME}:latest"
echo "  - ${FULL_IMAGE_NAME}:v${VERSION}"

print_status "Image can be run with:"
echo "  docker run -p 3000:3000 ${FULL_IMAGE_NAME}:latest"
echo ""
print_status "Or with environment variables:"
echo "  docker run -p 3000:3000 ${FULL_IMAGE_NAME}:latest"

print_success "Docker publish completed!" 