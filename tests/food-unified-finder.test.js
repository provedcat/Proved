const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "food/index.html"), "utf8");
const legacy = fs.readFileSync(
  path.join(root, "food/conditions/index.html"),
  "utf8",
);
const script = fs.readFileSync(path.join(root, "js/food-list.js"), "utf8");
const header = fs.readFileSync(path.join(root, "js/proved-header.js"), "utf8");
const blob = fs.readFileSync(path.join(root, "js/product-tag-blob.js"), "utf8");
const extraTags = fs.readFileSync(
  path.join(root, "js/food-basic-extra-tags.js"),
  "utf8",
);
const routes = fs.readFileSync(path.join(root, "js/food-route.js"), "utf8");

assert.match(
  html,
  /data-species="all" aria-pressed="true">\s*전체/,
  "all species must be the default control",
);
assert.match(
  html,
  /id="foodConditionFolders"\s+class="condition-folders"/,
  "the signature folder stage must live on /food/",
);
assert.match(
  script,
  /species:\s*["']all["']/,
  "canonical state must default to all species",
);
assert.match(
  script,
  /params\.get\(["']species["']\)[\s\S]*?["']cat["'][\s\S]*?["']dog["'][\s\S]*?["']all["']/,
  "missing and invalid species URL values must restore to all",
);
assert.match(
  script,
  /state\.species\s*===\s*["']all["']\s*\?[\s\S]*?["']cat["'][\s\S]*?["']dog["']/,
  "all must query both species",
);
assert.match(
  script,
  /Promise\.all\(species\.map\(fetchSpeciesRows\)\)/,
  "species result sets must be merged before rendering",
);
assert.match(
  script,
  /ids\.size\s*===\s*required\.size/,
  "tag mappings must use AND semantics",
);
assert.match(
  script,
  /buildProductPath\(feed, feed\.species\)/,
  "result routes must use the row species",
);
assert.match(
  script,
  /foodFinder[\s\S]*?scrollY[\s\S]*?loaded/,
  "detail navigation must retain list scroll position",
);
assert.match(script, /\.select\(listColumns, \{ count: "exact" \}\)/, "each species query must return an exact filtered count");
assert.match(script, /제품명\.ilike\.\$\{pattern\},제조사\.ilike\.\$\{pattern\}/, "search must be applied by Supabase");
assert.match(script, /\.range\(0, state\.loaded - 1\)/, "catalog reads must be bounded to the requested result window");
const feedQuery = script.slice(script.indexOf("async function fetchSpeciesRows"), script.indexOf("function sortRows"));
assert.doesNotMatch(feedQuery, /for \(let from = 0; ;/, "feed tables must not be downloaded to exhaustion");
assert.match(script, /<a class="food-result \$\{semantic\}" href="\$\{escapeHtml\(productPath\)\}"/, "results must be crawlable product links");
assert.doesNotMatch(script, /stateParams\(true|feed_species/, "canonical details must not use Finder query identity");
assert.match(routes, /PRODUCT_ROUTE_RE/);
assert.match(routes, /__PROVED_FOOD_PAGE__/);
assert.match(routes, /function readDetailRoute/);
assert.match(
  legacy,
  /location\.replace\(["']\/food\/["']\s*\+\s*location\.search\s*\+\s*location\.hash\)/,
  "legacy route must preserve its query and hash",
);
assert.doesNotMatch(
  legacy,
  /condition-folder/,
  "legacy route must not retain duplicate finder UI",
);
assert.match(header, /label:\s*["']사료 찾기["'],\s*href:\s*["']\/food\/["']/);
assert.doesNotMatch(header, /label:\s*["']조건으로 찾기["']/);
assert.match(blob, /ProvedFoodRoutes\?\.readDetailRoute\(\)/);
assert.match(extraTags, /ProvedFoodRoutes\?\.readDetailRoute\(\)/);

console.log("unified food finder tests passed");
