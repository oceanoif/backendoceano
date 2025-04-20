const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO (permitindo apenas seu frontend)
const io = socketio(server, {
  cors: {
    origin: "https://oceanoif.github.io",
    methods: ["GET", "POST"]
  }
});

// Health Check
app.get('/', (req, res) => {
  res.send("Servidor de conexão do Quiz Oceano!");
});

// Objeto para salas: { código: [jogador1, jogador2] }
const rooms = {};

// Gera um código de 4 dígitos único
const generateRoomCode = () => {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[code]);
  return code;
};

// Lógica de conexão
io.on('connection', (socket) => {
  console.log(`👉 Novo jogador conectado: ${socket.id}`);

  // Criar sala
  socket.on('create_room', (callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = [socket.id]; // Sala com o criador
    socket.join(roomCode);
    callback({ roomCode });
    console.log(`🎮 Sala criada: ${roomCode}`);
  });

  // Entrar em sala existente
  socket.on('join_room', ({ roomCode }, callback) => {
    if (!rooms[roomCode]) {
      callback({ error: "Sala não encontrada!" });
      return;
    }
    if (rooms[roomCode].length >= 2) {
      callback({ error: "Sala cheia!" });
      return;
    }

    rooms[roomCode].push(socket.id);
    socket.join(roomCode);
    callback({ success: true });

    // Avisa ao criador que alguém entrou
    io.to(rooms[roomCode][0]).emit('opponent_joined');
    console.log(`🚪 Jogador ${socket.id} entrou na sala ${roomCode}`);
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log(`❌ Jogador desconectado: ${socket.id}`);
    // Remove jogador de todas as salas
    for (const [code, players] of Object.entries(rooms)) {
      const index = players.indexOf(socket.id);
      if (index !== -1) {
        players.splice(index, 1);
        if (players.length === 0) delete rooms[code]; // Apaga sala vazia
        else io.to(code).emit('opponent_left'); // Avisa ao outro jogador
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
