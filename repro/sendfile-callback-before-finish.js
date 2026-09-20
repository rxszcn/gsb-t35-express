'use strict';
// usage: node p2_sendfile_completion.js <express-root>
const express = require(process.argv[2] || "../");
const http = require('node:http');
const fs = require('node:fs');

const dir = '/tmp/pxp-sendfile';
fs.mkdirSync(dir, { recursive: true });
const file = dir + '/blob.bin';
fs.writeFileSync(file, Buffer.alloc(64 * 1024, 0x61)); // 64 KiB of 'a'

const log = [];
const app = express();
app.disable('x-powered-by');

app.get('/f', (req, res) => {
  res.on('finish', () => log.push('finish'));
  res.on('close', () => log.push('close'));
  res.sendFile(file, (err) => {
    log.push('cb(err=' + (err ? (err.code || err.message) : 'null') + ',writableEnded=' + res.writableEnded + ')');
  });
});

const srv = http.createServer(app).listen(0, '127.0.0.1', () => {
  const port = srv.address().port;
  const reqc = http.get({ port, path: '/f' }, r => {
    let got = 0;
    let killed = false;
    r.on('data', c => {
      got += c.length;
      if (!killed) { killed = true; r.destroy(); reqc.destroy(); } // abandon right after first chunk
    });
    r.on('close', () => {
      setTimeout(() => {
        console.log('event-order :', log.join(' -> '));
        console.log('cb-says     :', log.some(x => x === 'cb(err=null,writableEnded=true)') ? 'SUCCESS (err=null)' : 'other');
        console.log('client-got  :', got, 'of', 64 * 1024, 'bytes');
        console.log('finish-seen :', log.includes('finish'));
        srv.close();
      }, 300);
    });
  });
  reqc.on('error', () => {});
});
