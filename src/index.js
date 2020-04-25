'use strict';

const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const readdir = require('recursive-readdir');
const Q = require('q');

let dir = yargs.argv.dir;
if (!dir || !fs.lstatSync(dir).isDirectory()) {
  throw new Error('Directory not found');
}
if (!fs.lstatSync(path.join(dir, '.git')).isDirectory()) {
  throw new Error('Directory must be a Git repo');
}
dir = path.resolve(__dirname, dir);
log('Backing up MongoDB to directory:', dir);

const uri = yargs.argv.uri;
if (!uri) {
  throw new Error('No MongoDB URI provided');
}
const uriInfo = getUriInfo(uri);
console.log(`Parsed URI: ${JSON.stringify(uriInfo)}`);

let runDf;

// Allow running the processs immediately without scheduling.
if (yargs.argv.now != null) {
  run();
} else {
  const CronJob = require('cron').CronJob;
  // Run every hour by default.
  const cronRange = yargs.argv.cron || '00 00 * * * *';
  const job = new CronJob(cronRange, run,
    true, /* Start the job right now */
    yargs.argv.timezone || 'Australia/Melbourne'
  );
}

function run() {
  // Prevent running if previous run is incomplete.
  if (runDf && runDf.promise && Q.isPending(runDf.promise)) return;

  runDf = Q.defer();
  runDf.resolve(deleteFiles(dir).then(backup).then(push));
  runDf.promise.catch(function(err) {
    console.error(err, err.stack);
  }).done();
}

function backup() {
  log('Backing up data...');
  const df = Q.defer();
  child_process.exec(`mongodump --host="${uriInfo.host}" --port="${uriInfo.port}" --username="${uriInfo.username}" --password="${uriInfo.password}" --db="${uriInfo.db}" --out=${dir}`, {}, (err, stdout, stderr) => {
    if (err) {
      log('Error during backup', err);
      df.reject(err);
    } else {
      log('Backup successful', stdout);
      df.resolve();
    }
  });
  return df.promise;
}

function push() {
  log('Adding to Git...');
  const df = Q.defer();

  function callback(err, result) {
    if (err) df.reject(err);
  }

  require('simple-git')(dir)
    .add('./*', callback)
    .then(function() {
      log('Committing...');
    })
    .commit('Update', callback)
    .then(function() {
      log('Pushing...');
    })
    .push('origin', 'master', callback)
    .then(function() {
      log('Pushed to Git');
      df.resolve();
    });
  return df.promise;
}

// Deletes the existing files in the subdirectores of the given directory.
function deleteFiles(dir) {
  log('Deleting existing files...');
  const df = Q.defer();

  // Exclude hidden directories (e.g. git).
  const dbDir = path.join(dir, uriInfo.db);
  log('Deleting directory:', dbDir);

  return Q.ninvoke(child_process, 'exec', `rm -rf ${dbDir}`, {});
}

// http://stackoverflow.com/questions/18112204
function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

function getUriInfo(uri) {
  const RE_URI = /mongodb:\/\/(?:(\w+)(:[^@]+)?@)?(\w+)(:\d+)?\/([^\/]+)/;
  const match = uri.match(RE_URI);
  return {
    host: match[3],
    port: match[4] != null ? stripColonPrefix(match[4]) : '',
    username: match[1] || '',
    password: match[2] != null ? stripColonPrefix(match[2]) : '',
    db: match[5],
  }
}

function stripColonPrefix(str) {
  return str.replace(/^:/, '');
}

function log() {
  const args = Array.prototype.slice.call(arguments);
  args.unshift(new Date());
  console.log.call(console, args.join(' '));
}
