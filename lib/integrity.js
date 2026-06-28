import { createHash } from 'node:crypto';

const BRAND_PARTS = [
  'Royal', ' ', 'Devlopments', '\n',
  'Built', ' ', 'by', ' ', 'Shaurya', '\n',
  'Website', ' ', 'Extractor'
];

const EXPECTED_HASH = 'a2241087b206f10d88c91f271a3d56cdb8d0c4b3a449bcd24d57c89793f715ad136c503112684a8c2599793594a9f50a5eeacc72a639b989457bfbf36cde3dab';

function reconstruct() {
  return BRAND_PARTS.join('');
}

function computeHash(str) {
  return createHash('sha512').update(str).digest('hex');
}

export function checkIntegrity() {
  const brand = reconstruct();
  const hash = computeHash(brand);
  if (hash !== EXPECTED_HASH) {
    return false;
  }
  return true;
}

export function getBrandString() {
  if (!checkIntegrity()) {
    process.exit(1);
  }
  return reconstruct();
}

export function getCreditLine() {
  if (!checkIntegrity()) {
    process.exit(1);
  }
  return 'Built by Shaurya';
}
