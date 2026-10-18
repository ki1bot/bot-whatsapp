module.exports = {
  apps: [
    {
      name: "bot-whatsapp",
      script: "./index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 5000,
      min_uptime: "10s",
      max_restarts: 5,
      max_memory_restart: "450M",
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
