const fs = require("fs");
const path = require("path");
const babelParser = require("@babel/parser");

function parseToAst(code, filePath) {
  const fp = String(filePath || "");
  const isTS = fp.endsWith(".ts") || fp.endsWith(".tsx");
  const isFlow = !isTS && /^\s*\/\/\s*@flow/m.test(code);

  const plugins = [
    "jsx",

    "decorators-legacy",
    "classProperties",
    "dynamicImport",
    "optionalChaining",
    "nullishCoalescingOperator",
  ];

  if (isTS) plugins.push("typescript");
  else if (isFlow) plugins.push("flow");

  return babelParser.parse(code, { sourceType: "module", plugins });
}
function looksBinary(buffer) {
  // If it contains a NUL byte, it's almost certainly binary
  return buffer.includes(0);
}

function resolveImportFile(fromDir, spec) {
  const base = path.resolve(fromDir, spec);

  // If import already has an extension
  if (path.extname(base)) {
    const ext = path.extname(base);
    // If it's a recognized source extension, resolve directly
    if ([".js", ".jsx", ".ts", ".tsx"].includes(ext)) {
      if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
      // fall through to try candidates (e.g., directory with same suffix)
    }
    // Otherwise, treat it as extensionless (e.g., ".service" suffix in TS filenames)
  }

  const candidates = [
    `${base}.js`,
    `${base}.jsx`,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {}
  }
  return null;
}

function parseFileNode(absolutePath) {
  if (!fs.existsSync(absolutePath)) return null;

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) return null;

  const buf = fs.readFileSync(absolutePath);
  if (looksBinary(buf)) {
    return {
      file: absolutePath,
      content: null,
      imports: [],
      skipped: "binary",
      _rawImports: [],
    };
  }

  const code = buf.toString("utf8").replace(/^﻿/, "");
  let ast;
  try {
    ast = parseToAst(code, absolutePath);
  } catch (e) {
    console.warn(`Parse failed: ${absolutePath}`);
    console.warn(`Reason: ${e.message}`);
    return {
      file: absolutePath,
      content: code,
      imports: [],
      parseError: e.message,
      _rawImports: [],
    };
  }

  const rawImports = [];
  walkAST(ast, (node) => {
    if (node.type === "ImportDeclaration") {
      rawImports.push(node.source.value);
    }
  });

  return {
    file: absolutePath,
    content: code,
    imports: [],
    _rawImports: rawImports,
  };
}

function resolveImportTarget(fromDir, imp) {
  const resolved = resolveImportFile(fromDir, imp);
  if (resolved) return resolved;
  const base = path.resolve(fromDir, imp);
  const dTs = `${base}.d.ts`;
  if (fs.existsSync(dTs) && fs.statSync(dTs).isFile()) return dTs;
  return null;
}

function parseFile(entryFile, maxDepth = Infinity) {
  const entryAbs = path.resolve(entryFile);
  const visited = new Set();

  const root = parseFileNode(entryAbs);
  if (!root) return null;
  visited.add(entryAbs);

  const queue = [{ node: root, depth: 0 }];

  while (queue.length > 0) {
    const { node, depth } = queue.shift();

    if (depth >= maxDepth) {
      delete node._rawImports;
      continue;
    }

    const fromDir = path.dirname(node.file);
    for (const imp of node._rawImports) {
      if (!imp.startsWith(".") && !imp.startsWith("/")) continue;
      if (imp.endsWith(".json")) continue;

      const resolved = resolveImportTarget(fromDir, imp);
      if (!resolved) continue;

      if (visited.has(resolved)) continue;
      visited.add(resolved);

      const childNode = parseFileNode(resolved);
      if (!childNode) continue;

      node.imports.push(childNode);
      queue.push({ node: childNode, depth: depth + 1 });
    }

    delete node._rawImports;
  }

  return root;
}

function walkAST(ast, callback) {
  if (Array.isArray(ast)) {
    ast.forEach((node) => walkAST(node, callback));
  } else if (ast && typeof ast.type === "string") {
    callback(ast);
    for (const key in ast) {
      if (ast[key] && typeof ast[key] === "object") {
        walkAST(ast[key], callback);
      }
    }
  }
}

module.exports = { parseFile };
