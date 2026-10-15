const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node',
    ignoreDeprecations: '6.0',
  },
});

const { bootstrapCodenexGm } = require('../../../scripts/seed-codenex-gm.ts');

bootstrapCodenexGm()
  .catch((err) => {
    console.error('[FATAL] Failed to bootstrap CODENEX Game Master:', err.message);
    process.exit(1);
  });
