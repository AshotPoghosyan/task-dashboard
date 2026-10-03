import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('design tokens', () => {
  it('keeps raw hex colors inside tokens.css', () => {
    const offenders = files(SRC).filter(
      (f) =>
        /\.(tsx?|css)$/.test(f) &&
        !f.endsWith('tokens.css') &&
        /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
