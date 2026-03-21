const minimum = [20, 18, 1];
const current = process.versions.node.split('.').map((part) => Number(part));

const compare = (left, right) => {
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] || 0;
    const r = right[i] || 0;
    if (l > r) { return 1; }
    if (l < r) { return -1; }
  }
  return 0;
};

if (compare(current, minimum) < 0) {
  console.error(
    `Kursor packaging requires Node ${minimum.join('.')}+; current: ${process.versions.node}.\n` +
    'Use a newer Node runtime before running "npm run package".'
  );
  process.exit(1);
}
