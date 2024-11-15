import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import fs from 'fs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

interface Player {
  socketId: string;
  playerId: number; // 1 or 2
  playerName?: string;
  roomId: string;
}

interface Room {
  id: string;
  board: number[][]; // Main board with all moves
  subBoards: number[]; // Status of each sub-board (0: ongoing, 1: X won, 2: O won, 3: draw)
  players: Player[];
  currentTurn: number;
  lastMoveTime: number;
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: number | null;
  nextValidSubBoard: number | null; // -1 for any valid board
}

class GameManager {
  private rooms: Map<string, Room> = new Map();
  private players: Map<string, Player> = new Map();

  createRoom(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // A-Z
    const roomId = crypto.randomBytes(3).toString('hex').toUpperCase().split('').map(c => characters[parseInt(c, 16) % characters.length]).join(''); // 6 random characters
    this.rooms.set(roomId, {
      id: roomId,
      board: Array(9).fill(null).map(() => Array(9).fill(0)),
      subBoards: Array(9).fill(0),
      players: [],
      currentTurn: 1,
      lastMoveTime: Date.now(),
      gameStatus: 'waiting',
      winner: null,
      nextValidSubBoard: -1
    });
    return roomId;
  }

  joinRoom(socket: Socket, roomId: string, playerName: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= 2) return false;

    if (playerName.length > 0 && playerName.length < 5 && /^[a-zA-Z0-9]*$/.test(playerName)) {
      playerName = playerName;
    } else {
        playerName = 'HCKR'; // You're a H4CK3R
    }

    const player: Player = {
      socketId: socket.id,
      playerId: room.players.length + 1,
      playerName,
      roomId
    };

    room.players.push(player);
    this.players.set(socket.id, player);

    if (room.players.length === 2) {
      room.gameStatus = 'playing';
    }

    return true;
  }

  private checkSubBoardWin = (board: number[][], subBoardIndex: number): number => {
    // Calculate the starting row and column for this sub-board
    const startRow = Math.floor(subBoardIndex / 3) * 3;
    const startCol = (subBoardIndex % 3) * 3;
    
    // Get all values in this sub-board into a 3x3 array for easier checking
    const subBoardValues = Array(3).fill(null).map((_, row) =>
      Array(3).fill(null).map((_, col) => 
        board[startRow + row][startCol + col]
      )
    );
  
    // Check rows
    for (let row = 0; row < 3; row++) {
      if (subBoardValues[row][0] !== 0 &&
          subBoardValues[row][0] === subBoardValues[row][1] &&
          subBoardValues[row][1] === subBoardValues[row][2]) {
        return subBoardValues[row][0];
      }
    }
  
    // Check columns
    for (let col = 0; col < 3; col++) {
      if (subBoardValues[0][col] !== 0 &&
          subBoardValues[0][col] === subBoardValues[1][col] &&
          subBoardValues[1][col] === subBoardValues[2][col]) {
        return subBoardValues[0][col];
      }
    }
  
    // Check diagonals
    if (subBoardValues[0][0] !== 0 &&
        subBoardValues[0][0] === subBoardValues[1][1] &&
        subBoardValues[1][1] === subBoardValues[2][2]) {
      return subBoardValues[0][0];
    }
  
    if (subBoardValues[0][2] !== 0 &&
        subBoardValues[0][2] === subBoardValues[1][1] &&
        subBoardValues[1][1] === subBoardValues[2][0]) {
      return subBoardValues[0][2];
    }
  
    // Check for draw
    const isDraw = subBoardValues.every(row => row.every(cell => cell !== 0));
    return isDraw ? 3 : 0;
  };

  private fillSubBoard = (room: Room, subBoardIndex: number, winner: number): void => {
    // Only fill empty cells
    const startRow = Math.floor(subBoardIndex / 3) * 3;
    const startCol = (subBoardIndex % 3) * 3;
  
    // Mark the sub-board as won first
    room.subBoards[subBoardIndex] = winner;
  
    // If it's a draw (3), leave the existing moves visible
    if (winner === 3) return;
  
    // For player wins, fill empty cells with winning player's number
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (room.board[startRow + i][startCol + j] === 0) {
          room.board[startRow + i][startCol + j] = winner;
        }
      }
    }
  };

  private checkMainBoardWin(subBoards: number[]): number {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (subBoards[a] !== 0 && subBoards[a] !== 3 &&
          subBoards[a] === subBoards[b] && subBoards[b] === subBoards[c]) {
        return subBoards[a];
      }
    }

    // Check for draw
    if (subBoards.every(val => val !== 0)) {
      return 3;
    }

    return 0;
  }

  makeMove = (socketId: string, cell: number, subcell: number): boolean => {
    const player = gameManager.getPlayer(socketId);
    if (!player) return false;
  
    const room = gameManager.getRoom(player.roomId);
    if (!room || room.gameStatus !== 'playing' || room.currentTurn !== player.playerId) return false;
  
    // Calculate the actual board position
    const boardRow = Math.floor(cell / 3) * 3 + Math.floor(subcell / 3);
    const boardCol = (cell % 3) * 3 + (subcell % 3);
  
    // Validate move
    if (cell < 0 || cell >= 9 || subcell < 0 || subcell >= 9 || 
        room.board[boardRow][boardCol] !== 0 || 
        room.subBoards[cell] !== 0) {
      return false;
    }
  
    // Validate if the move is in the correct sub-board
    if (room.nextValidSubBoard !== -1 && room.nextValidSubBoard !== cell) {
      return false;
    }
  
    // Make move
    room.board[boardRow][boardCol] = player.playerId;
  
    // Check if this move won the sub-board
    const subBoardWinner = this.checkSubBoardWin(room.board, cell);
    if (subBoardWinner > 0) {
      this.fillSubBoard(room, cell, subBoardWinner);
      
      // Check main board win after sub-board win
      const mainBoardWinner = this.checkMainBoardWin(room.subBoards);
      if (mainBoardWinner > 0 && mainBoardWinner !== 3) {
        room.gameStatus = 'finished';
        room.winner = mainBoardWinner;
      }
    }
  
    // Set next valid sub-board
    room.nextValidSubBoard = room.subBoards[subcell] === 0 ? subcell : -1;
  
    // Switch turns
    room.currentTurn = room.currentTurn === 1 ? 2 : 1;
    room.lastMoveTime = Date.now();
  
    return true;
  };

  removePlayer(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player) return;

    const room = this.rooms.get(player.roomId);
    if (room) {
      room.players = room.players.filter(p => p.socketId !== socketId);
      room.gameStatus = 'finished';
      if (room.players.length === 0) {
        this.rooms.delete(room.id);
      }
    }
    this.players.delete(socketId);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPlayer(socketId: string): Player | undefined {
    return this.players.get(socketId);
  }
}

const gameManager = new GameManager();

io.on('connection', (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('createRoom', () => {
    const roomId = gameManager.createRoom();
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }

    const success = gameManager.joinRoom(socket, roomId, playerName);
    if (!success) {
      socket.emit('error', { message: 'Unable to join room' });
      return;
    }

    socket.join(roomId);
    const room = gameManager.getRoom(roomId);
    const player = gameManager.getPlayer(socket.id);

    socket.emit('joined', {
      playerId: player?.playerId,
      gameState: room
    });

    if (room?.players.length === 2) {
      io.to(roomId).emit('gameStart', { 
        currentTurn: room.currentTurn,
        nextValidSubBoard: room.nextValidSubBoard 
      });
    }
  });

  socket.on('move', ({ cell, subcell }) => {
    if (!Number.isInteger(cell) || !Number.isInteger(subcell)) {
      socket.emit('error', { message: 'Invalid move' });
      return;
    }

    const success = gameManager.makeMove(socket.id, cell, subcell);
    if (!success) {
      socket.emit('error', { message: 'Invalid move' });
      return;
    }

    const player = gameManager.getPlayer(socket.id);
    if (!player) return;

    const room = gameManager.getRoom(player.roomId);
    if (!room) return;

    io.to(room.id).emit('moveMade', {
      cell,
      subcell,
      playerId: player.playerId,
      currentTurn: room.currentTurn,
      board: room.board,
      subBoards: room.subBoards,
      nextValidSubBoard: room.nextValidSubBoard
    });

    if (room.gameStatus === 'finished') {
      io.to(room.id).emit('gameOver', { 
        winner: room.winner,
        board: room.board,
        subBoards: room.subBoards
      });

      const winnerName = room.players.find(p => p.playerId === room.winner)?.playerName;
        if (winnerName) {
            console.log(`Winner: ${winnerName}`);
            let data = fs.readFileSync('leaderboard.json', 'utf8');
            let leaderboard = JSON.parse(data || '[]');
            let player = leaderboard.find((p: any) => p.name === winnerName);
            if (player) {
                player.score++;
            } else {
                leaderboard.push({ name: winnerName, score: 1 });
            }
            data = JSON.stringify(leaderboard);

            fs.writeFile('leaderboard.json', data, (err: any) => {
                if (err) throw err;
                console.log('Data written to file');
            });
        }
    }
  });

  socket.on('disconnect', () => {
    gameManager.removePlayer(socket.id);
    const player = gameManager.getPlayer(socket.id);
    if (player) {
      io.to(player.roomId).emit('playerLeft', { playerId: player.playerId });
    }
  });
});


app.use(express.json({ limit: '10kb' }));
app.use(express.static('public', {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
}));

app.get('/leaderboard', (req, res) => {

    const data = fs.readFileSync('leaderboard.json', 'utf8');
    const leaderboard = JSON.parse(data || '[]');

    leaderboard.sort((a: any, b: any) => b.score - a.score);

    res.json(leaderboard);
});

httpServer.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});