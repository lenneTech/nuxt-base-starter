#!/usr/bin/env node

async function create() {
  const spawn = require("cross-spawn");
  const fs = require("fs");
  const path = require("path");
  const childProcess = require("child_process");

  const projectName = process.argv[2];

  if (!projectName) {
    console.error("Please provide a valid project name.");
    process.exit(-1);
    return;
  }

  const currentDir = process.cwd();
  const projectDir = path.resolve(currentDir, projectName);

  if (fs.existsSync(projectDir)) {
    console.log(`❌  Directory with name ${projectName} already exists.`);
    process.exit(-1);
  }

  await copyFiles(__dirname + "/nuxt-base-template", projectDir);

  const projectPackageJson = require(path.join(projectDir, "package.json"));

  // Update the project's package.json with the new project name
  projectPackageJson.name = projectName;

  fs.writeFileSync(
    path.join(projectDir, "package.json"),
    JSON.stringify(projectPackageJson, null, 2)
  );

  process.chdir(projectName);

  const gitInit = childProcess.exec("git init");
  await waitForChildProcess(gitInit);

  console.log("Installing dependencies ...");
  const npmInstall = spawn("npm", ["install"], { stdio: "inherit" });
  await waitForSpawn(npmInstall);

  const preCommitHook = spawn("npx", [
    "npx",
    "husky",
    "add",
    ".husky/pre-commit",
    '"npm run lint"',
  ]);
  await waitForSpawn(preCommitHook);

  const gitAdd = childProcess.exec("git add .husky/pre-commit");
  waitForChildProcess(gitAdd);

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

function waitForChildProcess(process) {
  return new Promise((resolve, reject) => {
    process.stdout.on("data", (data) => {
      resolve(data);
    });
    process.stdout.on("error", (err) => {
      reject(err);
    });
  });
}

async function copyFiles(from, to) {
  const fse = require("fs-extra");
  try {
    await fse.copy(from, to);
    console.log("Copied nuxt base template successfully!");
  } catch (err) {
    console.error(err);
    process.exit(-1);
  }
}

create();
