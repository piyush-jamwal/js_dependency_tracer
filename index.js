const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const babelParser = require("@babel/parser");

function parseToAst(code, filePath) {
  const fp = String(filePath || "");
  const isTS = fp.endsWith(".ts") || fp.endsWith(".tsx");
  const isFlow = !isTS && /^\s*\/\/\s*@flow/m.test(code);

  const plugins = [
    "jsx",
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
    if (![".js", ".jsx", ".ts", ".tsx"].includes(ext)) return null;
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    return null;
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

function parseFile(filePath, visited = new Set()) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) return null;

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) return null;

  if (visited.has(absolutePath)) return null;
  visited.add(absolutePath);

  const buf = fs.readFileSync(absolutePath);
  if (looksBinary(buf)) {
    return {
      file: absolutePath,
      content: null,
      imports: [],
      skipped: "binary",
    };
  }
  // Read the file content and parse it
  const code = buf.toString("utf8").replace(/^\uFEFF/, ""); // remove BOM if any
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
    };
  }

  const imports = [];
  walkAST(ast, (node) => {
    if (node.type === "ImportDeclaration") {
      imports.push(node.source.value);
    }
  });

  // Build the current node with file content included
  const node = {
    file: absolutePath,
    content: code, // Include the entire file content
    imports: [],
  };

  // Recursively parse each imported file
  for (const imp of imports) {
    // Only trace relative imports
    if (!imp.startsWith(".") && !imp.startsWith("/")) continue;
    if (imp.endsWith(".json")) continue;
    const resolved = resolveImportFile(path.dirname(absolutePath), imp);
    if (!resolved) continue;

    const childNode = parseFile(resolved, visited);
    if (childNode) node.imports.push(childNode);
  }

  return node;
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

const entryFile = process.argv[2];
if (!entryFile) {
  console.error("Please provide an entry file.");
  process.exit(1);
}

const dependencyTree = parseFile(entryFile);
console.log(JSON.stringify(dependencyTree, null, 2));
