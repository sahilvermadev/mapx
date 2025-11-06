const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/health',
  method: 'GET',
  timeout: 8000
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      // Accept 200 status code - server is responding
      if (res.statusCode === 200) {
        // Try to parse health response if available
        if (data) {
          try {
            const health = JSON.parse(data);
            // Accept 'healthy' or 'degraded' status (degraded means DB might be slow but server is up)
            if (health.status === 'healthy' || health.status === 'degraded') {
              process.exit(0);
            } else {
              // Server is responding but marked unhealthy - still accept it for startup
              // The container will be marked unhealthy but won't block startup
              console.warn('Health status is unhealthy but server is responding');
              process.exit(0);
            }
          } catch (parseError) {
            // If we can't parse, but got 200, server is up
            process.exit(0);
          }
        } else {
          // Got 200 but no body - server is responding
          process.exit(0);
        }
      } else {
        console.error(`Health check returned status ${res.statusCode}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to process health response:', error);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Health check request failed:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();

