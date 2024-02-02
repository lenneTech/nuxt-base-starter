#!/usr/bin/env node

async function create() {
  const spawn = require('cross-spawn');
  const fs = require('fs');
  const path = require('path');
  const childProcess = require('child_process');
  const pjson = require('./package.json');

  console.log('ℹ️ create-nuxt-base started in version ', pjson.version);

  const packageInfos = await getPackageData(pjson.name);

  if (packageInfos) {
    const latestVersion = packageInfos['dist-tags'].latest;

    if (latestVersion !== pjson.version) {
      console.log('📣 Its a newer version of create-nuxt-base available!', pjson.version);
      console.log('Your version', pjson.version);
      console.log('Available version', latestVersion);
    }
  }

  const projectName = process.argv[2];
  const autoStart = process.argv[3] === 'auto-start';

  if (!projectName) {
    console.error('Please provide a valid project name.');
    process.exit(-1);
  }

  const currentDir = process.cwd();
  const projectDir = path.resolve(currentDir, projectName);

  if (fs.existsSync(projectDir)) {
    console.log(`❌  Directory with name ${projectName} already exists.`);
    process.exit(-1);
  }

  await copyFiles(__dirname + '/nuxt-base-template', projectDir);

  // Copy .env
  await copyFiles(__dirname + '/nuxt-base-template/.env.example', projectDir + '/.env');

  const projectPackageJson = require(path.join(projectDir, 'package.json'));

  // Update the project's package.json with the new project name
  projectPackageJson.name = projectName;

  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(projectPackageJson, null, 2));

  process.chdir(projectName);

  const gitInit = childProcess.exec('git init');
  await waitForChildProcess(gitInit);

  console.log('Installing dependencies ...');
  const npmInstall = spawn('npm', ['install'], { stdio: 'inherit' });
  await waitForSpawn(npmInstall);

  const removeGit = spawn('rm', ['-rf', '.git'], { stdio: 'inherit' });
  await waitForSpawn(removeGit);

  console.log('Success! Your new project is ready. 🎉');

  if (autoStart) {
    console.log('Building Project ...');
    const npmRunBuild = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
    await waitForSpawn(npmRunBuild)
      .then(() => console.log('✅  Project was successfully built'))
      .catch(() => console.log('❌  Error while building the project'));

    console.log(`Created ${projectName} at ${projectDir} 💾`);
    console.log(`Launching ${projectName} in: 3 💥`);
    await waitForMS(1000);
    console.log(`Launching ${projectName} in: 2 🔥`);
    await waitForMS(1000);
    console.log(`Launching ${projectName} in: 1 🧨`);
    await waitForMS(1000);
    console.log(`Launching ${projectName} ...  🚀`);
    await waitForMS(1000);
    const npmRunDev = spawn('npm', ['run', 'start'], { stdio: 'inherit' });
    await waitForSpawn(npmRunDev);
  }
}

function waitForSpawn(spawn) {
  return new Promise((resolve, reject) => {
    spawn.on('exit', () => resolve(true));
    spawn.on('error', () => reject());
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
    process.stdout.on('data', (data) => {
      resolve(data);
    });
    process.stdout.on('error', (err) => {
      reject(err);
    });
  });
}

async function copyFiles(from, to) {
  const fse = require('fs-extra');
  try {
    await fse.copy(from, to);
    console.log('Copied nuxt base template successfully!');
  } catch (err) {
    console.error(err);
    process.exit(-1);
  }
}

function getPackageData(packageName) {
  const https = require('https');

  return new Promise((resolve, reject) => {
    https
      .get('https://registry.npmjs.org/' + packageName, (resp) => {
        let data = '';

        // A chunk of data has been received.
        resp.on('data', (chunk) => {
          data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          resolve(JSON.parse(data));
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

create();
