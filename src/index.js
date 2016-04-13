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
var job = new CronJob(cronRange, function() {
    log('Running cron job...');
    backup();
  }, function () {
    log('Completed cron job');
  },
  true, /* Start the job right now */
  'Australia/Melbourne'
);

var lastBackupDf;

function backup() {
  Q.when(lastBackupDf && lastBackupDf.promise).then(_backup);
}

function _backup() {
  log('Backing up data...');
  mongoBackup({
    uri: uri,
    root: dir
  });
  log('Adding to Git...');
  lastBackupDf = Q.defer();
  require('simple-git')(dir)
    .add('./*')
    .commit('Update')
    .push('origin', 'master')
    .then(function() {
      lastBackupDf.resolve();
    });
}

function log() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(new Date());
  console.log.call(console, args.join(' '));
}
