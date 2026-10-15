import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const rootDir = process.cwd();
const configPath = path.join(rootDir, 'scripts', 'bundle-budget.json');

if (!fs.existsSync(configPath)) {
  // eslint-disable-next-line no-console
  console.error(`[bundle-budget] Config not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const distDir = path.join(rootDir, config.distDir || 'dist-build/assets');

if (!fs.existsSync(distDir)) {
  // eslint-disable-next-line no-console
  console.error(`[bundle-budget] Dist directory not found: ${distDir}`);
  process.exit(1);
}

const includeExtensions = new Set(config.includeExtensions || ['.js', '.mjs', '.css']);
const defaultMaxGzipKB = Number(config.defaultMaxGzipKB || 180);
const budgets = Array.isArray(config.budgets) ? config.budgets : [];

const toRegExp = (pattern) =>
  new RegExp(`^${String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

const budgetMatchers = budgets.map((entry) => ({
  pattern: entry.pattern,
  regex: toRegExp(entry.pattern),
  maxGzipKB: Number(entry.maxGzipKB),
}));

const files = fs
  .readdirSync(distDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => includeExtensions.has(path.extname(name)));

const violations = [];

for (const name of files) {
  const absolutePath = path.join(distDir, name);
  const raw = fs.readFileSync(absolutePath);
  const gzipBytes = zlib.gzipSync(raw).length;
  const gzipKB = gzipBytes / 1024;

  const matched = budgetMatchers.find((budget) => budget.regex.test(name));
  const limit = matched?.maxGzipKB ?? defaultMaxGzipKB;
  if (gzipKB > limit) {
    violations.push({
      name,
      gzipKB,
      limit,
      rule: matched?.pattern ?? 'defaultMaxGzipKB',
    });
  }
}

if (violations.length > 0) {
  // eslint-disable-next-line no-console
  console.error('\n[bundle-budget] Budget violations found:\n');
  for (const item of violations.sort((a, b) => b.gzipKB - a.gzipKB)) {
    // eslint-disable-next-line no-console
    console.error(
      `- ${item.name}: ${item.gzipKB.toFixed(2)}KB > ${item.limit.toFixed(2)}KB (rule: ${item.rule})`
    );
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`[bundle-budget] OK: checked ${files.length} assets in ${config.distDir}`);
