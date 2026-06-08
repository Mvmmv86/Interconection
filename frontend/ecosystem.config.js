module.exports = {
  apps: [{
    name: 'interconection-frontend',
    script: '/var/www/interconection/frontend/start.sh',
    cwd: '/var/www/interconection/frontend',
    interpreter: '/bin/bash',
    max_restarts: 3,
    min_uptime: '10s',
    restart_delay: 10000,
    kill_timeout: 15000,
    treekill: true,
    autorestart: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3003
    }
  }]
};
