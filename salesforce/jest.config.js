const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        // The shared CSS library is a CSS-only LWC bundle; Jest cannot resolve it, so stub it.
        '^c/restaurantStyles$': '<rootDir>/jest-mocks/emptyModule.js',
        ...(jestConfig.moduleNameMapper || {})
    },
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver']
};
