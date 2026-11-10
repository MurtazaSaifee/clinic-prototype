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
