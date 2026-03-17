// Health check endpoints
module.exports = function healthEndpoints(app) {
  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  app.get('/health/ready', (req, res) => res.json({ ready: true }));
};
