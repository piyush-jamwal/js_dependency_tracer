#!/usr/bin/env node
'use strict';

const path = require('path');
const { parseFile } = require('../src/index.js');

function printUsageAndExit() {
  console.error('Usage: js-dependency-tracer <entry-file> [max-depth]');
  process.exit(1);
}

const entryFile = process.argv[2];
if (!entryFile) {
  printUsageAndExit();
}

const depthArg = process.argv[3];
let maxDepth = Infinity;
if (depthArg !== undefined && depthArg !== '') {
  const n = Number(depthArg);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`Invalid max-depth: ${depthArg}. Must be a non-negative integer.`);
    process.exit(1);
  }
  maxDepth = n;
}

try {
  const tree = parseFile(path.resolve(entryFile), maxDepth);
  process.stdout.write(JSON.stringify(tree, null, 2) + '\n');
} catch (err) {
  console.error(err?.stack || String(err));
  process.exit(1);
}
