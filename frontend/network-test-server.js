const http = require('http');
const os = require('os');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1> Netzwerk-Umgehung erfolgreich!</h1><p>Server läuft auf lokaler IP 192.168.178.47</p>');
});

server.listen(3000, '0.0.0.0', () => {
  console.log(' Server läuft auf ALLEN Interfaces:');
  console.log('   http://127.0.0.1:3000 (localhost - vermutlich blockiert)');
  console.log('   http://192.168.178.47:3000 (lokale IP - sollte funktionieren)');
  
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      if (iface.family === 'IPv4') {
        console.log('   http://' + iface.address + ':3000');
      }
    });
  });
});

server.on('error', (err) => {
  console.error(' Server-Fehler:', err.message);
});
