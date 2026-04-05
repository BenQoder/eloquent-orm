import { defineConfig } from 'tsup';
import { writeFileSync } from 'node:fs';
import packageJson from './package.json';

export default defineConfig((options) => ({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: !options.watch,
    platform: 'node',
    target: 'node16',
    external: ['mysql2', 'mysql2/promise', 'zod'],
    outExtension({ format }) {
        return {
            js: format === 'cjs' ? '.cjs' : '.js',
        };
    },
    onSuccess: async () => {
        const distPkg = {
            name: packageJson.name,
            version: packageJson.version,
            type: 'module',
            main: 'index.cjs',
            module: 'index.js',
            types: 'index.d.ts',
            exports: {
                '.': {
                    types: './index.d.ts',
                    import: './index.js',
                    require: './index.cjs',
                },
            },
        };

        writeFileSync('dist/package.json', JSON.stringify(distPkg, null, 2));
    },
}));
