import { escapeHtml } from './security';

export interface HighlightedCode {
  html: string;
  languageLabel: string;
  normalizedLang: string;
  lineCount: number;
}

const LANGUAGE_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TSX',
  typescript: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JSX',
  javascript: 'JavaScript',
  mjs: 'JavaScript',
  py: 'Python',
  python: 'Python',
  sh: 'Terminal',
  bash: 'Bash',
  zsh: 'Shell',
  shell: 'Terminal',
  console: 'Terminal',
  curl: 'cURL',
  json: 'JSON',
  jsonc: 'JSONC',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  ini: 'Config',
  sql: 'SQL',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  pgsql: 'PostgreSQL',
  rs: 'Rust',
  rust: 'Rust',
  go: 'Go',
  golang: 'Go',
  html: 'HTML',
  xml: 'XML',
  svg: 'SVG',
  css: 'CSS',
  diff: 'Diff',
  patch: 'Patch',
  md: 'Markdown',
  markdown: 'Markdown',
  dockerfile: 'Dockerfile',
  hcl: 'Terraform',
  tf: 'Terraform',
};

const JS_PY_RUST_GO_KEYWORDS = new Set([
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'def', 'del', 'delete', 'do', 'elif', 'else', 'enum', 'except', 'export',
  'extends', 'finally', 'fn', 'for', 'from', 'func', 'function', 'global', 'go', 'if',
  'impl', 'import', 'in', 'interface', 'is', 'lambda', 'let', 'loop', 'match', 'mod',
  'mut', 'namespace', 'new', 'nonlocal', 'not', 'of', 'or', 'package', 'pass', 'priv',
  'private', 'protected', 'pub', 'public', 'raise', 'readonly', 'return', 'select',
  'self', 'static', 'struct', 'super', 'switch', 'then', 'this', 'throw', 'trait',
  'try', 'type', 'typeof', 'unsafe', 'use', 'var', 'where', 'while', 'with', 'yield',
  'and', 'as', 'assert',
]);

const SHELL_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'case', 'esac',
  'while', 'until', 'function', 'export', 'local', 'readonly', 'return', 'exit',
  'set', 'unset', 'echo', 'printf', 'cd', 'pwd', 'curl', 'wget', 'git', 'npm',
  'npx', 'pnpm', 'yarn', 'node', 'python', 'python3', 'pip', 'uv', 'wrangler',
  'docker', 'kubectl', 'terraform', 'cargo', 'go', 'jq', 'grep', 'awk', 'sed',
  'cat', 'chmod', 'chown', 'mkdir', 'rm', 'cp', 'mv', 'sudo', 'apt', 'brew',
]);

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete',
  'create', 'alter', 'drop', 'table', 'index', 'view', 'policy', 'function', 'trigger',
  'on', 'as', 'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'group',
  'by', 'order', 'asc', 'desc', 'limit', 'offset', 'having', 'union', 'all', 'distinct',
  'and', 'or', 'not', 'null', 'is', 'in', 'exists', 'between', 'like', 'ilike', 'case',
  'when', 'then', 'else', 'end', 'primary', 'key', 'foreign', 'references', 'unique',
  'default', 'check', 'constraint', 'enable', 'row', 'level', 'security', 'using',
  'with', 'true', 'false', 'returning', 'conflict', 'do', 'nothing', 'cascade',
  'if', 'add', 'column', 'text', 'integer', 'bigint', 'boolean', 'jsonb', 'timestamptz',
  'uuid', 'serial', 'now', 'count', 'sum', 'avg', 'min', 'max', 'coalesce',
]);

const LITERAL_CONSTANTS = new Set([
  'true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'NaN', 'Infinity', 'nil',
]);

const BUILTIN_TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'void', 'object', 'symbol',
  'bigint', 'Promise', 'Record', 'Array', 'Map', 'Set', 'Partial', 'Required', 'Readonly',
  'Pick', 'Omit', 'Response', 'Request', 'Headers', 'URL', 'URLSearchParams', 'Error',
  'Date', 'RegExp', 'Uint8Array', 'Buffer', 'str', 'int', 'float', 'bool', 'dict', 'list',
  'tuple', 'Optional', 'Union', 'Any', 'i32', 'i64', 'u32', 'u64', 'usize', 'f32', 'f64',
  'String', 'Vec', 'Option', 'Result', 'Box', 'Arc',
]);

function wrapSpan(cls: string, raw: string): string {
  return `<span class="${cls}">${escapeHtml(raw)}</span>`;
}

function detectLanguage(rawLang: string, code: string): string {
  const clean = (rawLang || '').trim().toLowerCase().split(/\s+/)[0] || '';
  if (clean) return clean;
  const trimmed = code.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return 'json';
  }
  if (/^(?:\$\s+|#\s+|curl\s+|npx?\s+|npm\s+|pnpm\s+|git\s+|docker\s+|wrangler\s+)/m.test(trimmed)) {
    return 'bash';
  }
  if (/^\s*(?:SELECT|INSERT|UPDATE|CREATE\s+TABLE|ALTER\s+TABLE)\b/im.test(trimmed)) {
    return 'sql';
  }
  if (/^\s*(?:def\s+\w+|from\s+\w+\s+import|import\s+\w+)/m.test(trimmed)) {
    return 'python';
  }
  if (/^\s*(?:---|\+\+\+|@@\s+-\d+)/m.test(trimmed)) {
    return 'diff';
  }
  return 'ts';
}

function highlightDiff(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
        return wrapSpan('tok-meta', line);
      }
      if (line.startsWith('+')) {
        return wrapSpan('tok-add', line);
      }
      if (line.startsWith('-')) {
        return wrapSpan('tok-del', line);
      }
      return escapeHtml(line);
    })
    .join('\n');
}

function highlightJsonOrYaml(code: string, isJson: boolean): string {
  const rx = isJson
    ? /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|([{}[\],:])/g
    : /(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|^(\s*[\w.-]+)(\s*:)|\b(true|false|null|yes|no|on|off)\b|(-?\d+(?:\.\d+)?)/gm;

  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(code)) !== null) {
    if (m.index > last) {
      out += escapeHtml(code.slice(last, m.index));
    }
    if (isJson) {
      const [, strTok, colonPart, boolTok, numTok, cmtTok, punTok] = m;
      if (strTok !== undefined) {
        if (colonPart !== undefined) {
          out += wrapSpan('tok-key', strTok) + wrapSpan('tok-pun', colonPart);
        } else {
          out += wrapSpan('tok-str', strTok);
        }
      } else if (boolTok !== undefined) {
        out += wrapSpan('tok-num', boolTok);
      } else if (numTok !== undefined) {
        out += wrapSpan('tok-num', numTok);
      } else if (cmtTok !== undefined) {
        out += wrapSpan('tok-cmt', cmtTok);
      } else if (punTok !== undefined) {
        out += wrapSpan('tok-pun', punTok);
      }
    } else {
      const [, cmtTok, strTok, keyTok, colonPart, boolTok, numTok] = m;
      if (cmtTok !== undefined) {
        out += wrapSpan('tok-cmt', cmtTok);
      } else if (strTok !== undefined) {
        out += wrapSpan('tok-str', strTok);
      } else if (keyTok !== undefined) {
        out += wrapSpan('tok-key', keyTok) + wrapSpan('tok-pun', colonPart || ':');
      } else if (boolTok !== undefined) {
        out += wrapSpan('tok-num', boolTok);
      } else if (numTok !== undefined) {
        out += wrapSpan('tok-num', numTok);
      }
    }
    last = rx.lastIndex;
  }

  if (last < code.length) {
    out += escapeHtml(code.slice(last));
  }
  return out;
}

function highlightShell(code: string): string {
  const rx =
    /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]+\})|(^|\s)(--?[a-zA-Z0-9][\w-]*)|(\b[a-zA-Z_][a-zA-Z0-9_-]*\b)|(\b\d+(?:\.\d+)?\b)|([|&;><]+)/gm;

  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(code)) !== null) {
    if (m.index > last) {
      out += escapeHtml(code.slice(last, m.index));
    }
    const [, cmt, str, envVar, flagLead, flagTok, word, num, op] = m;
    if (cmt !== undefined) {
      out += wrapSpan('tok-cmt', cmt);
    } else if (str !== undefined) {
      out += wrapSpan('tok-str', str);
    } else if (envVar !== undefined) {
      out += wrapSpan('tok-type', envVar);
    } else if (flagTok !== undefined) {
      out += escapeHtml(flagLead || '') + wrapSpan('tok-attr', flagTok);
    } else if (word !== undefined) {
      if (SHELL_KEYWORDS.has(word)) {
        out += wrapSpan('tok-kw', word);
      } else {
        out += escapeHtml(word);
      }
    } else if (num !== undefined) {
      out += wrapSpan('tok-num', num);
    } else if (op !== undefined) {
      out += wrapSpan('tok-op', op);
    }
    last = rx.lastIndex;
  }

  if (last < code.length) {
    out += escapeHtml(code.slice(last));
  }
  return out;
}

function highlightSql(code: string): string {
  const rx =
    /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|\b([a-zA-Z_][a-zA-Z0-9_]*)\b|(\b\d+(?:\.\d+)?\b)|([=<>!+-/*(),;]+)/g;

  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(code)) !== null) {
    if (m.index > last) {
      out += escapeHtml(code.slice(last, m.index));
    }
    const [, cmt, str, word, num, pun] = m;
    if (cmt !== undefined) {
      out += wrapSpan('tok-cmt', cmt);
    } else if (str !== undefined) {
      out += wrapSpan('tok-str', str);
    } else if (word !== undefined) {
      const lower = word.toLowerCase();
      if (SQL_KEYWORDS.has(lower)) {
        out += wrapSpan('tok-kw', word);
      } else {
        out += escapeHtml(word);
      }
    } else if (num !== undefined) {
      out += wrapSpan('tok-num', num);
    } else if (pun !== undefined) {
      out += wrapSpan('tok-pun', pun);
    }
    last = rx.lastIndex;
  }

  if (last < code.length) {
    out += escapeHtml(code.slice(last));
  }
  return out;
}

function highlightMarkup(code: string): string {
  const rx = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w:-]*)|(\s+[a-zA-Z_:][\w:.-]*)(?=\s*=)|("[^"]*"|'[^']*')|(\/?>)/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(code)) !== null) {
    if (m.index > last) {
      out += escapeHtml(code.slice(last, m.index));
    }
    const [, cmt, tagOpen, attrName, attrVal, tagClose] = m;
    if (cmt !== undefined) {
      out += wrapSpan('tok-cmt', cmt);
    } else if (tagOpen !== undefined) {
      out += wrapSpan('tok-kw', tagOpen);
    } else if (attrName !== undefined) {
      out += wrapSpan('tok-attr', attrName);
    } else if (attrVal !== undefined) {
      out += wrapSpan('tok-str', attrVal);
    } else if (tagClose !== undefined) {
      out += wrapSpan('tok-kw', tagClose);
    }
    last = rx.lastIndex;
  }

  if (last < code.length) {
    out += escapeHtml(code.slice(last));
  }
  return out;
}

function highlightGeneralCode(code: string, isPythonLike: boolean): string {
  const rx = isPythonLike
    ? /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z_][\w.]*)|\b([a-zA-Z_]\w*)(\s*\()|\b([a-zA-Z_]\w*)\b|(\b(?:0x[0-9a-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?)\b)|([=<>!+\-*/%&|^~]+|[{}()[\].,:;])/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z_][\w.]*)|\b([a-zA-Z_$][\w$]*)(\s*\()|\b([a-zA-Z_$][\w$]*)\b|(\b(?:0x[0-9a-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?n?)\b)|(=>|===|!==|==|!=|<=|>=|&&|\|\||[=<>!+\-*/%&|^~?]+|[{}()[\].,:;])/g;

  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(code)) !== null) {
    if (m.index > last) {
      out += escapeHtml(code.slice(last, m.index));
    }
    const [, cmt, str, deco, fnName, fnParen, word, num, op] = m;
    if (cmt !== undefined) {
      out += wrapSpan('tok-cmt', cmt);
    } else if (str !== undefined) {
      out += wrapSpan('tok-str', str);
    } else if (deco !== undefined) {
      out += wrapSpan('tok-attr', deco);
    } else if (fnName !== undefined && fnParen !== undefined) {
      if (JS_PY_RUST_GO_KEYWORDS.has(fnName)) {
        out += wrapSpan('tok-kw', fnName) + wrapSpan('tok-pun', fnParen);
      } else {
        out += wrapSpan('tok-fn', fnName) + wrapSpan('tok-pun', fnParen);
      }
    } else if (word !== undefined) {
      if (LITERAL_CONSTANTS.has(word)) {
        out += wrapSpan('tok-num', word);
      } else if (JS_PY_RUST_GO_KEYWORDS.has(word)) {
        out += wrapSpan('tok-kw', word);
      } else if (BUILTIN_TYPES.has(word) || /^[A-Z][A-Za-z0-9_]*$/.test(word)) {
        out += wrapSpan('tok-type', word);
      } else {
        out += escapeHtml(word);
      }
    } else if (num !== undefined) {
      out += wrapSpan('tok-num', num);
    } else if (op !== undefined) {
      out += wrapSpan('tok-pun', op);
    }
    last = rx.lastIndex;
  }

  if (last < code.length) {
    out += escapeHtml(code.slice(last));
  }
  return out;
}

export function highlightCodeBlock(rawCode: string, rawLang = ''): HighlightedCode {
  const trimmedCode = String(rawCode || '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const normalizedLang = detectLanguage(rawLang, trimmedCode);
  const languageLabel =
    LANGUAGE_LABELS[normalizedLang] ||
    (rawLang ? rawLang.trim().toUpperCase().slice(0, 16) : 'Code');
  const lineCount = trimmedCode ? trimmedCode.split('\n').length : 1;

  let html: string;
  switch (normalizedLang) {
    case 'diff':
    case 'patch':
      html = highlightDiff(trimmedCode);
      break;
    case 'json':
    case 'jsonc':
      html = highlightJsonOrYaml(trimmedCode, true);
      break;
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'ini':
      html = highlightJsonOrYaml(trimmedCode, false);
      break;
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'shell':
    case 'console':
    case 'curl':
    case 'dockerfile':
      html = highlightShell(trimmedCode);
      break;
    case 'sql':
    case 'postgres':
    case 'postgresql':
    case 'pgsql':
      html = highlightSql(trimmedCode);
      break;
    case 'html':
    case 'xml':
    case 'svg':
      html = highlightMarkup(trimmedCode);
      break;
    case 'py':
    case 'python':
      html = highlightGeneralCode(trimmedCode, true);
      break;
    default:
      html = highlightGeneralCode(trimmedCode, false);
      break;
  }

  return {
    html,
    languageLabel,
    normalizedLang,
    lineCount,
  };
}
