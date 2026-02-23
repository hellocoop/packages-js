#!/bin/bash
set -e

# Usage: npm run release [-- patch|minor|major]
# Defaults to "patch" if no argument given.
#
# Runs tests, uses lerna to bump versions of changed packages,
# pushes commits and tags, then creates a GitHub Release
# which triggers the release.yml workflow to publish to npm with provenance.

BUMP="${1:-patch}"

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
    echo "Usage: npm run release [-- patch|minor|major]"
    exit 1
fi

# Check for clean working tree
if ! git diff-index --quiet HEAD --; then
    echo "Error: uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Check we're on main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo "Error: must be on main branch (currently on $BRANCH)"
    exit 1
fi

# Check gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "Error: gh CLI not found. Install it: https://cli.github.com"
    exit 1
fi

# Pull latest
echo "Pulling latest from origin..."
git pull origin main

# Build all packages
echo "Building..."
npm run build

# Run tests
echo "Running tests..."
lerna run test

# Bump versions of changed packages (creates git commits and tags)
echo "Bumping $BUMP versions for changed packages..."
lerna version "$BUMP" --yes

# Push commits and tags
echo "Pushing to origin..."
git push origin main --follow-tags

# Get the tags that were just created
TAGS=$(git tag --points-at HEAD)
if [ -z "$TAGS" ]; then
    echo "No tags found at HEAD. Nothing was versioned."
    exit 0
fi

# Create a GitHub Release from the first tag (triggers release.yml)
RELEASE_TAG=$(echo "$TAGS" | head -1)
echo "Creating GitHub Release for $RELEASE_TAG..."
gh release create "$RELEASE_TAG" \
    --title "$RELEASE_TAG" \
    --generate-notes

echo ""
echo "Release $RELEASE_TAG created!"
echo "The GitHub Actions workflow will now publish to npm with provenance."
echo ""
echo "All tags created:"
echo "$TAGS"
echo ""
echo "Monitor at: https://github.com/hellocoop/packages-js/actions"
