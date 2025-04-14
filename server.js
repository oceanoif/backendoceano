const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Rota para servir o arquivo HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Configuração do Socket.IO
io.on('connection', (socket) => {
  console.log('Novo usuário conectado');

  socket.on('enviarMensagem', (mensagem) => {
    console.log('Mensagem recebida:', mensagem);
    io.emit('novaMensagem', mensagem);
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado');
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
