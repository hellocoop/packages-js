import baseConfig from '../eslint.config.mjs'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vuePlugin from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'

export default [
    ...baseConfig,
    ...vuePlugin.configs['flat/recommended'],
    prettierConfig, // Disable ESLint rules that conflict with Prettier
    {
        files: ['**/*.{ts,vue}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser,
            parserOptions: {
                parser: tseslint.parser,
            },
        },
    },
    {
        rules: {
            'vue/require-default-prop': 'off',
            'vue/no-v-html': 'off',
        },
    },
]
