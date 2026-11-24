const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'backups']);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/,
  /\bwhsec_[A-Za-z0-9]{20,}\b/,
];

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name) || entry.name.startsWith('.env')) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

const findings = [];
for (const file of files(root)) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (_) {
    continue;
  }
  content.split(/\r?\n/).forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      findings.push(`${path.relative(root, file)}:${index + 1}`);
    }
  });
}

if (findings.length) {
  console.error(`Potential secrets found (values suppressed):\n${findings.join('\n')}`);
  process.exit(1);
}
console.log('No high-confidence secret patterns found');
