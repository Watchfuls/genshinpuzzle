import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharedRoot = resolve(
  process.env.GENSHIN_SHARED_DIR || join(projectRoot, '..', 'genshin-shared'),
);
const sharedIcons = join(sharedRoot, 'icons');
const publicIcons = join(projectRoot, 'public', 'icons');

if (process.argv[2] === 'clean') {
  rmSync(publicIcons, { recursive: true, force: true });
  process.exit(0);
}

for (const category of ['characters', 'elements']) {
  const source = join(sharedIcons, category);
  if (!existsSync(source)) {
    throw new Error(`Shared ${category} icons were not found at ${source}`);
  }

  mkdirSync(publicIcons, { recursive: true });
  cpSync(source, join(publicIcons, category), { recursive: true });
}
