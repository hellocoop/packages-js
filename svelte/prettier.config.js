import basePrettierConfig from '../prettier.config.mjs'

const config = {
    ...basePrettierConfig,
    plugins: ['prettier-plugin-svelte'],
    overrides: [
        {
            files: '*.svelte',
            options: {
                parser: 'svelte',
            },
        },
    ],
}

export default config
