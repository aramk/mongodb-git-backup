var yargs = require('yargs');
var fs = require('fs');
var path = require('path');
var mongoBackup = require('mongodb-backup');
var readdir = require('recursive-readdir');
var Q = require('q');

var dir = yargs.argv.dir;
if (!dir || !fs.lstatSync(dir).isDirectory()) {
  throw new Error('Directory not found');
}
if (!fs.lstatSync(path.join(dir, '.git')).isDirectory()) {
  throw new Error('Directory must be a Git repo');
}
dir = path.resolve(__dirname, dir);
log('Backing up MongoDB to directory:', dir);

var uri = yargs.argv.uri;
if (!uri) {
  throw new Error('No MongoDB URI provided');
}

var CronJob = require('cron').CronJob;
// Run every hour by default.
var cronRange = yargs.argv.cron || '00 00 * * * *';
var job = new CronJob(cronRange, run,
  true, /* Start the job right now */
  yargs.argv.timezone || 'Australia/Melbourne'
);

var runDf;

function run() {
  // Prevent running if previous run is incomplete.
  if (runDf && runDf.promise && Q.isPending(runDf.promise)) return;

  runDf = Q.defer();
  runDf.resolve(backup().then(push));
}

function backup() {
  log('Backing up data...');
  var df = Q.defer();
  mongoBackup({
    uri: uri,
    root: dir,
    callback: function(err, result) {
      if (err) {
        log('Error during backup', err);
        df.reject(err);
      } else {
        log('Backup successful', result);
        df.resolve(result);
      }
    }
  });
  return df.promise;
}

function push() {
  log('Adding to Git...');
  var df = Q.defer();
  require('simple-git')(dir)
    .add('./*')
    .then(function() {
      log('Committing...');
    })
    .commit('Update')
    .then(function() {
      log('Pushing...');
    })
    .push('origin', 'master')
    .then(function() {
      log('Pushed to Git');
      df.resolve();
    });
  return df.promise;
}

function log() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(new Date());
  console.log.call(console, args.join(' '));
}
