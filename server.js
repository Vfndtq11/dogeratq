const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Раздаём статические файлы
app.use(express.static('public'));

// Хранилище комнат и стримов
const streams = new Map(); // streamId -> { streamerSocketId, password, viewers }

io.on('connection', (socket) => {
  console.log('Клиент подключился:', socket.id);

  // Стример создаёт стрим
  socket.on('streamer:create', (data, callback) => {
    const { streamId, password } = data;
    
    if (streams.has(streamId)) {
      callback({ success: false, error: 'Stream ID уже существует' });
      return;
    }
    
    streams.set(streamId, {
      streamerSocketId: socket.id,
      password: password,
      viewers: new Set()
    });
    
    socket.join(`stream:${streamId}`);
    callback({ success: true });
    console.log(`Стрим создан: ${streamId}`);
  });

  // Стример отправляет SDP offer
  socket.on('streamer:offer', (data) => {
    const { streamId, targetSocketId, offer } = data;
    io.to(targetSocketId).emit('viewer:offer', {
      streamId,
      offer,
      streamerSocketId: socket.id
    });
  });

  // Зритель отправляет SDP answer
  socket.on('viewer:answer', (data) => {
    const { streamerSocketId, answer } = data;
    io.to(streamerSocketId).emit('streamer:answer', { answer });
  });

  // Зритель отправляет ICE candidate
  socket.on('viewer:ice-candidate', (data) => {
    const { streamerSocketId, candidate } = data;
    io.to(streamerSocketId).emit('streamer:ice-candidate', { candidate });
  });

  // Стример отправляет ICE candidate
  socket.on('streamer:ice-candidate', (data) => {
    const { viewerSocketId, candidate } = data;
    io.to(viewerSocketId).emit('viewer:ice-candidate', { candidate });
  });

  // Зритель подключается к стриму
  socket.on('viewer:join', (data, callback) => {
    const { streamId, password } = data;
    
    const stream = streams.get(streamId);
    if (!stream) {
      callback({ success: false, error: 'Стрим не найден' });
      return;
    }
    
    if (stream.password !== password) {
      callback({ success: false, error: 'Неверный пароль' });
      return;
    }
    
    // Добавляем зрителя
    stream.viewers.add(socket.id);
    socket.join(`stream:${streamId}`);
    
    // Сохраняем информацию о зрителе
    socket.streamData = { streamId, role: 'viewer' };
    
    callback({ 
      success: true, 
      streamerSocketId: stream.streamerSocketId,
      viewerCount: stream.viewers.size
    });
    
    // Уведомляем стримера о новом зрителе
    io.to(stream.streamerSocketId).emit('streamer:viewer-joined', {
      viewerCount: stream.viewers.size
    });
    
    console.log(`Зритель подключился к ${streamId}, всего: ${stream.viewers.size}`);
  });

  // Зритель отключается
  socket.on('disconnect', () => {
    // Удаляем из списка зрителей в стриме
    for (const [streamId, stream] of streams.entries()) {
      if (stream.viewers.has(socket.id)) {
        stream.viewers.delete(socket.id);
        io.to(stream.streamerSocketId).emit('streamer:viewer-left', {
          viewerCount: stream.viewers.size
        });
        console.log(`Зритель отключился от ${streamId}, осталось: ${stream.viewers.size}`);
        break;
      }
      
      // Если отключился стример — удаляем стрим
      if (stream.streamerSocketId === socket.id) {
        streams.delete(streamId);
        io.to(`stream:${streamId}`).emit('streamer:disconnected');
        console.log(`Стрим ${streamId} завершён`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});