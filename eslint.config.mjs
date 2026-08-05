import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig, // Disable ESLint rules that conflict with Prettier
    {
        ignores: [
            '**/dist',
            '**/dist-test',
            '**/node_modules',
            '**/.svelte-kit',
            'archive*/',
            '.claude/',
        ],
    },
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha,
            },
        },
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off', // allow typescript "any" type
            '@typescript-eslint/no-namespace': 'off', // TBD: ES2015 module syntax is preferred over namespaces

            // allow assertions expect(test).to.be.true since true is not a fn
            '@typescript-eslint/no-unused-expressions': 'off',

            '@typescript-eslint/ban-ts-comment': 'off', // TBD: allow @ts-ignore comments
            '@typescript-eslint/no-empty-object-type': 'off', // TBD: Auth | {} allow empty object

            // Destructuring to omit members -- stripping private fields from a
            // JWK, for example -- names the fields it is discarding. They are
            // not unused; naming them is how the omission works.
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    ignoreRestSiblings: true,
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
]
