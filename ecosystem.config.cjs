const path = require('path');

const root = __dirname;

/**
 * PM2 production process file for teamorbit.
 *
 * Prerequisites:
 * - api/.env configured (DATABASE_URL, JWT_SECRET, PUBLIC_BASE_URL, …)
 * - Built artifacts: api/dist, web/dist, packages/client/dist
 * - SQLite and local uploads require a single API instance (fork mode)
 *
 * When the web process proxies to the API, set PUBLIC_BASE_URL to the public
 * origin browsers use (the web URL or your reverse-proxy origin) so absolute
 * media URLs stay same-origin through the proxy.
 *
 * Start:  pm2 start ecosystem.config.cjs
 * Reload: pm2 reload ecosystem.config.cjs --update-env
 * Stop:   pm2 stop ecosystem.config.cjs
 * Or:     ./scripts/deploy-prod.sh
 */
module.exports = {
  apps: [
    {
      name: 'teamorbit-api',
      cwd: path.join(root, 'api'),
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 10_000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: path.join(root, 'logs/pm2-api-error.log'),
      out_file: path.join(root, 'logs/pm2-api-out.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'teamorbit-web',
      cwd: path.join(root, 'web'),
      script: path.join(root, 'web/node_modules/vite/bin/vite.js'),
      args: 'preview --host 0.0.0.0 --port 4173',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        // Override when the API is not on localhost:3000.
        API_PROXY_TARGET:
          process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
      },
      error_file: path.join(root, 'logs/pm2-web-error.log'),
      out_file: path.join(root, 'logs/pm2-web-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
