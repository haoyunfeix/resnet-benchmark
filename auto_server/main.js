"use strict";


const repo = require('./tfjs_repo.js');
//const runTest = require('./src/run.js');
//const browser = require('./src/browser.js');
//const genTestReport = require('./src/gen_single_report.js');
//const sendMail = require('./src/send_mail.js');
const settings = require('./config.json');
//const excel = require('./src/excel.js');
//const chart = require('./src/chart.js');
//const cron = require('node-cron');
//const moment = require('moment');
//const os = require('os');
//const GetChromiumBuild = require('./src/get_chromium_build.js');
//
//
//const cpuModel = os.cpus()[0].model;
//const platform = runTest.getPlatformName();

async function main() {

  try {
    await repo.updateTFJS();
  } catch (err) {

    console.log(err);
  }

  // Update the browser version in config.json if necessary
  // await browser.updateConfig(deviceInfo, settings);
  // await chart.cleanUpChartFiles();

}


//if (settings.enable_cron) {
//  cron.schedule(settings.update_browser_sched, () => {
//    browser.updateChrome();
//  });
//  if (cpuModel.includes('Intel')) {
//    cron.schedule(settings.intel_test_cadence, () => {
//      main();
//    });
//  } else {
//    cron.schedule(settings.amd_test_cadence, () => {
//      main();
//    });
//  }
//} else {
//  main();
//}
main();