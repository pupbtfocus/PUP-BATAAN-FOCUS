#!/bin/bash
set -e
echo "PUP-FOCUS Build Script"
echo "====================="
npm install
npm run build
echo "Build completed successfully"
