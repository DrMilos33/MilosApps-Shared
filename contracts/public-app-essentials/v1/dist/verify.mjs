import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "public-app-essentials/v1";
const VERSION = "1.1.5";
const PLACE_SUGGESTION_CAPABILITIES = new Set(["consumer-autocomplete-proxy", "provider-autocomplete-direct"]);
const SHELL_ID = "public-app-shell/v2";
const SHELL_VERSION = "2.0.3";
const SHELL_SHARED_COMMIT = "ed898412306e22c6ae1b10ee8953df29f8acd627";
const SHELL_COMPONENT_SHA256 = "sha256:bff9c09ae64e453d186508a4372a1cacc17b4dcd30b770046c7f4efee53731b3";
const CONSUMERS = new Set([
  "portal",
  "noodle-calculator",
  "sky",
  "cloud-post",
  "somewhere-now",
  "gravity-loop",
  "waste-guide",
  "daylight"
]);
const ARTIFACTS = [
  "milos-app-essentials.css",
  "milos-app-essentials-theme.css",
  "milos-app-essentials.js",
  "bootstrap.js",
  "verify.mjs",
  "essentials-manifest.schema.json"
];
const SHELL_ARTIFACTS = [
  "milos-app-shell.js",
  "milos-app-shell.css",
  "bootstrap.js",
  "milos-app-shell-theme.css",
  "verify.mjs"
];

function fail(message) {
  throw new Error(`public-app-essentials/v1 verification failed: ${message}`);
}

function valueHasType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

export function schemaErrors(schema, value, location = "$", errors = []) {
  if (!schema || typeof schema !== "object") return errors;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => valueHasType(value, type))) {
    errors.push(`${location}: expected ${types.join(" or ")}`);
    return errors;
  }
  if (Object.hasOwn(schema, "const") && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${location}: value differs from const`);
  if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) errors.push(`${location}: value is not in enum`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location}: string is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${location}: string is too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${location}: pattern mismatch`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${location}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${location}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${location}: too many items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${location}: duplicate items`);
    if (schema.items) value.forEach((item, index) => schemaErrors(schema.items, item, `${location}[${index}]`, errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required || []) if (!Object.hasOwn(value, required)) errors.push(`${location}.${required}: required property missing`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) errors.push(`${location}.${key}: additional property`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, key)) schemaErrors(child, value[key], `${location}.${key}`, errors);
  }
  for (const child of schema.allOf || []) schemaErrors(child, value, location, errors);
  if (schema.if) {
    const conditionalErrors = [];
    schemaErrors(schema.if, value, location, conditionalErrors);
    if (conditionalErrors.length === 0 && schema.then) schemaErrors(schema.then, value, location, errors);
    if (conditionalErrors.length > 0 && schema.else) schemaErrors(schema.else, value, location, errors);
  }
  return errors;
}

const RAW_TEXT_ELEMENTS = new Set([
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp"
]);
const INERT_CONTAINER_ELEMENTS = new Set(["math", "svg"]);

function readHtmlTag(source, start) {
  let index = start + 1;
  let quote = null;
  while (index < source.length) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      const raw = source.slice(start, index + 1);
      let safe = raw[0];
      let attributeQuote = null;
      for (const value of raw.slice(1)) {
        if (attributeQuote) {
          if (value === attributeQuote) attributeQuote = null;
          safe += value === "<" || value === ">" ? " " : value;
        } else {
          if (value === '"' || value === "'") attributeQuote = value;
          safe += value === "<" ? " " : value;
        }
      }
      return { source: safe, index: index + 1 };
    }
    index += 1;
  }
  return null;
}

function earliestTerminator(source, start, terminators) {
  const matches = terminators
    .map((terminator) => ({ terminator, index: source.indexOf(terminator, start) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index);
  return matches[0] || null;
}

function skipInertContainer(source, start, containerName) {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const tagStart = source.indexOf("<", index);
    if (tagStart < 0) return source.length;
    if (source.startsWith("<!--", tagStart)) {
      const end = earliestTerminator(source, tagStart + 4, ["-->", "--!>"]);
      index = end ? end.index + end.terminator.length : source.length;
      continue;
    }
    if (source.startsWith("<![CDATA[", tagStart)) {
      const end = source.indexOf("]]>", tagStart + 9);
      index = end >= 0 ? end + 3 : source.length;
      continue;
    }
    const nameMatch = source.slice(tagStart + 1).match(/^\/?([A-Za-z][A-Za-z0-9:-]*)/);
    const tag = nameMatch ? readHtmlTag(source, tagStart) : null;
    if (!tag) {
      index = tagStart + 1;
      continue;
    }
    const nestedName = nameMatch[1].toLowerCase();
    const closing = source[tagStart + 1] === "/";
    if (!closing && nestedName === "template") fail("template elements inside foreign content are forbidden");
    if (!closing && RAW_TEXT_ELEMENTS.has(nestedName)) {
      const closingPattern = new RegExp(`</${nestedName}(?=[\\t\\n\\f\\r ]|>)`, "ig");
      closingPattern.lastIndex = tag.index;
      const closingMatch = closingPattern.exec(source);
      if (!closingMatch) return source.length;
      const rawBody = source.slice(tag.index, closingMatch.index);
      if ((nestedName === "script" || nestedName === "style") && rawBody.includes("<!--")) fail("escaped script/style data inside foreign content is forbidden");
      const closingTag = readHtmlTag(source, closingMatch.index);
      index = closingTag?.index ?? source.length;
      continue;
    }
    if (nestedName === containerName) {
      if (closing) depth -= 1;
      else if (!/\/[\t\n\f\r ]*>$/.test(tag.source)) depth += 1;
    }
    index = tag.index;
  }
  return index;
}

function containsEscapedScriptData(value) {
  const source = String(value);
  const pattern = /<script(?=[\t\n\f\r ]|>)/ig;
  for (const match of source.matchAll(pattern)) {
    const tag = readHtmlTag(source, match.index);
    if (!tag) return true;
    const closingPattern = /<\/script(?=[\t\n\f\r ]|>)/ig;
    closingPattern.lastIndex = tag.index;
    const closing = closingPattern.exec(source);
    if (!closing) return true;
    if (source.slice(tag.index, closing.index).includes("<!--")) return true;
  }
  return false;
}

function extractHtmlMarkup(value) {
  const source = String(value);
  const tags = [];
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("<", index);
    if (start < 0) break;
    if (source.startsWith("<!--", start)) {
      const end = earliestTerminator(source, start + 4, ["-->", "--!>"]);
      index = end ? end.index + end.terminator.length : source.length;
      continue;
    }
    if (source.startsWith("<![CDATA[", start)) {
      const end = source.indexOf("]]>", start + 9);
      index = end >= 0 ? end + 3 : source.length;
      continue;
    }
    if (source.startsWith("<?", start)) {
      const end = earliestTerminator(source, start + 2, ["?>", ">"]);
      index = end ? end.index + end.terminator.length : source.length;
      continue;
    }
    if (source.startsWith("<!", start)) {
      const end = source.indexOf(">", start + 2);
      index = end >= 0 ? end + 1 : source.length;
      continue;
    }
    if (source.startsWith("</", start) && !/[A-Za-z]/.test(source[start + 2] || "")) {
      const end = source.indexOf(">", start + 2);
      index = end >= 0 ? end + 1 : source.length;
      continue;
    }
    const nameMatch = source.slice(start + 1).match(/^\/?([A-Za-z][A-Za-z0-9:-]*)/);
    if (!nameMatch) {
      index = start + 1;
      continue;
    }
    const tag = readHtmlTag(source, start);
    if (!tag) break;
    const closing = source[start + 1] === "/";
    const name = nameMatch[1].toLowerCase();
    if (!closing) tags.push(tag.source);
    index = tag.index;
    if (!closing && INERT_CONTAINER_ELEMENTS.has(name)) {
      index = skipInertContainer(source, index, name);
    } else if (!closing && RAW_TEXT_ELEMENTS.has(name)) {
      if (name === "plaintext") break;
      const closingPattern = new RegExp(`</${name}(?=[\\t\\n\\f\\r ]|>)`, "ig");
      closingPattern.lastIndex = index;
      const closingMatch = closingPattern.exec(source);
      if (!closingMatch) break;
      const closingTag = readHtmlTag(source, closingMatch.index);
      index = closingTag?.index ?? source.length;
    }
  }
  return tags.join("\n");
}

function skipQuotedLiteral(source, start, quote) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") index += 2;
    else if (source[index++] === quote) break;
  }
  return index;
}

function skipLineComment(source, start) {
  let index = start + 2;
  while (index < source.length && source[index] !== "\n") index += 1;
  return index;
}

function skipBlockComment(source, start) {
  let index = start + 2;
  while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
  return Math.min(source.length, index + 2);
}

function skipRegexLiteral(source, start) {
  let index = start + 1;
  let characterClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") index += 2;
    else if (character === "[" && !characterClass) { characterClass = true; index += 1; }
    else if (character === "]" && characterClass) { characterClass = false; index += 1; }
    else if (character === "/" && !characterClass) { index += 1; break; }
    else if (character === "\n" || character === "\r") break;
    else index += 1;
  }
  while (/[a-z]/i.test(source[index] || "")) index += 1;
  return index;
}

const PROTECTED_REGEX_EVIDENCE = /(?:<milos-(?:app-shell|share-button|date-picker|place-search)\b|data-milos-privacy-info|globalThis\s*\.\s*milosAppEssentials\s*\.\s*ready\s*\(|\.\s*set(?:Payload|Search|Suggestions)Provider\s*\()/i;

function maskProtectedSlashSpans(value, allowJsx = false) {
  const source = String(value);
  const output = [...source];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedLiteral(source, index, source[index]) - 1;
      continue;
    }
    if (source[index] === "`") {
      index = skipTemplateLiteral(source, index) - 1;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "/") {
      index = skipLineComment(source, index) - 1;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "*") {
      index = skipBlockComment(source, index) - 1;
      continue;
    }
    if (allowJsx && source[index] === "<" && /^\/?[A-Za-z]/.test(source.slice(index + 1, index + 3))) {
      index = readMarkupTag(source, index).index - 1;
      continue;
    }
    if (source[index] !== "/" || source[index - 1] === "<" || source[index + 1] === "/" || source[index + 1] === "*" || source[index + 1] === ">") continue;
    const end = skipRegexLiteral(source, index);
    if (end <= index + 1 || !PROTECTED_REGEX_EVIDENCE.test(source.slice(index, end))) continue;
    for (let cursor = index; cursor < end; cursor += 1) {
      if (output[cursor] !== "\n" && output[cursor] !== "\r") output[cursor] = " ";
    }
    index = end - 1;
  }
  return output.join("");
}

function skipTemplateLiteral(source, start) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") index += 2;
    else if (source[index] === "`") return index + 1;
    else if (source[index] === "$" && source[index + 1] === "{") index = skipJavaScriptExpression(source, index + 2);
    else index += 1;
  }
  return index;
}

function skipJavaScriptExpression(source, start) {
  const expressionKeywords = new Set(["await", "break", "case", "continue", "debugger", "default", "delete", "do", "else", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"]);
  const controlHeaderKeywords = new Set(["catch", "for", "if", "switch", "while", "with"]);
  const parenthesisKinds = [];
  let index = start;
  let depth = 1;
  let canStartExpression = true;
  let pendingControlHeader = false;
  while (index < source.length && depth > 0) {
    const current = source[index];
    const next = source[index + 1];
    if (/\s/.test(current)) { index += 1; continue; }
    if (current === "/" && next === "/") { index = skipLineComment(source, index); continue; }
    if (current === "/" && next === "*") { index = skipBlockComment(source, index); continue; }
    if (current === '"' || current === "'") { index = skipQuotedLiteral(source, index, current); canStartExpression = false; pendingControlHeader = false; continue; }
    if (current === "`") { index = skipTemplateLiteral(source, index); canStartExpression = false; pendingControlHeader = false; continue; }
    if (current === "/" && canStartExpression) { index = skipRegexLiteral(source, index); canStartExpression = false; continue; }
    if (current === "{") { depth += 1; canStartExpression = true; index += 1; continue; }
    if (current === "}") { depth -= 1; canStartExpression = true; pendingControlHeader = false; index += 1; continue; }
    if (/[A-Za-z_$]/.test(current)) {
      let end = index + 1;
      while (/[A-Za-z0-9_$]/.test(source[end] || "")) end += 1;
      const token = source.slice(index, end);
      pendingControlHeader = controlHeaderKeywords.has(token) || (pendingControlHeader && token === "await");
      canStartExpression = expressionKeywords.has(token);
      index = end;
      continue;
    }
    if (/\d/.test(current)) {
      index += 1;
      while (/[A-Za-z0-9_.]/.test(source[index] || "")) index += 1;
      canStartExpression = false;
      pendingControlHeader = false;
      continue;
    }
    if (current === "(") { parenthesisKinds.push(pendingControlHeader ? "control" : "normal"); pendingControlHeader = false; canStartExpression = true; index += 1; continue; }
    if (current === ")") { canStartExpression = parenthesisKinds.pop() === "control"; pendingControlHeader = false; index += 1; continue; }
    if (current === "}") { canStartExpression = true; pendingControlHeader = false; index += 1; continue; }
    if (current === "=" && next === ">") { canStartExpression = true; index += 2; continue; }
    pendingControlHeader = false;
    canStartExpression = ![".", ")", "]", "}"].includes(current);
    index += 1;
  }
  return index;
}

function readMarkupTag(source, start) {
  let index = start;
  let output = "";
  while (index < source.length) {
    const current = source[index];
    if (current === '"' || current === "'") {
      const end = skipQuotedLiteral(source, index, current);
      output += source.slice(index, end);
      index = end;
      continue;
    }
    if (current === "{") {
      index = skipJavaScriptExpression(source, index + 1);
      output += /=\s*$/.test(output) ? '""' : " ";
      continue;
    }
    output += current;
    index += 1;
    if (current === ">") break;
  }
  return { output, index };
}

function extractJavaScriptMarkup(value, allowJsx = false) {
  const source = maskProtectedSlashSpans(value, allowJsx);
  const output = [];
  const expressionKeywords = new Set(["await", "break", "case", "continue", "debugger", "default", "delete", "do", "else", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"]);
  const controlHeaderKeywords = new Set(["catch", "for", "if", "switch", "while", "with"]);
  const parenthesisKinds = [];
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (source.startsWith("#!", index)) index = skipLineComment(source, index);
  let canStartExpression = true;
  let pendingControlHeader = false;
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    if (/\s/.test(current)) { index += 1; continue; }
    if (current === "/" && next === "/") { index = skipLineComment(source, index); continue; }
    if (current === "/" && next === "*") { index = skipBlockComment(source, index); continue; }
    if (current === '"' || current === "'") { index = skipQuotedLiteral(source, index, current); canStartExpression = false; pendingControlHeader = false; continue; }
    if (current === "`") {
      index += 1;
      let raw = "";
      while (index < source.length) {
        if (source[index] === "\\") { raw += source.slice(index, index + 2); index += 2; }
        else if (source[index] === "`") { index += 1; break; }
        else if (source[index] === "$" && source[index + 1] === "{") { raw += " "; index = skipJavaScriptExpression(source, index + 2); }
        else raw += source[index++];
      }
      output.push(raw);
      canStartExpression = false;
      pendingControlHeader = false;
      continue;
    }
    if (current === "/" && canStartExpression) { index = skipRegexLiteral(source, index); canStartExpression = false; continue; }
    if (allowJsx && current === "<" && /^\/?[A-Za-z]/.test(source.slice(index + 1, index + 3))) {
      const tag = readMarkupTag(source, index);
      output.push(tag.output);
      index = tag.index;
      canStartExpression = false;
      continue;
    }
    if (/[A-Za-z_$]/.test(current)) {
      let end = index + 1;
      while (/[A-Za-z0-9_$]/.test(source[end] || "")) end += 1;
      const token = source.slice(index, end);
      pendingControlHeader = controlHeaderKeywords.has(token) || (pendingControlHeader && token === "await");
      canStartExpression = expressionKeywords.has(token);
      index = end;
      continue;
    }
    if (/\d/.test(current)) {
      index += 1;
      while (/[A-Za-z0-9_.]/.test(source[index] || "")) index += 1;
      canStartExpression = false;
      pendingControlHeader = false;
      continue;
    }
    if (current === "(") { parenthesisKinds.push(pendingControlHeader ? "control" : "normal"); pendingControlHeader = false; canStartExpression = true; index += 1; continue; }
    if (current === ")") { canStartExpression = parenthesisKinds.pop() === "control"; pendingControlHeader = false; index += 1; continue; }
    if (current === "=" && next === ">") { canStartExpression = true; index += 2; continue; }
    pendingControlHeader = false;
    canStartExpression = ![".", ")", "]", "}"].includes(current);
    index += 1;
  }
  return output.join("\n");
}

function javascriptCodeTokens(value, allowJsx = false) {
  const source = maskProtectedSlashSpans(value, allowJsx);
  const tokens = [];
  const expressionKeywords = new Set(["await", "break", "case", "continue", "debugger", "default", "delete", "do", "else", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"]);
  const controlHeaderKeywords = new Set(["catch", "for", "if", "switch", "while", "with"]);
  const parenthesisKinds = [];
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (source.startsWith("#!", index)) index = skipLineComment(source, index);
  let canStartExpression = true;
  let pendingControlHeader = false;
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    if (/\s/.test(current)) {
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 2;
      continue;
    }
    if (current === '"' || current === "'") {
      const quote = current;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") index += 2;
        else if (source[index++] === quote) break;
      }
      tokens.push("<literal>");
      canStartExpression = false;
      pendingControlHeader = false;
      continue;
    }
    if (current === "`") {
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") index += 2;
        else if (source[index++] === "`") break;
      }
      tokens.push("<literal>");
      canStartExpression = false;
      pendingControlHeader = false;
      continue;
    }
    if (current === "/" && canStartExpression) {
      index += 1;
      let characterClass = false;
      while (index < source.length) {
        const character = source[index];
        if (character === "\\") index += 2;
        else if (character === "[" && !characterClass) { characterClass = true; index += 1; }
        else if (character === "]" && characterClass) { characterClass = false; index += 1; }
        else if (character === "/" && !characterClass) { index += 1; break; }
        else if (character === "\n" || character === "\r") break;
        else index += 1;
      }
      while (/[a-z]/i.test(source[index] || "")) index += 1;
      tokens.push("<literal>");
      canStartExpression = false;
      continue;
    }
    if (/[A-Za-z_$]/.test(current)) {
      let end = index + 1;
      while (/[A-Za-z0-9_$]/.test(source[end] || "")) end += 1;
      const token = source.slice(index, end);
      tokens.push(token);
      pendingControlHeader = controlHeaderKeywords.has(token) || (pendingControlHeader && token === "await");
      canStartExpression = expressionKeywords.has(token);
      index = end;
      continue;
    }
    if (/\d/.test(current)) {
      let end = index + 1;
      while (/[A-Za-z0-9_.]/.test(source[end] || "")) end += 1;
      tokens.push(source.slice(index, end));
      canStartExpression = false;
      pendingControlHeader = false;
      index = end;
      continue;
    }
    if (current === "(") {
      tokens.push(current);
      parenthesisKinds.push(pendingControlHeader ? "control" : "normal");
      pendingControlHeader = false;
      canStartExpression = true;
      index += 1;
      continue;
    }
    if (current === ")") {
      tokens.push(current);
      canStartExpression = parenthesisKinds.pop() === "control";
      pendingControlHeader = false;
      index += 1;
      continue;
    }
    if (current === "}") {
      tokens.push(current);
      canStartExpression = true;
      pendingControlHeader = false;
      index += 1;
      continue;
    }
    if (current === "=" && next === ">") {
      tokens.push("=>");
      canStartExpression = true;
      index += 2;
      continue;
    }
    tokens.push(current);
    pendingControlHeader = false;
    canStartExpression = ![".", ")", "]", "}"].includes(current);
    index += 1;
  }
  return tokens;
}

function maskJsxText(value) {
  return String(value).replace(/>([^<{]*)</g, (match, text) => `>${text.replace(/[^\r\n]/g, " ")}<`);
}

function hasCallPath(tokens, names) {
  return tokens.some((token, index) => {
    if (token !== names[0]) return false;
    let cursor = index + 1;
    for (const name of names.slice(1)) {
      if (tokens[cursor] !== "." || tokens[cursor + 1] !== name) return false;
      cursor += 2;
    }
    return tokens[cursor] === "(";
  });
}

function hasMethodCall(tokens, methodName) {
  return tokens.some((token, index) => token === "." && tokens[index + 1] === methodName && tokens[index + 2] === "(");
}

function htmlTags(source, tagName) {
  return [...source.matchAll(new RegExp(`<${tagName}(?=[\\t\\n\\f\\r ]|/?>)[^>]*>`, "gi"))].map((match) => ({ source: match[0], index: match.index }));
}

function htmlStartTags(source) {
  return [...source.matchAll(/<[A-Za-z][A-Za-z0-9:-]*(?=[\t\n\f\r ]|\/?>)[^>]*>/g)].map((match) => ({ source: match[0], index: match.index }));
}

function tagAttributes(tag) {
  const attributes = new Map();
  let index = 1;
  while (/[A-Za-z0-9:-]/.test(tag[index] || "")) index += 1;
  while (index < tag.length) {
    while (/[\t\n\f\r ]/.test(tag[index] || "")) index += 1;
    if (!tag[index] || tag[index] === ">" || (tag[index] === "/" && tag[index + 1] === ">")) break;
    const nameStart = index;
    while (tag[index] && !/[\t\n\f\r =/>]/.test(tag[index])) index += 1;
    const name = tag.slice(nameStart, index).toLowerCase();
    if (!name) { index += 1; continue; }
    while (/[\t\n\f\r ]/.test(tag[index] || "")) index += 1;
    let value = "";
    if (tag[index] === "=") {
      index += 1;
      while (/[\t\n\f\r ]/.test(tag[index] || "")) index += 1;
      if (tag[index] === '"' || tag[index] === "'") {
        const quote = tag[index++];
        const valueStart = index;
        while (tag[index] && tag[index] !== quote) index += 1;
        value = tag.slice(valueStart, index);
        if (tag[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (tag[index] && !/[\t\n\f\r >]/.test(tag[index])) index += 1;
        value = tag.slice(valueStart, index);
      }
    }
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

function attributeValue(tag, attribute) {
  return tagAttributes(tag).get(attribute.toLowerCase()) ?? null;
}

function hasAttribute(tag, attribute) {
  return tagAttributes(tag).has(attribute.toLowerCase());
}

function verifyShellSlotIcon(entry) {
  const shells = htmlTags(entry, "milos-app-shell");
  const slotIcons = htmlTags(entry, "svg")
    .map(({ source }) => source)
    .filter((source) => attributeValue(source, "slot") === "app-icon");
  if (shells.length === 0 && slotIcons.length === 0) return;
  if (shells.length !== 1) fail("Shell integration requires exactly one milos-app-shell in entry HTML");
  if (slotIcons.length !== 1) fail("Shell integration requires exactly one app-owned SVG with slot=app-icon in entry HTML");
  if (attributeValue(slotIcons[0], "width") !== "38" || attributeValue(slotIcons[0], "height") !== "38") {
    fail("Shell app icon needs explicit width/height of exactly 38");
  }
}

function isActiveCriticalStylesheet(tag) {
  const rel = (attributeValue(tag, "rel") || "").toLowerCase().split(/[\t\n\f\r ]+/).filter(Boolean);
  if (!rel.includes("stylesheet") || rel.includes("alternate") || hasAttribute(tag, "disabled") || hasAttribute(tag, "integrity")) return false;
  if (hasAttribute(tag, "type") && (attributeValue(tag, "type") || "").toLowerCase() !== "text/css") return false;
  if (hasAttribute(tag, "media") && !["", "all"].includes((attributeValue(tag, "media") || "").trim().toLowerCase())) return false;
  return true;
}

function normalizedLocalUrl(value) {
  const raw = String(value || "");
  if (!raw || raw.includes("\\") || /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(raw)) return null;
  const withoutSuffix = raw.split(/[?#]/, 1)[0];
  const normalized = withoutSuffix.startsWith("./") ? withoutSuffix.slice(2) : withoutSuffix;
  const rooted = normalized.startsWith("/");
  const pathname = rooted ? normalized.slice(1) : normalized;
  const segments = pathname.split("/");
  if (!pathname || segments.some((segment) => !/^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/.test(segment))) return null;
  return `${rooted ? "/" : ""}${pathname}`;
}

function localUrlEquals(value, expected) {
  const normalizedValue = normalizedLocalUrl(value);
  const normalizedExpected = normalizedLocalUrl(expected);
  return normalizedValue !== null && normalizedExpected !== null && normalizedValue === normalizedExpected;
}

function exactLocalUrlEquals(value, expected) {
  if (/[?#]/.test(String(value || "")) || /[?#]/.test(String(expected || ""))) return false;
  return localUrlEquals(value, expected);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token?.startsWith("--") || !value) fail("expected --app-root and --manifest");
    result[token.slice(2)] = value;
  }
  if (!result["app-root"] || !result.manifest) fail("--app-root and --manifest are required");
  return result;
}

function inside(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} escapes app root`);
  return candidate;
}

async function confinedPath(root, candidate, label, allowMissing = false) {
  const lexical = inside(root, candidate, label);
  const relative = path.relative(root, lexical);
  let cursor = root;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) fail(`${label} must not traverse symbolic links or junctions`);
      if (info.isFile() && info.nlink > 1) fail(`${label} must not use hard-linked files`);
      const resolved = await realpath(cursor);
      const resolvedRelative = path.relative(root, resolved);
      if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) fail(`${label} resolves outside app root`);
    } catch (error) {
      if (error?.code === "ENOENT" && allowMissing) break;
      if (error?.code === "ENOENT") return lexical;
      throw error;
    }
  }
  return lexical;
}

async function requiredFile(file, label) {
  try {
    return await readFile(file);
  } catch {
    fail(`${label} is missing: ${file}`);
  }
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function manifestSha256(manifest) {
  return sha256(Buffer.from(canonicalJson(manifest), "utf8"));
}

function validHttpsUrl(value) {
  if (typeof value !== "string" || /\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.replace(/\.$/, "");
    const labels = hostname.split(".");
    return parsed.protocol === "https:"
      && labels.length >= 2
      && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function validateStoragePurposes(manifest) {
  const purposes = manifest.privacy?.storagePurposes;
  if (!Array.isArray(purposes)) fail("privacy.storagePurposes is required");
  if (manifest.privacy?.usesLocalStorage === true && purposes.length === 0) fail("usesLocalStorage=true requires at least one storage purpose");
  if (manifest.privacy?.usesLocalStorage !== true && purposes.length > 0) fail("storage purposes require usesLocalStorage=true");
  const keys = new Set();
  for (const purpose of purposes) {
    if (typeof purpose?.key !== "string" || !purpose.key.startsWith(`milosapps.${manifest.appKey}.`)) fail("storage purpose key must use the app namespace");
    if (keys.has(purpose.key)) fail("storage purpose keys must be unique");
    keys.add(purpose.key);
    if (typeof purpose.purpose !== "string" || !purpose.purpose.trim()) fail("storage purpose requires a non-empty purpose");
    if (!["session", "bounded", "until-user-clears"].includes(purpose.lifetime)) fail("storage purpose requires a supported lifetime");
    if (purpose.strictlyNecessary !== true) fail("optional device storage is forbidden without a separate consent contract");
  }
}

function canonicalShellPrivacyUrl(environment) {
  return environment === "production"
    ? "https://milos-apps.de/datenschutz"
    : "https://dev.milos-apps.de/datenschutz";
}

async function verifyShellPermanentLink(appRoot, manifest, entryPath) {
  const reference = manifest.privacy?.permanentLink;
  if (!reference) return false;
  if (manifest.privacy.mode !== "no-cookies") fail("privacy.permanentLink is only supported for no-cookies");
  if (reference.provider !== SHELL_ID) fail("privacy.permanentLink requires public-app-shell/v2");
  const shellManifestPath = await confinedPath(appRoot, path.resolve(appRoot, reference.manifest), "shell manifest");
  const shellManifest = JSON.parse((await requiredFile(shellManifestPath, "shell manifest")).toString("utf8"));
  if (shellManifest.appKey !== manifest.appKey) fail("shell manifest appKey must match the essentials manifest");
  if (shellManifest.environment !== manifest.environment || shellManifest.productionApproved !== manifest.productionApproved) fail("shell manifest environment and production boundary must match the essentials manifest");
  if (shellManifest.public !== true || shellManifest.loginRequired !== false) fail("shell manifest must describe the same public no-login surface");
  if (shellManifest.shellContract?.id !== SHELL_ID || shellManifest.shellContract?.version !== SHELL_VERSION) fail("shell manifest must pin public-app-shell/v2.0.3");
  const shellFixture = shellManifest.appKey === "reference-app" && /^0+$/.test(shellManifest.shellContract?.sharedCommit || "");
  if (!shellFixture && shellManifest.shellContract?.sharedCommit !== SHELL_SHARED_COMMIT) fail("shell manifest must pin the immutable public-app-shell/v2.0.3 sharedCommit");
  if (typeof shellManifest.shellContract?.vendorDirectory !== "string" || !shellManifest.shellContract.vendorDirectory.trim()) fail("shell manifest requires a vendorDirectory");
  if (typeof shellManifest.shellContract?.localeModule !== "string" || !shellManifest.shellContract.localeModule.trim()) fail("shell manifest requires a localeModule");
  const shellEntryPath = await confinedPath(appRoot, path.resolve(appRoot, shellManifest.shellContract.entryHtml), "shell entry HTML");
  if (path.normalize(shellEntryPath) !== path.normalize(entryPath)) fail("shell and essentials manifests must name the same entry HTML");
  if (manifest.privacy.privacyUrl !== canonicalShellPrivacyUrl(manifest.environment)) fail("shell-provided privacy link requires the canonical environment privacyUrl");

  const shellVendorRoot = await confinedPath(appRoot, path.resolve(appRoot, shellManifest.shellContract.vendorDirectory), "shell vendor directory");
  const shellLockPath = await confinedPath(appRoot, path.join(shellVendorRoot, "shell-lock.json"), "shell lock");
  const shellLock = JSON.parse((await requiredFile(shellLockPath, "shell lock")).toString("utf8"));
  if (shellLock.contract !== SHELL_ID || shellLock.version !== SHELL_VERSION) fail("shell lock contract/version mismatch");
  if (shellLock.sharedCommit !== shellManifest.shellContract.sharedCommit) fail("shell lock/shared commit mismatch");
  if (shellLock.appKey !== manifest.appKey) fail("shell lock/app key mismatch");
  const relativeShellManifest = path.relative(appRoot, shellManifestPath).replaceAll(path.sep, "/");
  if (shellLock.manifest !== relativeShellManifest) fail("shell lock/manifest path mismatch");
  const shellVendorDirectory = shellManifest.shellContract.vendorDirectory.replaceAll("\\", "/").replace(/^\.\//, "");
  if (shellLock.vendorDirectory !== shellVendorDirectory) fail("shell lock/vendor directory mismatch");
  if (JSON.stringify(Object.keys(shellLock.artifacts || {}).sort()) !== JSON.stringify([...SHELL_ARTIFACTS].sort())) fail("shell lock artifact set mismatch");
  const shellContents = new Map();
  for (const artifact of SHELL_ARTIFACTS) {
    const artifactPath = await confinedPath(appRoot, path.join(shellVendorRoot, artifact), `shell ${artifact}`);
    const content = await requiredFile(artifactPath, `shell ${artifact}`);
    if (sha256(content) !== shellLock.artifacts?.[artifact]) fail(`shell ${artifact} checksum mismatch`);
    shellContents.set(artifact, content);
  }
  const shellComponent = shellContents.get("milos-app-shell.js").toString("utf8");
  if (sha256(shellContents.get("milos-app-shell.js")) !== SHELL_COMPONENT_SHA256
    || !shellComponent.includes('<a href="${links.privacy}" data-text="privacy">')
    || !shellComponent.includes("https://dev.milos-apps.de/datenschutz")
    || !shellComponent.includes("https://milos-apps.de/datenschutz")) {
    fail("verified shell component must be the immutable v2.0.3 artifact with its canonical permanent privacy footer link");
  }
  const shellEntry = extractHtmlMarkup((await requiredFile(shellEntryPath, "shell entry HTML")).toString("utf8"));
  if (htmlTags(shellEntry, "milos-app-shell").length !== 1) fail("shell-provided privacy information requires exactly one milos-app-shell in entry HTML");
  const shellBootstrap = htmlTags(shellEntry, "script")
    .map(({ source }) => source)
    .find((source) => {
      if ((attributeValue(source, "type") || "").toLowerCase() !== "module") return false;
      const runtimePath = normalizedLocalUrl(attributeValue(source, "src"));
      return runtimePath !== null && runtimePath.replace(/^\//, "").endsWith("milosapps-shell/v2/bootstrap.js");
    });
  if (!shellBootstrap) fail("shell-provided privacy information requires the locked local Shell bootstrap");
  const shellLocalePath = await confinedPath(appRoot, path.resolve(appRoot, shellManifest.shellContract.localeModule), "shell locale module");
  await requiredFile(shellLocalePath, "shell locale module");
  return true;
}

export async function verifyEssentials(appRootInput, manifestInput) {
  const appRoot = await realpath(path.resolve(appRootInput));
  const manifestPath = await confinedPath(appRoot, path.resolve(appRoot, manifestInput), "manifest");
  const manifestContent = await requiredFile(manifestPath, "manifest");
  const manifest = JSON.parse(manifestContent.toString("utf8"));
  if (typeof manifest.essentialsContract?.vendorDirectory !== "string") fail("vendor directory is required");
  const vendorRoot = await confinedPath(appRoot, path.resolve(appRoot, manifest.essentialsContract.vendorDirectory), "vendor directory");
  const lockPath = await confinedPath(appRoot, path.join(vendorRoot, "essentials-lock.json"), "essentials lock");
  const lock = JSON.parse((await requiredFile(lockPath, "essentials lock")).toString("utf8"));
  if (lock.contract !== ID || lock.version !== VERSION) fail("lock contract/version mismatch");
  if (lock.sharedCommit !== manifest.essentialsContract.sharedCommit) fail("lock/shared commit mismatch");
  if (lock.appKey !== manifest.appKey) fail("lock/app key mismatch");
  const relativeManifest = path.relative(appRoot, manifestPath).replaceAll(path.sep, "/");
  if (lock.manifest !== relativeManifest) fail("lock/manifest path mismatch");
  for (const artifact of ARTIFACTS) {
    const artifactPath = await confinedPath(appRoot, path.join(vendorRoot, artifact), artifact);
    const content = await requiredFile(artifactPath, artifact);
    if (sha256(content) !== lock.artifacts?.[artifact]) fail(`${artifact} checksum mismatch`);
  }
  const manifestSchemaPath = await confinedPath(appRoot, path.join(vendorRoot, "essentials-manifest.schema.json"), "manifest schema");
  const manifestSchema = JSON.parse((await requiredFile(manifestSchemaPath, "manifest schema")).toString("utf8"));
  const manifestErrors = schemaErrors(manifestSchema, manifest);
  if (manifestErrors.length) fail(`manifest schema: ${manifestErrors.join("; ")}`);
  const relativeSchema = path.relative(path.dirname(manifestPath), manifestSchemaPath).replaceAll(path.sep, "/");
  const expectedSchema = relativeSchema.startsWith(".") ? relativeSchema : `./${relativeSchema}`;
  if (manifest.$schema !== expectedSchema) fail("manifest $schema must resolve to the locked vendored schema");
  if (lock.manifestSha256 !== manifestSha256(manifest)) fail("lock/manifest configuration mismatch");
  if (lock.runtimeBasePath !== manifest.essentialsContract.runtimeBasePath) fail("lock/runtime base path mismatch");
  const loadingIconRuntimePath = manifest.loading?.iconRuntimePath || manifest.loading?.iconPath;
  if (lock.loadingIconRuntimePath !== loadingIconRuntimePath) fail("lock/loading icon runtime path mismatch");
  if (JSON.stringify(Object.keys(lock.artifacts || {}).sort()) !== JSON.stringify([...ARTIFACTS].sort())) fail("lock artifact set mismatch");
  if (manifest.public !== true || manifest.loginRequired !== false) fail("consumer must be a public no-login surface");
  const fixture = manifest.appKey === "reference-app" && /^0+$/.test(manifest.essentialsContract?.sharedCommit || "");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an eligible consumer");
  if (manifest.essentialsContract?.id !== ID || manifest.essentialsContract?.version !== VERSION) fail("contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(manifest.essentialsContract.sharedCommit || "")) fail("full sharedCommit is required");
  if (manifest.environment === "dev" && manifest.productionApproved !== false) fail("DEV requires productionApproved=false");
  if (manifest.environment === "production" && manifest.productionApproved !== true) fail("Production requires explicit approval");
  if (manifest.privacy?.mode !== "no-cookies" && manifest.privacy?.mode !== "essential-only") fail("unsupported privacy mode");
  if (manifest.privacy?.optionalTracking !== false) fail("optional tracking is forbidden");
  validateStoragePurposes(manifest);
  if (!validHttpsUrl(manifest.privacy?.privacyUrl)) fail("privacy URL must be an absolute HTTPS URL with a valid host and no credentials");
  if (manifest.features?.startup !== true) fail("startup is required for public apps");
  if (manifest.features?.share !== true) fail("share is required");
  if (manifest.privacy?.mode === "no-cookies" && manifest.features?.privacyNotice !== false) fail("no-cookies requires privacyNotice=false");
  if (manifest.privacy?.mode === "essential-only" && manifest.features?.privacyNotice !== true) fail("essential-only requires privacyNotice=true");
  const suggestions = manifest.features?.placeSuggestions;
  if (!suggestions || !Number.isInteger(suggestions.minChars) || suggestions.minChars < 2 || suggestions.minChars > 6) fail("place suggestions require minChars between 2 and 6");
  if (!Number.isInteger(suggestions.debounceMs) || suggestions.debounceMs < 200 || suggestions.debounceMs > 1000) fail("place suggestions require debounceMs between 200 and 1000");
  if (suggestions.enabled === true) {
    if (manifest.features?.placeSearch !== true) fail("place suggestions require placeSearch=true");
    if (!PLACE_SUGGESTION_CAPABILITIES.has(suggestions.providerCapability)) fail("place suggestions require an evidenced autocomplete capability");
    if (typeof suggestions.evidenceFile !== "string" || !suggestions.evidenceFile.trim()) fail("place suggestions require provider evidence");
    const evidencePath = await confinedPath(appRoot, path.resolve(appRoot, suggestions.evidenceFile), "suggestions evidence");
    await requiredFile(evidencePath, "suggestions evidence");
  } else if (suggestions.enabled !== false || suggestions.providerCapability !== "submit-only" || suggestions.evidenceFile !== null) {
    fail("disabled place suggestions must remain submit-only without provider evidence");
  }
  const consumerEntry = manifest.consumerEntryModule;
  if (!consumerEntry || !manifest.integrationFiles.includes(consumerEntry.sourceFile)) fail("consumer entry sourceFile must be a declared integration file");
  if (/\.html?$/i.test(consumerEntry.sourceFile)) fail("consumer entry sourceFile must be a JavaScript or TypeScript module");

  const entryPath = await confinedPath(appRoot, path.resolve(appRoot, manifest.entryHtml), "entry HTML");
  const entryRaw = (await requiredFile(entryPath, "entry HTML")).toString("utf8");
  if (containsEscapedScriptData(entryRaw)) fail("escaped or unterminated inline script data is forbidden");
  const entry = extractHtmlMarkup(entryRaw);
  if (htmlTags(entry, "base").length) fail("base elements are forbidden because runtime URLs must retain manifest semantics");
  if (htmlTags(entry, "template").length) fail("inert template elements cannot provide essentials integration evidence");
  verifyShellSlotIcon(entry);
  const vendorWeb = manifest.essentialsContract.runtimeBasePath;
  const baseCss = `${vendorWeb}/milos-app-essentials.css`;
  const themeCss = `${vendorWeb}/milos-app-essentials-theme.css`;
  const bootstrap = `${vendorWeb}/bootstrap.js`;
  const stylesheetLinks = htmlTags(entry, "link").filter(({ source }) => isActiveCriticalStylesheet(source));
  const baseLink = stylesheetLinks.find(({ source }) => localUrlEquals(attributeValue(source, "href"), baseCss));
  const themeLink = stylesheetLinks.find(({ source }) => localUrlEquals(attributeValue(source, "href"), themeCss));
  if (!baseLink || !themeLink) fail("entry HTML must load both local essentials stylesheets as link elements");
  const moduleScripts = htmlTags(entry, "script").filter(({ source }) => (attributeValue(source, "type") || "").toLowerCase() === "module");
  if (moduleScripts.some(({ source }) => /\/[\t\n\f\r ]*>$/.test(source))) fail("module scripts must use explicit closing tags");
  if (moduleScripts.some(({ source }) => hasAttribute(source, "integrity"))) fail("local module scripts must not use unverifiable integrity metadata");
  const bootstrapScript = moduleScripts.find(({ source }) => localUrlEquals(attributeValue(source, "src"), bootstrap));
  if (!bootstrapScript) fail("entry HTML must load the local generated bootstrap as a module script");
  const consumerScript = moduleScripts.find(({ source }) => localUrlEquals(attributeValue(source, "src"), consumerEntry.runtimePath));
  if (!consumerScript) fail("entry HTML must load the declared consumer entry module");
  const firstModule = moduleScripts[0]?.index ?? -1;
  if (bootstrapScript.index !== firstModule) fail("essentials bootstrap must be the first module script");
  if (consumerScript.index <= bootstrapScript.index) fail("consumer entry module must load after essentials bootstrap");
  if (moduleScripts.some(({ source }) => hasAttribute(source, "async"))) fail("async module scripts are forbidden because bootstrap order must be deterministic");
  if (firstModule >= 0 && (baseLink.index > firstModule || themeLink.index > firstModule)) fail("critical stylesheets must load before module scripts");
  if (/https?:[^"']+milos-app-essentials/i.test(entry)) fail("remote essentials runtime is forbidden");
  if (/data:text\/(?:css|javascript)/i.test(entry)) fail("inlined data runtime is forbidden");

  const integrationMarkupSources = [];
  const javascriptIntegrationSources = [];
  for (const relative of manifest.integrationFiles || []) {
    const file = await confinedPath(appRoot, path.resolve(appRoot, relative), "integration file");
    const raw = (await requiredFile(file, "integration file")).toString("utf8");
    const htmlFile = /\.html?$/i.test(relative);
    const jsxFile = /\.[jt]sx$/i.test(relative);
    if (!htmlFile) javascriptIntegrationSources.push({ raw, jsxFile });
    integrationMarkupSources.push(extractHtmlMarkup(htmlFile ? raw : extractJavaScriptMarkup(raw, jsxFile)));
  }
  const markupSources = [entry, ...integrationMarkupSources].join("\n");
  if (htmlTags(markupSources, "template").length) fail("inert template elements cannot provide essentials integration evidence");
  const codeTokens = javascriptIntegrationSources.flatMap(({ raw, jsxFile }) => javascriptCodeTokens(jsxFile ? maskJsxText(raw) : raw, jsxFile));
  if (htmlTags(markupSources, "milos-share-button").length === 0) fail("shared share control is required");
  if (!hasMethodCall(codeTokens, "setPayloadProvider")) fail("shared share control requires an app-owned payload provider");
  const shellProvidesPrivacyLink = await verifyShellPermanentLink(appRoot, manifest, entryPath);
  if (manifest.privacy?.mode === "no-cookies") {
    const allConsumerLinks = htmlTags(markupSources, "a").map(({ source }) => source);
    const consumerPrivacyLinks = allConsumerLinks.filter((source) => hasAttribute(source, "data-milos-privacy-info"));
    const exactPrivacyLinks = allConsumerLinks.filter((source) => attributeValue(source, "href") === manifest.privacy.privacyUrl);
    const privacyLink = consumerPrivacyLinks.find((source) => attributeValue(source, "href") === manifest.privacy.privacyUrl);
    if (shellProvidesPrivacyLink) {
      if (consumerPrivacyLinks.length || exactPrivacyLinks.length) fail("shell-provided privacy information must not duplicate a consumer-owned privacy link");
    } else if (!privacyLink) {
      if (consumerPrivacyLinks.length) fail("persistent consumer-owned privacy information must link to the exact manifest privacyUrl");
      fail("no-cookies requires persistent consumer-owned privacy information or a verified public-app-shell/v2 footer link");
    }
  }
  if (manifest.features?.datePicker && htmlTags(markupSources, "milos-date-picker").length === 0) fail("enabled date picker is missing");
  if (manifest.features?.placeSearch && htmlTags(markupSources, "milos-place-search").length === 0) fail("enabled place search is missing");
  if (manifest.features?.placeSearch && !hasMethodCall(codeTokens, "setSearchProvider")) fail("enabled place search requires an app-owned search provider");
  if (suggestions.enabled) {
    if (!hasMethodCall(codeTokens, "setSuggestionsProvider")) fail("enabled place suggestions require an app-owned suggestions provider");
  }

  for (const marker of ["data-milos-app-loading", "data-milos-loading-card", "data-milos-loading-icon", "data-milos-loading-title", "data-milos-loading-message", "data-milos-loading-progress"]) {
    if (!htmlStartTags(entry).some(({ source }) => hasAttribute(source, marker))) fail(`startup marker is missing: ${marker}`);
  }
  const iconPath = manifest.loading?.iconPath;
  const iconRuntimePath = loadingIconRuntimePath;
  const iconFile = await confinedPath(appRoot, path.resolve(appRoot, iconPath), "loading icon");
  await requiredFile(iconFile, "loading icon");
  const loadingIcon = htmlTags(entry, "img").map(({ source }) => source).find((source) => hasAttribute(source, "data-milos-loading-icon") && exactLocalUrlEquals(attributeValue(source, "src"), iconRuntimePath));
  if (!loadingIcon) fail("loading icon must use loading.iconRuntimePath or its iconPath fallback");
  const width = attributeValue(loadingIcon, "width");
  const height = attributeValue(loadingIcon, "height");
  if (width !== "32" || height !== "32") fail("loading icon needs explicit width/height of exactly 32");
  if (!hasCallPath(codeTokens, ["globalThis", "milosAppEssentials", "ready"])) fail("app must explicitly call the generated globalThis.milosAppEssentials.ready() API");

  return Object.freeze({ appKey: manifest.appKey, version: VERSION, vendorRoot, features: Object.freeze({ ...manifest.features }) });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyEssentials(args["app-root"], args.manifest);
  process.stdout.write(`public-app-essentials/v1 verification: PASS (${result.appKey}, ${result.version})\n`);
}
