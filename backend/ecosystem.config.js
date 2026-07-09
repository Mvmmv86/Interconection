const backendEnv = {
  PATH: '/var/www/interconection/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
};

module.exports = {
  apps: [
    {
      name: 'interconection-backend',
      script: '/var/www/interconection/backend/venv/bin/uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8002',
      cwd: '/var/www/interconection/backend',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: backendEnv
    },
    {
      name: 'interconection-backtest-worker',
      script: '/var/www/interconection/backend/venv/bin/celery',
      args: '-A app.celery_app.celery_app worker -Q backtests --loglevel=INFO --concurrency=1',
      cwd: '/var/www/interconection/backend',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: backendEnv
    }
  ]
};
