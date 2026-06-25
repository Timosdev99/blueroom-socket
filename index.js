const { createServer } = require("http")
const { Server } = require("socket.io")

const allowedOrigins = (process.env.SOCKET_CORS_ORIGINS || "http://localhost:3000").split(",")
const httpServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" })
  res.end("ok")
})
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
})

const rooms = new Map()

io.on("connection", (socket) => {
  console.log(`user connected: ${socket.id}`)

  socket.on("room:join", ({ roomId, userId }) => {
    socket.join(roomId)
    if (!rooms.has(roomId)) rooms.set(roomId, new Set())
    rooms.get(roomId).add(userId)
    socket.to(roomId).emit("room:user-joined", { userId, onlineCount: rooms.get(roomId).size })
  })

  socket.on("room:leave", ({ roomId, userId }) => {
    socket.leave(roomId)
    rooms.get(roomId)?.delete(userId)
    const count = rooms.get(roomId)?.size ?? 0
    socket.to(roomId).emit("room:user-left", { userId, onlineCount: count })
  })

  socket.on("chat:message", ({ roomId, userId, name, message }) => {
    io.to(roomId).emit("chat:message", { userId, name, message, timestamp: new Date() })
  })

  socket.on("queue:add", ({ roomId, queueItem }) => {
    io.to(roomId).emit("queue:add", queueItem)
  })

  socket.on("queue:vote", ({ roomId, queueItemId, votes }) => {
    io.to(roomId).emit("queue:vote", { queueItemId, votes })
  })

  socket.on("queue:next", ({ roomId, queueItem }) => {
    io.to(roomId).emit("queue:next", queueItem)
  })

  socket.on("queue:skip", ({ roomId, queueItemId }) => {
    io.to(roomId).emit("queue:skip", { queueItemId })
  })

  socket.on("playback:state", ({ roomId, state }) => {
    socket.to(roomId).emit("playback:state", state)
  })

  socket.on("playback:sync-request", ({ roomId }) => {
    socket.to(roomId).emit("playback:sync-request", { from: socket.id })
  })

  socket.on("playback:sync-ready", ({ roomId, position }) => {
    io.to(roomId).emit("playback:sync", { position, timestamp: Date.now() })
  })

  socket.on("rating:update", ({ roomId, rating }) => {
    io.to(roomId).emit("rating:update", rating)
  })

  socket.on("streak:update", ({ roomId, streak }) => {
    io.to(roomId).emit("streak:update", streak)
  })

  socket.on("disconnect", () => {
    console.log(`user disconnected: ${socket.id}`)
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id)
        io.to(roomId).emit("room:user-left", { userId: socket.id, onlineCount: users.size })
      }
    })
  })
})

const PORT = parseInt(process.env.PORT || process.env.SOCKET_PORT, 10) || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket.io server running on port ${PORT}`)
})
