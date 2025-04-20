const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO com CORS liberado
const io = socketio(server, {
  cors: {
    origin: "*", // Permite todas as origens (para desenvolvimento)
    methods: ["GET", "POST"]
  }
});

// Middleware básico
app.use(cors());
app.use(express.json());

// Rota de health check
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'online',
    message: 'Servidor Quiz Oceano está rodando',
    socket: 'Conecte-se via Socket.IO na porta 3000'
  });
});

// Objeto para armazenar salas
const rooms = new Map();

// Gera código de sala aleatório
const generateRoomCode = () => {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  return rooms.has(code) ? generateRoomCode() : code;
};

// Conexão Socket.IO
io.on('connection', (socket) => {
  console.log(`Novo cliente conectado: ${socket.id}`);

  // Criar sala
  socket.on('create_room', () => {
    const roomCode = generateRoomCode();
    rooms.set(roomCode, {
      players: [socket.id],
      scores: { team1: 0, team2: 0 },
      currentTeam: 1,
      gameStarted: false
    });

    socket.join(roomCode);
    socket.emit('room_created', roomCode);
    console.log(`Sala criada: ${roomCode}`);
  });

  // Entrar em sala existente
  socket.on('join_room', (roomCode) => {
    if (!rooms.has(roomCode)) {
      socket.emit('join_error', 'Sala não encontrada');
      return;
    }

    const room = rooms.get(roomCode);
    if (room.players.length >= 2) {
      socket.emit('join_error', 'Sala cheia');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomCode);
    socket.emit('joined_room', { 
      team: 2, 
      roomCode 
    });

    // Notifica o criador da sala
    io.to(room.players[0]).emit('opponent_joined');
    console.log(`Jogador ${socket.id} entrou na sala ${roomCode}`);
  });

  // Iniciar jogo (apenas host)
  socket.on('start_game', (roomCode) => {
    const room = rooms.get(roomCode);
    if (room && room.players[0] === socket.id) {
      room.gameStarted = true;
      io.to(roomCode).emit('game_started');
      console.log(`Jogo iniciado na sala ${roomCode}`);
    }
  });

  // Atualizar placar
  socket.on('update_score', ({ roomCode, team, points }) => {
    const room = rooms.get(roomCode);
    if (room) {
      team === 1 ? room.scores.team1 += points : room.scores.team2 += points;
      room.currentTeam = team === 1 ? 2 : 1; // Alterna turno
      
      io.to(roomCode).emit('score_updated', {
        scores: room.scores,
        currentTeam: room.currentTeam
      });

      // Verifica vencedor (alvo: 100 pontos)
      if (room.scores.team1 >= 100 || room.scores.team2 >= 100) {
        const winner = room.scores.team1 >= 100 ? 1 : 2;
        io.to(roomCode).emit('game_over', { winner });
        rooms.delete(roomCode);
      }
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    // Remove de todas as salas
    rooms.forEach((room, code) => {
      room.players = room.players.filter(id => id !== socket.id);
      if (room.players.length === 0) {
        rooms.delete(code);
      } else {
        io.to(room.players[0]).emit('opponent_left');
      }
    });
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
