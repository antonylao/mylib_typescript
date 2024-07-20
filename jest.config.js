/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: "lib",
  globals: {
    'ts-jest': {
      isolatedModules: true //disable type-checking and compile each file as an isolated module
    }
  },
};