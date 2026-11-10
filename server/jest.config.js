// Tests run against their own database so they never touch dev data.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/clinic_test';

export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' } }],
  },
  globalSetup: './test/global-setup.js',
};
