// PM2 Ecosystem Configuration
// AK Parti Gençlik Kolları Yönetim Sistemi

module.exports = {
  apps: [
    {
      name: 'akparti-genclik-main',
      script: './dist/index.js',
      instances: 2, // CPU core sayısına göre ayarlayın
      exec_mode: 'cluster',
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      
      // Monitoring
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Logs
      log_file: '/var/log/akparti-genclik/combined.log',
      out_file: '/var/log/akparti-genclik/out.log',
      error_file: '/var/log/akparti-genclik/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart options
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // Advanced PM2 features
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Health monitoring
      health_check_url: 'http://localhost:5000/health',
      health_check_grace_period: 3000,
    },
    
    {
      name: 'akparti-face-recognition',
      script: '/opt/akparti-genclik/python_services/face_recognition_service.py',
      interpreter: '/opt/akparti-genclik/venv/bin/python',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment for Python service
      env: {
        PYTHONPATH: '/opt/akparti-genclik/python_services',
        PORT: 8000,
        ENVIRONMENT: 'production',
      },
      
      // Monitoring
      max_memory_restart: '2G',
      min_uptime: '10s',
      max_restarts: 5,
      
      // Logs
      log_file: '/var/log/akparti-genclik/face-recognition-combined.log',
      out_file: '/var/log/akparti-genclik/face-recognition-out.log',
      error_file: '/var/log/akparti-genclik/face-recognition-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart options
      watch: false,
      kill_timeout: 10000,
      listen_timeout: 5000,
    }
  ],

  deploy: {
    production: {
      user: 'akparti',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/akparti-genclik-kollari.git',
      path: '/opt/akparti-genclik',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};