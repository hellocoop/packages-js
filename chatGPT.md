If you're managing a monorepo with npm packages and you want to include only the shared files that are used in each package without publishing the shared directory, you can achieve this by using TypeScript project references. This setup allows you to build each package separately, and TypeScript will ensure that the shared dependencies are built as needed.

Here's how to set up TypeScript project references:

### Step 1: Configure `tsconfig.json` for Shared Directory

In your `shared` directory, set up a `tsconfig.json` that allows it to be referenced by other projects:

```json
// shared/tsconfig.json
{
    "compilerOptions": {
        "composite": true,
        "declaration": true,
        "outDir": "./dist"
        // Other necessary options...
    },
    "include": ["src/**/*"]
}
```

The `composite` option is crucial here because it enables the project to be used with project references.

### Step 2: Configure `tsconfig.json` in the `nextjs` and `express` Directories

Add references to the shared directory in your `nextjs` and `express` projects' `tsconfig.json` files:

```json
// nextjs/tsconfig.json and express/tsconfig.json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@shared/*": ["../shared/dist/*"]
        }
        // Other necessary options...
    },
    "references": [{ "path": "../shared" }],
    "include": ["src/**/*"]
}
```

### Step 3: Update Your Build Scripts

Ensure that your build scripts build the `shared` directory first, and then build the dependent projects. This could be set up in a root `package.json` script, or you can manage it via a build tool or task runner:

```json
// In the package.json of the root directory
"scripts": {
  "build-shared": "tsc -b shared",
  "build-nextjs": "tsc -b nextjs",
  "build-express": "tsc -b express",
  "build": "npm run build-shared && npm run build-nextjs && npm run build-express"
}
```

When you run `npm run build`, it will compile the shared directory first, then compile the `nextjs` and `express` projects, including only the files that are actually imported from the shared directory.

### Step 4: Importing Shared Code

When you import from the shared directory within your `nextjs` and `express` packages, use the path alias set up in `tsconfig.json`. For example:

```typescript
import { sharedUtility } from '@shared/sharedUtility'
```

TypeScript and the build process will take care of pulling in the necessary files.

### Step 5: Handling Compilation

When you compile each project, TypeScript will follow the project references to compile the shared code (if it has not been compiled already) and include the compiled files in the respective `dist` directory of each project.

### Conclusion

This setup allows for:

- Shared code to be built only once.
- Each project to include only the shared files it actually uses.
- Avoiding the need to publish the shared directory as a separate npm package.
- Clear dependency management within your monorepo.

With this structure, the compiled JavaScript files that are output from the `shared` package will not be duplicated across the `dist` directories of `nextjs` and `express`. Instead, they will be included in the build output of each consuming package based on actual usage, which is managed by TypeScript's project references and build system.

---

Yes, you can use `--watch` with the `--build` mode in TypeScript to watch for file changes and recompile as necessary. When you use `--watch` (or `-w`) with `--build` (or `-b`), TypeScript will monitor all specified projects and their dependencies for changes and perform an incremental rebuild when needed.

Here's how you could use it:

```bash
tsc -b --watch
```

This will watch all projects specified in the `tsconfig.json` file (including referenced projects) for changes and rebuild as necessary.

As for the `--declaration` flag, this is typically specified in your `tsconfig.json` file rather than on the command line with `--build`. When you set `"declaration": true` in your `tsconfig.json`, TypeScript will generate `.d.ts` files for your TypeScript files. This is important for library authors who want to distribute their TypeScript library to users who may be using JavaScript or TypeScript in their projects.

Here's an example of how you might set it in your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "declaration": true,
        "outDir": "./dist"
        // other options...
    },
    "include": ["src/**/*"]
    // references if you are using project references...
}
```

When you run `tsc -b`, TypeScript will use the configuration specified in the `tsconfig.json` files, including generating declaration files if `"declaration": true` is set.

It's worth noting that in `--build` mode, TypeScript will automatically rebuild the declaration files as needed when you use the `--watch` flag. So, you generally do not need to specify `--declaration` on the command line when you're using `tsc -b`; it's enough to have it in your `tsconfig.json` files.

Always refer to the version of TypeScript you're using, as the behavior and available flags can change over time, and newer versions might have added features or changed how some of the flags work.

---

To reconfigure your `tsconfig.json` for the `express` package to use project references and share code from the `shared` package, you can modify it as follows:

1. **Remove `include` and `exclude`**: These keys are not necessary when using project references as TypeScript will figure out which files to include based on the project references and `rootDir`.

2. **Add `references`**: This key will point to the `tsconfig.json` of the shared package.

3. **Update `baseUrl`**: This should be set to the root of the package, not the `src` folder, to properly resolve modules.

4. **Add `composite`**: This key allows the package to be referenced by other packages.

5. **Remove `outDir` and other output-related options**: If you are using project references and the shared code is compiled separately, you might not need `outDir` in your package's `tsconfig.json`. However, if you still compile the package separately and want to generate output in the `dist` folder, you can leave `outDir` as is.

6. **Ensure `declaration` and `declarationMap` are present**: These options are correct for generating declaration files for your package.

Here's how your `tsconfig.json` could look:

```json
{
    "extends": "@tsconfig/node18/tsconfig.json",
    "compilerOptions": {
        "composite": true,
        "declaration": true,
        "declarationMap": true,
        "baseUrl": ".", // Changed from "./src/" to "."
        "target": "ES2019",
        "strict": true,
        "module": "CommonJS",
        "moduleResolution": "node",
        "outDir": "./dist",
        // If you need other paths you can still include them
        "paths": {
            "@shared/*": ["../shared/dist/*"]
        }
    },
    "references": [{ "path": "../shared" }]
}
```

Remember to replace `@shared/*` and `"../shared/dist/*"` with the correct relative paths according to your project's directory structure.

Please note that the shared package must be built before you build your express package, as TypeScript needs to resolve the references to the built JavaScript files in the `shared/dist` directory. If the shared code is purely TypeScript types and interfaces (which don't have a JavaScript runtime representation), then they must be available as `.d.ts` files for the express package to reference them.

After making these changes, you should be able to build your express package with project references by running `tsc -b`. If you want to watch for changes and rebuild automatically during development, you can use `tsc -b --watch`.

---

Your `package.json` looks well-structured for a typical TypeScript project. Since you're looking to integrate a shared package and utilize TypeScript project references, here are the modifications and considerations for your `scripts` and possibly other fields:

1. **Build Scripts**: Update the build scripts to leverage TypeScript project references. This will often involve building the shared code before the express code to ensure all dependencies are up-to-date.

```json
"scripts": {
  "clean": "rimraf ./dist",
  "build:shared": "tsc -b ../shared",
  "prebuild": "npm run clean && npm run build:shared",
  "build": "tsc -b",
  "watch": "tsc -b --watch",
  "start": "node ./dist/index.js"
},
```

With the above setup:

- `clean` removes the `dist` directory to ensure a fresh build.
- `build:shared` will build the shared directory first.
- `prebuild` runs before `build` and will clean and then build the shared code.
- `build` and `watch` will build the current project and all project references.
- `start` can be used to run your compiled application.

2. **TypeScript Configuration**: Ensure your `tsconfig.json` is properly configured for project references as discussed previously.

3. **Versioning**: If the shared code changes frequently, you might consider using a more specific versioning strategy instead of `"*"` for internal dependencies. This can prevent unexpected breaks due to changes in the shared code:

```json
"dependencies": {
  "@hellocoop/core": "^1.0.0", // Specify a version range that's appropriate
  // ... other dependencies
}
```

4. **Package Versions**: Keep an eye on the versions of the packages, especially `"typescript"` to make sure it's compatible with your code and other dependencies.

5. **npm `engines` Field**: This specifies which versions of Node.js your package is compatible with. Make sure the version specified here matches the version you are using in your development environment and what you expect your users to have.

6. **npm `files` Field**: This field specifies which files to include when your package is published. Since you're building to `dist`, it's correctly set. Just ensure that all the necessary built files from the shared directory are correctly referenced and accessible from `dist`.

7. **Repository Management**: If you're going to split your codebase into multiple packages within a monorepo, consider adding a root-level `package.json` that includes scripts to build/test/lint all packages at once for convenience.

8. **Continuous Integration**: If you use CI/CD pipelines, remember to update them according to the new build process.

By setting up your `package.json` and `tsconfig.json` to work together with TypeScript project references, you'll be able to efficiently manage shared code within your monorepo setup. Remember to thoroughly test your setup after making these changes to ensure that everything works as expected.
