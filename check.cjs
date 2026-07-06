const fs = require('fs');
const data = JSON.parse(fs.readFileSync('runs.json'));
const failedRun = data.workflow_runs.find(r => r.conclusion === 'failure');
if (failedRun) {
    console.log("Failed run ID:", failedRun.id);
    console.log("Failed run URL:", failedRun.html_url);
} else {
    console.log("No failed runs found.");
}
