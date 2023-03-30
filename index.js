#!/usr/bin/node

async function create() {
  const ViteConfig =
    "import { URL, fileURLToPath } from 'node:url'\n" +
    "import { defineConfig } from 'vite'\n" +
    "import AutoImport from 'unplugin-auto-import/vite'\n" +
    "import Components from 'unplugin-vue-components/vite'\n" +
    "\n" +
    "// https://vitejs.dev/config/\n" +
    "export default defineConfig({\n" +
    "  plugins: [\n" +
    "    AutoImport({\n" +
    "      imports: ['vue', 'vue-router'],\n" +
    "      dirs: ['./composables'],\n" +
    "      vueTemplate: true\n" +
    "    }),\n" +
    "    Components({\n" +
    "      dirs: [\n" +
    "        './components/'\n" +
    "        // Component folders that should be auto-imported\n" +
    "      ],\n" +
    "      dts: true,\n" +
    "      directoryAsNamespace: true\n" +
    "    })\n" +
    "  ],\n" +
    "  resolve: {\n" +
    "    alias: {\n" +
    "      '~': fileURLToPath(new URL('./', import.meta.url))\n" +
    "      // Add any other aliases you use in your code base\n" +
    "      // https://nuxt.com/docs/api/configuration/nuxt-config/#alias\n" +
    "    }\n" +
    "  }\n" +
    "})";

  const StoryBookConfig =
    "import path from 'path'\n" +
    "import { loadConfigFromFile, mergeConfig } from 'vite'\n" +
    "\n" +
    "/** @type { import('@storybook/vue3-vite').StorybookConfig } */\n" +
    "export default {\n" +
    "  // Other configuration options\n" +
    "\n" +
    "  async viteFinal(baseConfig) {\n" +
    "    const { config: userConfig } = await loadConfigFromFile(\n" +
    '      path.resolve(__dirname, "../vite.config.ts")\n' +
    "    )\n" +
    "\n" +
    "    return mergeConfig(baseConfig, userConfig)\n" +
    "  }\n" +
    "}\n";

  const NuxtConfig =
    "// https://nuxt.com/docs/api/configuration/nuxt-config\n" +
    "export default defineNuxtConfig({\n" +
    "  srcDir: './src',\n" +
    "  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],\n" +
    "  imports: {\n" +
    "    dirs: ['./states', './stores'],\n" +
    "  },\n" +
    "})";

  const VitestConfig =
    "import { defineConfig } from 'vite'\n" +
    "import vue from '@vitejs/plugin-vue'\n" +
    "\n" +
    "export default defineConfig({\n" +
    "  plugins: [vue()],\n" +
    "  test: {\n" +
    "    globals: true,\n" +
    "    environment: 'jsdom',\n" +
    "  },\n" +
    "})";

  const HelloWorldSpec =
    "import { describe, it, expect } from 'vitest'\n" +
    "import { mount } from '@vue/test-utils'\n" +
    "\n" +
    "import HelloWorld from '../components/hello-world.vue'\n" +
    "\n" +
    "describe('HelloWorld', () => {\n" +
    "  it('is a Vue instance', () => {\n" +
    "    const wrapper = mount(HelloWorld)\n" +
    "    expect(wrapper.vm).toBeTruthy()\n" +
    "  })\n" +
    "})";

  const HelloWorldComponent =
    '<script setup lang="ts">\n' +
    "</script>\n" +
    "\n" +
    "<template>\n" +
    "  <h1\n" +
    '    class="text-transparent text-2xl bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600"\n' +
    "  >\n" +
    "    Hello World\n" +
    "  </h1>\n" +
    "</template>\n";

  const IndexPage =
    "<template>\n" +
    '  <div class="flex h-screen items-center justify-center flex-col">\n' +
    '    <h1 class="font-extrabold text-transparent text-8xl bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">\n' +
    "      Lenne Nuxt Starter\n" +
    "    </h1>\n" +
    "    <HelloWorld></HelloWorld>\n" +
    "  </div>\n" +
    "</template>\n";

  const spawn = require("cross-spawn");
  const fs = require("fs");
  const fsPromises = require("fs/promises");
  const path = require("path");

  const options = process.argv.filter(
    (arg) => arg.charAt(0) + arg.charAt(1) === "--"
  );
  const commands = process.argv.filter(
    (arg) => arg.charAt(0) + arg.charAt(1) !== "--"
  );
  const projectName = commands[commands.length - 1];

  if (!projectName) {
    console.error("Please provide a valid project name.");
    return;
  }

  const currentDir = process.cwd();
  const projectDir = path.resolve(currentDir, projectName);

  // Create Nuxt Initial Project
  console.log("Initializing Nuxt ...");
  const initNuxtProject = spawn("npx", ["nuxi", "init", projectName], {
    stdio: "inherit",
  });
  await waitForSpawn(initNuxtProject)
    .then(() => console.log("✅  Initialized Nuxt successfully"))
    .catch(() => console.log("❌  Error while initializing Nuxt"));

  // CD into template and integrate tailwind
  process.chdir(projectName);

  // Installs tailwinds dev dependency for nuxt
  const installTailwindDev = spawn(
    "npm",
    ["i", "-save-dev", "@nuxtjs/tailwindcss"],
    {
      stdio: "inherit",
    }
  );
  await waitForSpawn(installTailwindDev).catch(() =>
    console.log("❌  Error while installing Tailwind")
  );

  // Init tailwind
  console.log("Initializing Tailwind ...");
  const initTailwind = spawn("npx", ["tailwindcss", "init"], {
    stdio: "inherit",
  });
  await waitForSpawn(initTailwind)
    .then(() => console.log("✅  Initialized Tailwind successfully"))
    .catch(() => console.log("❌  Error while initializing Tailwind"));

  // Install @vueuse/core
  console.log("Installing VueUse ...");
  const installVueUse = spawn("npm", ["i", "@vueuse/core@9.13.0"]);
  await waitForSpawn(installVueUse)
    .then(() => console.log("✅  Installed VueUse successfully"))
    .catch(() => console.log("❌  Error while installing VueUse"));

  // Install Pinia (Stores and States)
  console.log("Installing Pinia ...");
  const pinia = spawn("npm", ["i", "@pinia/nuxt@0.4.7"], {
    stdio: "inherit",
  });
  await waitForSpawn(pinia).catch(() =>
    console.log("❌  Error while installing Pinia")
  );
  const tempPiniaFix = spawn("npm", ["i", "pinia@2.0.33", "-f"]);
  await waitForSpawn(tempPiniaFix)
    .then(() => console.log("✅  Initialized Pinia successfully"))
    .catch(() => console.log("❌  Error while initializing Pinia"));

  // Install @lenne.tech/nuxt-base
  console.log("Installing nuxt-base ...");
  const installNuxtBase = spawn("npm", ["i", "@lenne.tech/nuxt-base@1.1.4"], {
    stdio: "inherit",
  });
  await waitForSpawn(installNuxtBase)
    .then(() => console.log("✅  Installed nuxt-base successfully"))
    .catch(() => console.log("❌  Error while installing nuxt-base"));

  // Install eslint and @antfu configuration
  console.log("eslint and @antfu configuration ...");
  const lint = spawn(
    "npm",
    ["i", "--save-dev", "eslint@8.34.0", "@antfu/eslint-config@0.35.2"],
    {
      stdio: "inherit",
    }
  );
  await waitForSpawn(lint)
    .then(() => console.log("✅  eslint and @antfu configuration successfully"))
    .catch(() =>
      console.log("❌  Error while initializing eslint with @antfu")
    );

  // Install Typescript dev dependency
  console.log("Installing Typescript ...");
  const installTypescript = spawn(
    "npm",
    ["i", "--save-dev", "typescript@4.9.5"],
    {
      stdio: "inherit",
    }
  );
  await waitForSpawn(installTypescript)
    .then(() => console.log("✅  Installed Typescript successfully"))
    .catch(() => console.log("❌  Error while installing Typescript"));

  const eslintData = "{\n" + '    "extends": "@antfu"\n' + "}";
  fs.writeFileSync(".eslintrc", eslintData);

  const gitIgnore =
    "node_modules\n" +
    "*.log*\n" +
    ".nuxt\n" +
    ".nitro\n" +
    ".cache\n" +
    ".output\n" +
    ".env\n" +
    "dist\n";

  fs.writeFileSync(".gitignore", gitIgnore);

  // Handle Options
  if (options.includes("--tests")) {
    // Add Unit Tests
    console.log("Installing Vitest Unit Tests ...");
    const devDependencies = [
      "jsdom",
      "vitest",
      "@vitejs/plugin-vue",
      "@vue/test-utils",
      "@nuxt/test-utils",
      "eslint-plugin-vitest",
    ];
    await waitForSpawn(
      spawn("npm", ["i", "--save-dev", ...devDependencies], {
        stdio: "inherit",
      })
    )
      .then(() => console.log("✅  Installed Vitest Unit Tests successfully"))
      .catch(() => console.log("❌  Error while installing Vitest Unit Tests"));

    fs.writeFileSync("vitest.config.js", VitestConfig);

    const eslintData =
      "{\n" +
      '    "extends": "@antfu",\n' +
      '    "plugins": ["vitest"]\n' +
      "}";
    fs.writeFileSync(".eslintrc", eslintData);

    await fsPromises.mkdir("src/tests", { recursive: true });
    fs.writeFileSync("src/tests/.gitkeep", "");
    fs.writeFileSync("src/tests/hello-world.spec.ts", HelloWorldSpec);

    // Add Cypress Tests
    console.log("Installing Cypress Tests...");
    await waitForSpawn(
      spawn("npm", ["i", "--save-dev", "cypress@12.9.0"], {
        stdio: "inherit",
      })
    )
      .then(() => console.log("✅  Installed Cypress Tests successfully"))
      .catch(() => console.log("❌  Error while installing Cypress Tests"));
  }

  if (options.includes("--storybook")) {
    console.log("Installing Storybook ...");
    await waitForSpawn(
      spawn(
        "npx",
        ["storybook@next", "init", "--type", "vue3", "--builder", "vite"],
        {
          stdio: "inherit",
        }
      )
    )
      .then(() => console.log("✅  Installed Storybook successfully"))
      .catch(() => console.log("❌  Error while installing Storybook"));

    // https://laurentcazanove.com/articles/storybook-nuxt-guide/
    // Currently not working
    /*    await waitForSpawn(spawn("npm", ["i", "--save-dev", "unplugin-auto-import", "unplugin-vue-components"], {
          stdio: "inherit"
        }))
          .catch((() => console.log("❌  Error while installing Auto Imports for Storybook")));

        await fsPromises.writeFile("vite.config.ts", ViteConfig);
        await fsPromises.writeFile(".storybook/main.ts", StoryBookConfig);*/
  }

  // Init Folders
  await fsPromises.mkdir("src/pages", { recursive: true });
  await fsPromises.mkdir("src/composables", { recursive: true });
  await fsPromises.mkdir("src/components", { recursive: true });
  fs.writeFileSync("src/components/hello-world.vue", HelloWorldComponent);
  await fsPromises.mkdir("src/assets/css", { recursive: true });
  await fsPromises.rm("app.vue");

  // Init Files
  const tailwindData =
    "@tailwind base;\n" +
    "@tailwind components;\n" +
    "@tailwind utilities;\n" +
    "\n" +
    "/* Add applies here */";
  fs.writeFileSync("src/assets/css/tailwind.css", tailwindData);
  fs.writeFileSync("src/components/.gitkeep", "");
  fs.writeFileSync("src/pages/.gitkeep", "");
  fs.writeFileSync("src/composables/.gitkeep", "");

  fs.writeFileSync(path.join(projectDir, "nuxt.config.ts"), NuxtConfig);

  fs.writeFileSync("src/pages/index.vue", IndexPage);

  const projectPackageJson = require(path.join(projectDir, "package.json"));

  // Fix up package versions
  fixPackageVersions(projectPackageJson);

  // Update the project's package.json with the new project name
  projectPackageJson.name = projectName;

  if (options.includes("--tests")) {
    projectPackageJson.scripts.test = "vitest";
    projectPackageJson.scripts["cy:open"] = "npx cypress open";
  }

  fs.writeFileSync(
    path.join(projectDir, "package.json"),
    JSON.stringify(projectPackageJson, null, 2)
  );

  // Run `npm install` in the project directory to install
  // the dependencies. We are using a third-party library
  // called `cross-spawn` for cross-platform support.
  // (Node has issues spawning child processes in Windows).
  const npmInstall = spawn("npm", ["install"], { stdio: "inherit" });
  await waitForSpawn(npmInstall);

  console.log("Building Project ...");
  const npmRunBuild = spawn("npm", ["run", "build"], { stdio: "inherit" });
  await waitForSpawn(npmRunBuild)
    .then(() => console.log("✅  Project was successfully built"))
    .catch(() => console.log("❌  Error while building the project"));

  console.log("Success! Your new project is ready. 🎉");
  console.log(`Created ${projectName} at ${projectDir} 💾`);
  console.log(`Launching ${projectName} in: 3 💥`);
  await waitForMS(1000);
  console.log(`Launching ${projectName} in: 2 🔥`);
  await waitForMS(1000);
  console.log(`Launching ${projectName} in: 1 🧨`);
  await waitForMS(1000);
  console.log(`Launching ${projectName} ...  🚀`);
  await waitForMS(1000);
  const npmRunDev = spawn("npm", ["run", "dev"], { stdio: "inherit" });
  await waitForSpawn(npmRunDev);
}

function waitForSpawn(spawn) {
  return new Promise((resolve, reject) => {
    spawn.on("exit", () => resolve(true));
    spawn.on("error", () => reject());
  });
}

function waitForMS(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  });
}

function fixPackageVersions(packageJson) {
  const dependencies = packageJson.dependencies;
  const devDependencies = packageJson.devDependencies;
  const peerDependencies = packageJson.peerDependencies;
  removeVersionPrefix(dependencies);
  removeVersionPrefix(devDependencies);
  removeVersionPrefix(peerDependencies);
}

function removeVersionPrefix(dependencies) {
  for (let dependency in dependencies) {
    dependencies[dependency] = dependencies[dependency].replace("^", "");
  }
}

create();
