// PM2 process file. Start with: pm2 start ecosystem.config.js
// Frontend is static (served by Nginx); only this project's API runs under PM2.
module.exports = {
  apps: [
    {
      name: 'hm-consultation-api',
      cwd: __dirname + '/backend',
      script: 'server.js',
      instances: 1, // SQLite: keep a single process
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' }, // PORT etc. come from backend/.env
      time: true,
      out_file: __dirname + '/logs/api-out.log',
      error_file: __dirname + '/logs/api-err.log',
    },
  ],
};
