import semver from 'semver';

// Usage: node bump-version.js <PART> <VERSION>
//
// Example:
//   node bump-version.js minor 1.2.3  # Outputs 1.3.0
const partStr = process.argv[2];
const versionStr = process.argv[3];
const version = semver.parse(versionStr);
version.inc(partStr);
console.log(version.toString());
