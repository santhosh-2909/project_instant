// @vitest-environment node
//
// Enforces the frontend/backend boundary as a test, not just a convention.
//
// Next.js catches a client component importing `server-only` at build time, but
// only for modules that actually reach a client graph. These checks are broader
// and fail faster: they catch a bad import the moment it is written, and they
// also cover directions Next has no opinion about (a shared module reaching
// into the server, a backend module importing UI).

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string, matcher: (path: string) => boolean): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, matcher));
    else if (matcher(full)) out.push(full);
  }
  return out;
}

const isSource = (p: string) => p.endsWith('.ts') || p.endsWith('.tsx');
const rel = (p: string) => relative(ROOT, p).split(sep).join('/');

function importsIn(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
  for (const match of text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]);
  return specifiers;
}

/** Route handlers are backend; page/component files under app/ are frontend. */
const isRouteHandler = (p: string) => rel(p).includes('/api/') && p.endsWith('route.ts');

describe('TC-ARCH-01 the frontend never imports the backend', () => {
  const frontendFiles = [
    ...walk(join(SRC, 'client'), isSource),
    ...walk(join(SRC, 'app'), isSource).filter((p) => !isRouteHandler(p)),
  ];

  it('finds frontend files to check', () => {
    expect(frontendFiles.length).toBeGreaterThan(15);
  });

  it('has no frontend module importing from @/server', () => {
    const violations = frontendFiles
      .filter((file) => importsIn(file).some((spec) => spec.startsWith('@/server')))
      .map(rel);

    // A leak here is not cosmetic: it previously shipped the provider stack and
    // the ONNX runtime import path into the browser bundle.
    expect(violations).toEqual([]);
  });

  it('has no frontend module importing a server-only npm package', () => {
    const SERVER_PACKAGES = ['@prisma/client', 'bcryptjs', 'jsonwebtoken', '@huggingface/transformers', 'openai', 'server-only'];
    const violations: string[] = [];

    for (const file of frontendFiles) {
      for (const spec of importsIn(file)) {
        if (SERVER_PACKAGES.includes(spec)) violations.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('TC-ARCH-02 shared/ stays dependency-free', () => {
  const sharedFiles = walk(join(SRC, 'shared'), isSource);

  it('finds shared modules', () => {
    expect(sharedFiles.length).toBeGreaterThan(0);
  });

  it('never imports from @/server or @/client', () => {
    const violations: string[] = [];
    for (const file of sharedFiles) {
      for (const spec of importsIn(file)) {
        if (spec.startsWith('@/server') || spec.startsWith('@/client')) {
          violations.push(`${rel(file)} -> ${spec}`);
        }
      }
    }
    // shared/ is the contract between the two sides. If it depends on either,
    // it is no longer shared and the boundary collapses.
    expect(violations).toEqual([]);
  });

  it('imports no runtime npm dependency at all', () => {
    const violations: string[] = [];
    for (const file of sharedFiles) {
      for (const spec of importsIn(file)) {
        const isRelative = spec.startsWith('.') || spec.startsWith('@/');
        const isNodeBuiltin = spec.startsWith('node:');
        if (!isRelative && !isNodeBuiltin) violations.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('TC-ARCH-03 backend modules declare themselves server-only', () => {
  const serverFiles = walk(join(SRC, 'server'), isSource);

  it('finds backend modules', () => {
    expect(serverFiles.length).toBeGreaterThan(10);
  });

  it("every module under src/server imports 'server-only'", () => {
    const missing = serverFiles
      .filter((file) => !readFileSync(file, 'utf8').includes("import 'server-only'"))
      .map(rel);

    expect(missing).toEqual([]);
  });

  it('the backend never imports UI components', () => {
    const violations: string[] = [];
    for (const file of serverFiles) {
      for (const spec of importsIn(file)) {
        if (spec.startsWith('@/client') || spec === 'react' || spec === 'react-dom') {
          violations.push(`${rel(file)} -> ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('TC-ARCH-04 the old src/lib layer is gone', () => {
  it('has no file importing from @/lib', () => {
    const violations: string[] = [];
    for (const file of walk(SRC, isSource)) {
      for (const spec of importsIn(file)) {
        if (spec.startsWith('@/lib')) violations.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
