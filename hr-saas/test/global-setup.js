// Jest global setup: push Prisma schema to the shared e2e SQLite database.
const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const root = path.resolve(__dirname, '..');
  execSync('npx prisma db push --skip-generate', {
    cwd: root,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
};
