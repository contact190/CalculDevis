const { io } = require('socket.io-client');

const socket = io('http://localhost:3001', {
  query: { deviceId: 'test-device' }
});

socket.on('connect', () => {
  console.log('Connected');
  
  // Ask for full sync to get current state
  socket.emit('request_full_sync', (response) => {
    console.log('Got full sync');
    
    // Simulate a change in ranges
    const newDb = JSON.parse(JSON.stringify(response.data));
    if (!newDb.ranges) newDb.ranges = [];
    newDb.ranges.push({ id: `R-${Date.now()}`, minL: 100, maxL: 200, name: 'Test Range' });
    
    // Send a replace_key op
    const op = {
      op: 'replace_key',
      collection: 'ranges',
      id: 'ranges',
      data: newDb.ranges,
      timestamp: new Date().toISOString(),
      deviceId: 'test-device'
    };
    
    socket.emit('push_ops', {
      ops: [op],
      deviceId: 'test-device'
    }, (ack) => {
      console.log('Ack:', ack);
      process.exit(0);
    });
  });
});
