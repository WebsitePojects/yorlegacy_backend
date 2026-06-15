module.exports = {
  apps: [
    {
      name: 'yor-api-staging',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: '.env.staging',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
