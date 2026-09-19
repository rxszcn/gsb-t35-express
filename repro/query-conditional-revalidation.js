'use strict';
// 探针：QUERY 方法 + If-None-Match 能否命中条件复用（304）
const express = require('..');
const http = require('http');

const app = express();
app.use(function (req, res) {
  res.set('ETag', '"12345"');
  res.send('body, req.fresh=' + req.fresh);
});

const server = app.listen(0, function () {
  const port = server.address().port;

  function fire(label, opts, body) {
    return new Promise(function (resolve) {
      const r = http.request(Object.assign({ port: port, path: '/reports' }, opts), function (res) {
        let d = '';
        res.on('data', function (c) { d += c; });
        res.on('end', function () {
          console.log(label, '=> status', res.statusCode, '| body:', JSON.stringify(d), '| etag:', res.headers.etag);
          resolve();
        });
      });
      r.on('error', function (e) { console.log(label, '=> ERROR', e.message); resolve(); });
      r.end(body);
    });
  }

  (async function () {
    await fire('GET   + If-None-Match ', { method: 'GET', headers: { 'If-None-Match': '"12345"' } });
    await fire('HEAD  + If-None-Match ', { method: 'HEAD', headers: { 'If-None-Match': '"12345"' } });
    await fire('QUERY + If-None-Match ', { method: 'QUERY', headers: { 'If-None-Match': '"12345"' } }, '{"ids":["a"]}');
    await fire('QUERY (no validator)  ', { method: 'QUERY' }, '{"ids":["a"]}');
    server.close();
  })();
});
