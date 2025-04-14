const express = require('express');
const socketio = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Middleware básico (opcional)
app.use(express.json()); // Para receber JSON em requisições

// Rota de health check (opcional)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'online' });
});

// Configuração do Socket.IO
io.on('connection', (socket) => {
  console.log('Novo usuário conectado');

  socket.on('enviarMensagem', (mensagem) => {
    console.log('Mensagem recebida:', mensagem);
    io.emit('novaMensagem', mensagem); // Broadcast para todos
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
