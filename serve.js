const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO com CORS
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Rota de health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'online' });
});

// Objeto para armazenar as salas
const rooms = {};
const roomCodes = new Set();

// Função para gerar código único de 4 dígitos
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (roomCodes.has(code));
  roomCodes.add(code);
  return code;
}

// Configuração do Socket.IO
io.on('connection', (socket) => {
  console.log(`Novo usuário conectado: ${socket.id}`);

  // Criar uma nova sala
  socket.on('createRoom', () => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [socket.id],
      team1Score: 0,
      team2Score: 0,
      currentTeam: 1,
      currentQuestion: 0,
      gameStarted: false
    };

    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
    console.log(`Sala criada: ${roomCode}`);
  });

  // Entrar em uma sala existente
  socket.on('joinRoom', ({ roomCode }) => {
    if (!rooms[roomCode]) {
      socket.emit('joinedRoom', { success: false, message: 'Sala não encontrada' });
      return;
    }

    if (rooms[roomCode].players.length >= 2) {
      socket.emit('joinedRoom', { success: false, message: 'Sala cheia' });
      return;
    }

    rooms[roomCode].players.push(socket.id);
    socket.join(roomCode);
    
    // Notificar o host que um jogador entrou
    io.to(rooms[roomCode].players[0]).emit('playerJoined');
    
    socket.emit('joinedRoom', { 
      success: true, 
      roomCode,
      team: 2 // O jogador que entra é sempre o time 2
    });
    
    console.log(`Jogador ${socket.id} entrou na sala ${roomCode}`);
  });

  // Iniciar o jogo (apenas host)
  socket.on('startGame', ({ roomCode }) => {
    if (!rooms[roomCode] || rooms[roomCode].players[0] !== socket.id) {
      return;
    }

    rooms[roomCode].gameStarted = true;
    io.to(roomCode).emit('gameStarted');
    console.log(`Jogo iniciado na sala ${roomCode}`);
  });

  // Atualizar placar
  socket.on('updateScores', ({ roomCode, team1Score, team2Score, currentTeam }) => {
    if (!rooms[roomCode]) return;

    rooms[roomCode].team1Score = team1Score;
    rooms[roomCode].team2Score = team2Score;
    rooms[roomCode].currentTeam = currentTeam;

    io.to(roomCode).emit('updateScores', {
      team1Score,
      team2Score,
      currentTeam
    });
  });

  // Notificar seleção de resposta
  socket.on('answerSelected', ({ roomCode, team, correct, points }) => {
    if (!rooms[roomCode]) return;

    io.to(roomCode).emit('answerSelected', {
      team,
      correct,
      points
    });
  });

  // Próxima pergunta
  socket.on('nextQuestion', ({ roomCode, currentIndex }) => {
    if (!rooms[roomCode]) return;

    rooms[roomCode].currentQuestion = currentIndex;
    io.to(roomCode).emit('nextQuestion', { currentIndex });
  });

  // Fim de jogo
  socket.on('gameOver', ({ roomCode, winner }) => {
    if (!rooms[roomCode]) return;

    io.to(roomCode).emit('gameOver', { winner });
    console.log(`Jogo encerrado na sala ${roomCode}. Vencedor: Equipe ${winner}`);
    
    // Limpar sala após o jogo
    delete rooms[roomCode];
    roomCodes.delete(roomCode);
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
    
    // Remover jogador de todas as salas
    for (const roomCode in rooms) {
      const index = rooms[roomCode].players.indexOf(socket.id);
      if (index !== -1) {
        rooms[roomCode].players.splice(index, 1);
        
        // Notificar outro jogador sobre a desconexão
        if (rooms[roomCode].players.length > 0) {
          io.to(rooms[roomCode].players[0]).emit('playerDisconnected');
        }
        
        // Limpar sala se estiver vazia
        if (rooms[roomCode].players.length === 0) {
          delete rooms[roomCode];
          roomCodes.delete(roomCode);
        }
      }
    }
  });
});

// Configuração dos IPs estáticos (opcional - para whitelist)
const allowedIPs = ['35.160.120.126', '44.233.151.27', '34.211.200.85'];

// Middleware para verificar IP (opcional)
app.use((req, res, next) => {
  const clientIP = req.ip.replace('::ffff:', '');
  
  if (allowedIPs.includes(clientIP) || process.env.NODE_ENV === 'development') {
    next();
  } else {
    console.log(`Acesso negado para IP: ${clientIP}`);
    res.status(403).send('Acesso não autorizado');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`IPs permitidos: ${allowedIPs.join(', ')}`);
});
