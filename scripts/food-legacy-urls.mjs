import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE_ORIGIN = 'https://proved.kr';
const REGISTRY_PATH = 'scripts/legacy-food-paths.json';

// Match only generator-owned product URLs. Never guess a destination from product names.
export function identifyProductPath(value) {
  try {
    const url = new URL(value, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || url.search || url.hash) return null;
    const pathname = decodeURIComponent(url.pathname);
    const match = pathname.match(/^\/food\/(cat|dog)\/([a-z0-9가-힣-]+--([a-f0-9]{8}))\/$/i);
    if (!match) return null;
    return { path: pathname, identity: match[1].toLowerCase() + ':' + match[3].toLowerCase() };
  } catch {
    return null;
  }
}

export function extractProductPathsFromSitemap(xml) {
  const paths = [];
  for (const match of String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const entry = identifyProductPath(match[1].replace(/&amp;/g, '&'));
    if (entry) paths.push(entry.path);
  }
  return paths;
}

function gitOutput(repoRoot, args) {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return '';
  }
}

// Historical sitemap commits recover paths already removed by past regenerations.
// The registry keeps recovered paths even when Git history is later shallow or rewritten.
export async function collectLegacyProductPaths(repoRoot) {
  const paths = new Set();
  const add = (value) => {
    const parsed = identifyProductPath(value);
    if (parsed) paths.add(parsed.path);
  };

  try {
    const saved = JSON.parse(await readFile(path.join(repoRoot, REGISTRY_PATH), 'utf8'));
    if (Array.isArray(saved)) saved.forEach(add);
  } catch { /* First generation or missing registry. */ }

  try {
    extractProductPathsFromSitemap(await readFile(path.join(repoRoot, 'sitemap-foods.xml'), 'utf8')).forEach(add);
  } catch { /* First generation. */ }

  const revisions = gitOutput(repoRoot, ['log', '--format=%H', '--', 'sitemap-foods.xml'])
    .split(/\s+/)
    .filter(revision => /^[0-9a-f]{40}$/.test(revision))
    .slice(0, 250);
  for (const revision of revisions) {
    const snapshot = gitOutput(repoRoot, ['show', revision + ':sitemap-foods.xml']);
    extractProductPathsFromSitemap(snapshot).forEach(add);
  }
  return [...paths].sort();
}

function redirectHtml(targetPath) {
  const target = new URL(targetPath, SITE_ORIGIN).href;
  const safe = target.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>제품 상세페이지로 이동 중 | 프루브</title>
<link rel="canonical" href="${safe}">
<meta http-equiv="refresh" content="0;url=${safe}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</head>
<body><main><p>제품 상세페이지 주소가 변경되었습니다.</p><p><a href="${safe}">현재 제품 정보 보기</a></p></main></body>
</html>
`;
}

export async function restoreLegacyProductUrls(repoRoot, previousPaths, currentEntries) {
  const activePaths = new Set();
  const byIdentity = new Map();
  const ambiguous = new Set();
  for (const entry of currentEntries) {
    if (entry.kind !== 'product') continue;
    const parsed = identifyProductPath(entry.path);
    if (!parsed) throw new Error('생성된 제품 URL 형식이 올바르지 않습니다: ' + entry.path);
    activePaths.add(parsed.path);
    if (byIdentity.has(parsed.identity) && byIdentity.get(parsed.identity) !== parsed.path) {
      ambiguous.add(parsed.identity);
    }
    byIdentity.set(parsed.identity, parsed.path);
  }

  const aliases = [];
  for (const legacyPath of previousPaths) {
    const parsed = identifyProductPath(legacyPath);
    if (!parsed || activePaths.has(parsed.path) || ambiguous.has(parsed.identity)) continue;
    const targetPath = byIdentity.get(parsed.identity);
    if (!targetPath) continue; // Deleted/unpublished products must not redirect to a different product.
    const outputPath = path.join(repoRoot, parsed.path.replace(/^\//, ''), 'index.html');
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, redirectHtml(targetPath), 'utf8');
    aliases.push(parsed.path);
  }

  aliases.sort();
  await writeFile(path.join(repoRoot, REGISTRY_PATH), JSON.stringify(aliases, null, 2) + '\n', 'utf8');
  return aliases;
}
