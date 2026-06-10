const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const API = 'http://192.168.0.31:3001';
const LM = 'http://192.168.0.31:1234';

const app = express();

app.use('/api', createProxyMiddleware({ target: API, changeOrigin: true, pathRewrite: { '^/api': '' } }));
app.use('/lm', createProxyMiddleware({ target: LM, changeOrigin: true, pathRewrite: { '^/lm': '' } }));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*path}', (_, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(4000, () => console.log('http://localhost:4000'));
