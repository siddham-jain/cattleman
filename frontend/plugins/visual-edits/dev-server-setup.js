// Visual edits dev server setup
module.exports = function setupVisualEdits(app) {
  app.get('/__visual_edits__/metadata', (req, res) => {
    res.json({ enabled: true, version: '0.1.0' });
  });
};
