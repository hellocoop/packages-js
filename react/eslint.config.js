import baseConfig from '../eslint.config.mjs'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'

export default [
    ...baseConfig,
    reactPlugin.configs.flat.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.worker,
                ...globals.browser,
            },
        },
    },
    {
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
]
