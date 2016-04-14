# mongodb-git-backup
Dumps a MongoDB database to a Git repo for backup

## Usage

	$ node src/index.js

Arguments:

* `--uri` - The MongoDB URI in the format: mongodb://<username>:<password>@localhost:27017/dbname
* `--dir` - The destination of the backup. Must be a Git repo with push access.
* `--cron` - The Cron job schedule. E.g. `"* * * * * *"` will execute every second. By default, this is `"00 00 * * * *"` (every hour).
* `--timezone` - The Cron job timezone. E.g. "Australia/Melbourne"
