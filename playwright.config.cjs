const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', timeout: 60000, workers: 1,
  use: { channel: 'chrome', baseURL:'http://localhost:8080', viewport:{width:1280,height:720}, screenshot:'only-on-failure' },
  webServer:{ command:'node tools/serve.cjs', url:'http://localhost:8080', reuseExistingServer:true },
});
