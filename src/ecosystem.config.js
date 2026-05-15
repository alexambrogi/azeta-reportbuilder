module.exports = {
  apps : [{
    name: 'batchReportGenerate',
    script: 'node',
    args: '-r ts-node/register src/index.ts',
    watch: false,
    autorestart: true,
    ignore_watch: ["src/pdf/*","node_modules"],
    cron_restart: '0 */1 * * *',// Ogni ora
    log_date_format: "DD-MM-YYYY HH:mm Z",
  }],

  deploy : {
    production : {
      'pre-deploy-local': 'npm run local',
      'post-deploy' : 'npm run local',
      'pre-setup': ''
    }
  }
};
