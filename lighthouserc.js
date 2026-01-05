module.exports = {
  ci: {
    collect: {
      staticDistDir: './',
      url: ['http://localhost:8000/'],
      startServerCommand: 'python3 -m http.server 8000',
      startServerReadyPattern: 'Serving HTTP on',
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-reports',
    },
  },
};