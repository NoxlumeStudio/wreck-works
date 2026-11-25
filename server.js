import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.disable('x-powered-by');

app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'ignore' }));
app.use('/game-art', express.static(path.join(__dirname, 'game-art'), { dotfiles: 'ignore' }));
app.use('/story', express.static(path.join(__dirname, 'story'), { dotfiles: 'ignore' }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((_req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
