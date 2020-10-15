const os = require('os');
const fs = require('fs');
const path = require('path');
const child = require('child_process');
//const { chromium } = require('playwright-chromium');
const settings = require('./config.json');


function configChromePath(setting) {

  let platform = os.platform();

  if (platform === 'win32') {
    setting['chrome_path'] = setting.win_chrome_path.replace('HOME_DIR', os.homedir());
  } else if (platform === 'linux') {
    setting['chrome_path'] = setting.linux_chrome_path;
  } else {
    throw new Error('Unsupported test platform');
  }
}

function getDate(){
  let dateObj = new Date();
  let year = dateObj.getFullYear();
  let month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
  let date = ("0" + dateObj.getDate()).slice(-2);
  let hours = dateObj.getHours();
  let minutes = dateObj.getMinutes();
  let seconds = dateObj.getSeconds();
  return `${year}${month}${date}_${hours}${minutes}${seconds}`;
}


async function cloneTFJS() {

  await new Promise((resolve, reject) => {
    // download upstream
    let dlCmd = 'git clone https://github.com/tensorflow/tfjs';
    // add remote repo
    let arCmd = `cd ${tfjsDir} && git remote add yunfei https://github.com/haoyunfeix/tfjs`;
    let cmd = `${dlCmd} && ${arCmd}`;
    console.log(cmd);
    let output = child.execSync(cmd);
    console.log(output.toString());

    return resolve();
  });
  return Promise.resolve();
}

async function pullTFJS() {
  const currentDate = getDate();
  console.log(currentDate);

  await new Promise((resolve, reject) => {
    // chekcout master branch
    let cmCmd = `cd ${tfjsDir} && git checkout . && git checkout master`;
    // pull master
    let pmCmd = 'git pull';
    // new branch for test
    let nbCmd = `git checkout -b ${currentDate}`;
    // merge webgpu code
    let mwCmd = 'git fetch yunfei && git merge yunfei/e2e_webgpu';
    let cmd = `${cmCmd} && ${pmCmd} && ${nbCmd} && ${mwCmd}`;
    console.log(cmd);
    let output = child.execSync(cmd);
    console.log(output.toString());

    return resolve();
  });
  return Promise.resolve();
}

async function downloadModels() {
  const MODELS_BASE_URL =
    'https://storage.googleapis.com/tfjs-models/savedmodel';
  const MOBILENET_BASE = 'posenet/mobilenet/quant2/075';
  const RESNET50_BASE = 'posenet/resnet50/float';

  await new Promise((resolve, reject) => {
    if(!fs.existsSync(`${tfjsDir}/e2e/benchmarks/savedmodel/${RESNET50_BASE}`)){
      fs.mkdirSync(`${tfjsDir}/e2e/benchmarks/savedmodel/${RESNET50_BASE}`, {recursive: true});
    }
    let cmd = '';
    cmd = `curl -o ${tfjsDir}/e2e/benchmarks/savedmodel/${RESNET50_BASE}/model-stride32.json ${MODELS_BASE_URL}/${RESNET50_BASE}/model-stride32.json`
    console.log(cmd);
    let output = child.execSync(cmd);
    for(let i = 1; i < 24; i++){
      cmd = `curl -o ${tfjsDir}/e2e/benchmarks/savedmodel/${RESNET50_BASE}/group1-shard${i}of23.bin ${MODELS_BASE_URL}/${RESNET50_BASE}/group1-shard${i}of23.bin`
      let output = child.execSync(cmd);
    }
    cmd = `curl -o ${tfjsDir}/e2e/benchmarks/savedmodel/${MOBILENET_BASE}/model-stride32.json ${MODELS_BASE_URL}/${MOBILENET_BASE}/model-stride16.json`
    console.log(cmd);
    output = child.execSync(cmd);
    for(let i = 1; i < 2; i++){
      cmd = `curl -o ${tfjsDir}/e2e/benchmarks/savedmodel/${MOBILENET_BASE}/group1-shard${i}of1.bin ${MODELS_BASE_URL}/${MOBILENET_BASE}/group1-shard${i}of1.bin`
      let output = child.execSync(cmd);
    }
    console.log(output.toString());

    return resolve();
  });
  return Promise.resolve();
}

const folder = 'tfjs';
const currentDir = process.cwd();
const tfjsDir = path.join(process.cwd(), folder);
async function updateTFJS() {
  if(!fs.existsSync(folder)) {
    console.log(`Start clone ${folder}`);
    await cloneTFJS();
  }else {
    console.log(`Exist ${folder}, skip clone...`);
  }
  await pullTFJS();
  if(!fs.existsSync(`${tfjsDir}/e2e/benchmarks/savedmodel`)) {
    await downloadModels();
  }
}

/*
* Check browser version in latest results JSON
*/
async function checkBrowserVersion(deviceInfo) {

  let browserInfo = deviceInfo.Browser.split('-');
  let currentVersion = browserInfo.pop();

  if (!('chrome_canary_version' in settings)) {
    return Promise.resolve();
  } else {
    let lastVersion = settings.chrome_canary_version;
    if (currentVersion <= lastVersion) {
      return Promise.reject(new Error('No new browser update'))
    }
  }

  return Promise.resolve();
}

/*
* Update config.json when the browser version is higher than config.json
*/
async function updateConfig(deviceInfo, settings) {
  let browserInfo = deviceInfo.Browser.split('-');
  let currentVersion = browserInfo[browserInfo.length - 1];

  let needUpdate = false;
  if (! ('chrome_canary_version' in settings)) {
    needUpdate = true;
  } else if (settings.chrome_canary_version < currentVersion) {
    needUpdate = true;
  }

  if (needUpdate) {
    settings.chrome_canary_version = currentVersion;
    await fs.promises.writeFile(
      path.join(process.cwd(), 'config.json'),
      JSON.stringify(settings, null, 4));
  }
  return Promise.resolve();
}

/*
* Update Chrome canary by go to page chrome://settings/help
*/
async function updateWinChrome() {

  configChromePath(settings);
  let updateDir = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Update');
  if (fs.existsSync(updateDir)) {
    console.log('********** Getting chrome version before update **********');
    let browser = await chromium.launch({
      headless: false,
      executablePath: settings.chrome_path,
    });
    let page = await browser.newPage();
    await page.goto('chrome://version');
    let versionElement = await page.$('#version');
    let lastVersion = await versionElement.evaluate(element => element.innerText);
    console.log(lastVersion);

    console.log('********** Upgrading the Chromium browser **********');
    await page.goto('chrome://settings/help');

    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    await browser.close();

    console.log('********** Getting chrome version after update **********');
    browser = await chromium.launch({
      headless: false,
      executablePath: settings.chrome_path,
    });
    page = await browser.newPage();
    await page.goto('chrome://version');
    versionElement = await page.$('#version');
    thisVersion = await versionElement.evaluate(element => element.innerText);
    console.log(thisVersion);
    await browser.close();

    return Promise.resolve();
  } else {
    return Promise.reject(new Error('Update directory not found'));
  }
}

/*
* Download the Linux Chrome deb package
*/
async function dlChromeDeb() {

  let chromeDebUrl = 'https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb';
  let debDir = path.join(process.cwd(), 'deb');
  if (!fs.existsSync(debDir)) {
    fs.mkdirSync(debDir, {recursive: true});
  }
  let debPath = path.join(debDir, 'google-chrome-unstable_current_amd64.deb');
  if (fs.existsSync(debPath)) {
    fs.unlinkSync(debPath);
  }

  await new Promise((resolve, reject) => {
    let dlCmd = `wget -P ${debDir} ${chromeDebUrl}`;
    let output = child.execSync(dlCmd);
    console.log(output.toString());

    return resolve(debPath);
  });
  return Promise.resolve(debPath);
}

/*
* Install the deb package on Linux platform.
*/
async function installChromeDeb(chromePkg) {
  let password = settings.chrome_linux_password;
  let command = `echo ${password} | sudo -S dpkg -i ${chromePkg}`;

  try {
    let output = child.execSync(command);
    console.log(output.toString());
    return Promise.resolve();
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }
}


/*
* Get the latest Chrome installers of Windows and Linux and install.
*/
async function dlChromeAndInstall() {

  let chromePkg = await dlChromeDeb();
  await installChromeDeb(chromePkg);
  return Promise.resolve();
}


if (require.main === module) {
  updateTFJS();
} else {
  module.exports = {
    updateTFJS: updateTFJS
  };
}

