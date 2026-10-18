#!/usr/bin/env node
/**
 * Naive baseline for GraphFlow evals.
 *
 * Token estimate: ceil(characterLength / 4). This is a stable stand-in for a
 * model tokenizer so two machines report the same number for the same text.
 * It is not cl100k or o200k. Compare ratios, not absolute model bills.
 *
 * Search baseline: literal substring scan with 2 lines of context, overlapping
 * lines counted once. This is the "ripgrep the repo, then read the hits"
 * cost, without requiring ripgrep to be installed.
 */
import fs from "node:fs";
import path from "node:path";

export const ESTIMATION_METHOD = "ceil(chars/4)";

export const ESTIMATION_NOTE =
  "tokens = ceil(character length / 4). Naive search adds a 2-line context window and counts each line once. Not a model tokenizer.";

export function estimateTokens(text) {
  const value = typeof text === "string" ? text : "";
  if (value.length === 0) return 0;
  return Math.ceil(value.length / 4);
}

export function readText(rootDir, relPath) {
  const abs = path.resolve(rootDir, relPath);
  return fs.readFileSync(abs, "utf8");
}

export function estimateFileTokens(rootDir, relPath) {
  const text = readText(rootDir, relPath);
  return {
    file: relPath.replace(/\\/g, "/"),
    chars: text.length,
    tokens: estimateTokens(text),
  };
}

export function estimateFilesTokens(rootDir, relPaths) {
  const files = (relPaths ?? []).map((relPath) => estimateFileTokens(rootDir, relPath));
  return {
    files,
    chars: files.reduce((sum, file) => sum + file.chars, 0),
    tokens: files.reduce((sum, file) => sum + file.tokens, 0),
  };
}

function listFiles(rootDir, relPath) {
  const abs = path.resolve(rootDir, relPath);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "target" || entry.name === "__pycache__" || entry.name === ".git") {
      continue;
    }
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(rootDir, path.relative(rootDir, child)));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

/**
 * @param {string} rootDir
 * @param {string} query literal substring
 * @param {string[]} relPaths files or directories
 * @param {number} contextLines
 */
export function naiveSearch(rootDir, query, relPaths, contextLines = 2) {
  const hits = [];
  const matched = new Set();
  if (!query) return { query, hitCount: 0, tokens: 0, files: [] };
  for (const relPath of relPaths ?? []) {
    for (const abs of listFiles(rootDir, relPath)) {
      const text = fs.readFileSync(abs, "utf8");
      const lines = text.split(/\r?\n/);
      const hitLines = [];
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].includes(query)) hitLines.push(i);
      }
      if (hitLines.length === 0) continue;
      const kept = new Set();
      for (const lineNo of hitLines) {
        for (let i = Math.max(0, lineNo - contextLines); i <= Math.min(lines.length - 1, lineNo + contextLines); i += 1) {
          kept.add(i);
        }
      }
      const snippet = [...kept].sort((a, b) => a - b).map((i) => lines[i]).join("\n");
      const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
      matched.add(rel);
      hits.push({ file: rel, count: hitLines.length, tokens: estimateTokens(snippet) });
    }
  }
  return {
    query,
    hitCount: hits.reduce((sum, hit) => sum + hit.count, 0),
    tokens: hits.reduce((sum, hit) => sum + hit.tokens, 0),
    files: [...matched],
  };
}

function main() {
  const rel = process.argv[2];
  if (!rel) {
    console.error("usage: node scripts/baseline-naive.mjs <file-or-dir> [literal-query]");
    process.exitCode = 1;
    return;
  }
  const rootDir = process.cwd();
  const files = estimateFilesTokens(rootDir, [rel]);
  const query = process.argv[3];
  const payload = query ? { ...files, search: naiveSearch(rootDir, query, [rel]) } : files;
  console.log(JSON.stringify(payload, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
