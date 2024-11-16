# Super Tic Tac Toe

A real-time multiplayer implementation of Ultimate Tic Tac Toe (also known as Super Tic Tac Toe) using Bun, Socket.IO, and TypeScript.

## Game Rules

Super Tic Tac Toe is played on a 3×3 grid of Tic Tac Toe boards. The goal is to win three boards in a row. The twist is that your opponent's move determines which board you must play in next.

### How to Play

1. The first player can place their mark (X) in any cell on any board.
2. Your move determines which board your opponent must play in next. For example, if you play in the top-right cell of any board, your opponent must play in the top-right board.
3. If a board is won or drawn, it counts as captured by the winning player (or marked as a draw).
4. When a player is sent to a board that's already been won or drawn, they can play in any available board instead.
5. The game is won by capturing three boards in a row (horizontally, vertically, or diagonally).

## Technical Stack

- **Backend:**
  - Bun
  - Express
  - Socket.IO
  - TypeScript

- **Frontend:**
  - HTML5
  - Tailwind CSS
  - Socket.IO Client

## Features

- Real-time multiplayer gameplay
- Room-based matches (create or join games)
- Visual feedback for valid moves
- Game state synchronization
- Automatic win detection
- Responsive design

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Paylicier/SuperTicTacToe/
cd SuperTicTacToe
```

2. Install dependencies:
```bash
bun install
```

3. Start the server:
```bash
bun server.ts
```

## API Events

### Server → Client

- `roomCreated`: Emitted when a new room is created
- `joined`: Sent when a player successfully joins a room
- `gameStart`: Emitted when both players have joined
- `moveMade`: Sent after a valid move
- `gameOver`: Emitted when a player wins or the game is drawn
- `playerLeft`: Sent when the opponent disconnects
- `error`: Emitted when an error occurs

### Client → Server

- `createRoom`: Request to create a new game room
- `joinRoom`: Request to join an existing room
- `move`: Send a move to the server

## License

This project is licensed under the MIT License - see the LICENSE file for details.
