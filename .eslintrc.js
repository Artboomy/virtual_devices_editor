module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    rules: {
        'no-prototype-builtins': 0
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'plugin:react/recommended',
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    parserOptions: {
        ecmaFeatures: {
            jsx: true // Allows for the parsing of JSX
        }
    },
    settings: {
        react: {
            version: 'detect' // Tells eslint-plugin-react to automatically detect the version of React to use
        }
    }
};
