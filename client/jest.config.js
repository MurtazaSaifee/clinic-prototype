// Run in a non-UTC zone so a time shown in the viewer's zone instead of clinic time (UTC) fails a test.
process.env.TZ = 'America/New_York';

export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } } },
    ],
  },
  moduleNameMapper: { '\\.css$': '<rootDir>/test/style-stub.js' },
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
};
