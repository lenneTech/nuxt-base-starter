#!/usr/bin/env node

// Usage: npx create-my-template my-app

async function create() {
  const spawn = require("cross-spawn");
  const fs = require("fs");
  const fsPromises = require("fs/promises");
  const path = require("path");

  // The first argument will be the project name.
  const projectName = process.argv[2];
  const currentDir = process.cwd();
  const projectDir = path.resolve(currentDir, projectName);

  // Create Nuxt Initial Project
  console.log("Initializing Nuxt ...");
  const initNuxtProject = spawn("npx", ["nuxi", "init", projectName], {
    stdio: "inherit"
  });
  await waitForSpawn(initNuxtProject).then(() =>
    console.log("✅  Initialized Nuxt successfully")
  ).catch(() => console.log("❌  Error while initializing Nuxt"));

  // CD into template and integrate tailwind
  process.chdir(projectName);

  // Installs tailwinds dev dependency for nuxt
  const installTailwindDev = spawn(
    "npm",
    ["i", "-save-dev", "@nuxtjs/tailwindcss"],
    {
      stdio: "inherit"
    }
  );
  await waitForSpawn(installTailwindDev).catch(() => console.log("❌  Error while installing Tailwind"));

  // Init tailwind
  console.log("Initializing Tailwind ...");
  const initTailwind = spawn("npx", ["tailwindcss", "init"], {
    stdio: "inherit"
  });
  await waitForSpawn(initTailwind).then(() =>
    console.log("✅  Initialized Tailwind successfully")
  ).catch(() => console.log("❌  Error while initializing Tailwind"));


  // Install @vueuse/core
  console.log("Installing VueUse ...");
  const installVueUse = spawn("npm", ["i", "@vueuse/core@9.13.0"]);
  await waitForSpawn(installVueUse).then(() =>
    console.log("✅  Installed VueUse successfully")
  ).catch(() => console.log("❌  Error while installing VueUse"));

  // Install Pinia (Stores and States)
  console.log("Installing Pinia ...");
  const pinia = spawn("npm", ["i", "@pinia/nuxt@0.4.7"], {
    stdio: "inherit"
  });
  await waitForSpawn(pinia).catch(() => console.log("❌  Error while installing Pinia"));
  const tempPiniaFix = spawn("npm", ["i", "pinia@2.0.33", "-f"]);
  await waitForSpawn(tempPiniaFix).then(() =>
    console.log("✅  Initialized Pinia successfully")
  ).catch(() => console.log("❌  Error while initializing Pinia"));

  // Install @lenne.tech/nuxt-base
  console.log("Installing nuxt-base ...");
  const installNuxtBase = spawn("npm", ["i", "@lenne.tech/nuxt-base@1.1.4"], {
    stdio: "inherit"
  });
  await waitForSpawn(installNuxtBase).then(() =>
    console.log("✅  Installed nuxt-base successfully")
  ).catch(() => console.log("❌  Error while installing nuxt-base"));

  // Install eslint and @antfu configuration
  console.log("eslint and @antfu configuration ...");
  const lint = spawn(
    "npm",
    ["i", "--save-dev", "eslint@8.34.0", "@antfu/eslint-config@0.35.2"],
    {
      stdio: "inherit"
    }
  );
  await waitForSpawn(lint).then(() =>
    console.log("✅  eslint and @antfu configuration successfully")
  ).catch(() => console.log("❌  Error while initializing eslint with @antfu"));


  // Install Typescript dev dependency
  console.log("Installing Typescript ...");
  const installTypescript = spawn("npm", ["i", "--save-dev", "typescript@4.9.5"], {
    stdio: "inherit"
  });
  await waitForSpawn(installTypescript).then(() =>
    console.log("✅  Installed Typescript successfully")
  ).catch(() => console.log("❌  Error while installing Typescript"));


  const projectPackageJson = require(path.join(projectDir, "package.json"));

  // Fix up package versions
  fixPackageVersions(projectPackageJson);

  // Update the project's package.json with the new project name
  projectPackageJson.name = projectName;

  fs.writeFileSync(
    path.join(projectDir, "package.json"),
    JSON.stringify(projectPackageJson, null, 2)
  );

  const eslintData = "{\n" + "    \"extends\": \"@antfu\"\n" + "}";
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

  // Init Folders
  await fsPromises.mkdir("src/pages", { recursive: true });
  await fsPromises.mkdir("src/composables", { recursive: true });
  await fsPromises.mkdir("src/components", { recursive: true });
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

  const nuxtConfigData =
    "// https://nuxt.com/docs/api/configuration/nuxt-config\n" +
    "export default defineNuxtConfig({\n" +
    "  srcDir: './src',\n" +
    "  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],\n" +
    "  imports: {\n" +
    "    dirs: ['./states', './stores'],\n" +
    "  },\n" +
    "})";

  fs.writeFileSync(path.join(projectDir, "nuxt.config.ts"), nuxtConfigData);

  const indexVueData =
    "<template>\n" +
    "  <div class=\"flex h-screen items-center justify-center\">\n" +
    "    <h1 class=\"text-6xl font-bold mb-2\">Lenne Nuxt Starter</h1>\n" +
    "  </div>\n" +
    "</template>\n"

  fs.writeFileSync("src/pages/index.vue", indexVueData);

  // Run `npm install` in the project directory to install
  // the dependencies. We are using a third-party library
  // called `cross-spawn` for cross-platform support.
  // (Node has issues spawning child processes in Windows).
  const npmInstall = spawn("npm", ["install"], { stdio: "inherit" });
  await waitForSpawn(npmInstall);

  console.log("Building Project ...");
  const npmRunBuild = spawn("npm", ["run", "build"], { stdio: "inherit" });
  await waitForSpawn(npmRunBuild).then(() => console.log("✅  Project was successfully built"))
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
