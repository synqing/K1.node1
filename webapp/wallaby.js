module.exports = function () {
  return {
    // Auto-detect Jest configuration
    autoDetect: true,

    // Watch source files but exclude test files
    files: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.test.{ts,tsx}',
      'tsconfig.json',
      'vite.config.ts',
      'jest.config.ts',
      'package.json',
    ],

    // Jest test patterns
    tests: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],

    // Point to jest config file
    testFramework: {
      configFile: './jest.config.ts'
    },

    // TypeScript compiler with path aliases
    compilerOptions: {
      jsx: 'react-jsx',
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
        '@backend/*': ['./src/backend/*'],
      },
    },
  };
};
