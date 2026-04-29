#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('PUP-FOCUS Build Script');
console.log('=====================');

try {
  console.log('Running: npm run build');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully');
  process.exit(0);
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
