
// Update the leaderboard creation function
function createLeaderboardItem(player, index) {
  const item = document.createElement('div');
  item.className = 'flex items-center justify-between p-3 hover:bg-gray-700 transition-all duration-200 rounded-lg mb-2';
  
  // Get the appropriate medal emoji based on rank
  const getRankEmoji = (index) => {
    switch(index) {
      case 0: return '🏆';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '👑';
    }
  };

  // Create the rank number element
  const rankElement = document.createElement('span');
  rankElement.className = 'text-gray-400 font-mono w-8';
  rankElement.textContent = `${index + 1}.`;

  // Create the player info container
  const playerInfo = document.createElement('div');
  playerInfo.className = 'flex items-center space-x-2 flex-grow px-3';
  
  // Create the medal element
  const medalElement = document.createElement('span');
  medalElement.className = 'text-xl';
  medalElement.textContent = getRankEmoji(index);

  // Create the name element
  const nameElement = document.createElement('span');
  nameElement.className = 'text-white font-semibold';
  nameElement.textContent = player.name;

  // Create the score element
  const scoreElement = document.createElement('span');
  scoreElement.className = 'text-gray-300 font-bold';
  scoreElement.textContent = player.score;

  // Assemble the elements
  playerInfo.appendChild(medalElement);
  playerInfo.appendChild(nameElement);
  item.appendChild(rankElement);
  item.appendChild(playerInfo);
  item.appendChild(scoreElement);

  // Add hover animation
  item.addEventListener('mouseenter', () => {
    item.style.transform = 'translateX(10px)';
  });
  
  item.addEventListener('mouseleave', () => {
    item.style.transform = 'translateX(0)';
  });

  return item;
}

function updateLeaderboard(players) {
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '';
  
  // Add container styling
  leaderboardList.className = 'w-full max-w-md space-y-1 p-3';
  
  // Update the header styling
  const header = document.querySelector('#leaderboard h2');
  if (header) {
    header.className = 'text-2xl font-bold text-white mb-4 text-center';
  }
  
  // Add container styling
  const leaderboardContainer = document.getElementById('leaderboard');
  if (leaderboardContainer) {
    leaderboardContainer.className = 'rounded-lg shadow-lg overflow-hidden w-full max-w-md p-4';
  }

  // Sort players by score in descending order
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  // Create and append player items
  sortedPlayers.forEach((player, index) => {
    if (index < 5) { // Limit to top 5
      const item = createLeaderboardItem(player, index);
      leaderboardList.appendChild(item);
    }
  });

  if(!sortedPlayers.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'text-gray-400 text-center';
    emptyMessage.textContent = 'No players on the leaderboard';
    leaderboardList.appendChild(emptyMessage);
  }
}

// Update your HTML structure
document.addEventListener('DOMContentLoaded', () => {
  const leaderboard = document.getElementById('leaderboard');
  if (leaderboard) {
    leaderboard.innerHTML = `
      <h2 class="text-2xl font-bold text-white mb-4 text-center">Leaderboard</h2>
      <div id="leaderboard-list" class="w-full max-w-md space-y-1 p-3"></div>
    `;
  }
});

// Get the leaderboard data from the server (GET /leaderboard)
async function fetchLeaderboard() {
  const response = await fetch('/leaderboard');
  const players = await response.json();
  updateLeaderboard(players);
}

fetchLeaderboard();

class GameClient {
  constructor() {
    this.socket = null;
    this.board = document.getElementById('board');
    this.playerId = null;
    this.currentTurn = null;
    this.gameStatus = 'waiting';
    this.nextValidSubBoard = -1;
    this.subBoards = Array(9).fill(0);
    this.colors = {
      player1: 'bg-blue-500',  // X
      player2: 'bg-red-500',   // O
      draw: 'bg-gray-400',
      hover: 'bg-gray-400',
      empty: 'bg-gray-500',
      validNext: 'bg-green-200',
      subBoardWon: 'opacity-80'
    };
    this.initialize();
  }

  initialize() {
    this.initializeSocket();
  }

  setupGameInfo() {
    const gameInfo = document.createElement('div');
    gameInfo.className = 'fixed top-4 left-4 p-4 bg-white rounded-lg shadow-lg';
    gameInfo.innerHTML = `
      <div id="playerInfo" class="mb-2">Waiting for opponent...</div>
      <div id="turnInfo" class="mb-2"></div>
      <div id="nextMoveInfo"></div>
    `;
    document.body.appendChild(gameInfo);
  }

  updateGameInfo() {
    const playerInfo = document.getElementById('playerInfo');
    const turnInfo = document.getElementById('turnInfo');
    const nextMoveInfo = document.getElementById('nextMoveInfo');

    if (this.gameStatus === 'waiting') {
      playerInfo.textContent = 'Waiting for opponent...';
      turnInfo.textContent = '';
      nextMoveInfo.textContent = '';
    } else if (this.gameStatus === 'playing') {
      playerInfo.textContent = `You are Player ${this.playerId} (${this.playerId === 1 ? 'X' : 'O'})`;
      turnInfo.textContent = `Current Turn: Player ${this.currentTurn} (${this.currentTurn === 1 ? 'X' : 'O'})`;
      if (this.nextValidSubBoard === -1) {
        nextMoveInfo.textContent = 'You can play in any valid sub-board';
      } else {
        nextMoveInfo.textContent = `Next move must be in sub-board ${this.nextValidSubBoard + 1}`;
      }
    } else if (this.gameStatus === 'finished') {
      turnInfo.textContent = 'Game Over';
    }
  }

  initializeSocket() {
    this.socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('error', ({ message }) => {
      this.showNotification(message, 'error');
    });

    this.socket.on('joined', ({ playerId, gameState }) => {
      this.initializeBoard();
      this.setupGameInfo();
      document.getElementById('menu').style.display = 'none';
      this.playerId = playerId;
      this.subBoards = gameState.subBoards;
      this.nextValidSubBoard = gameState.nextValidSubBoard;
      this.updateGameState(gameState);
      this.showNotification(`You joined as Player ${playerId}`, 'success');
      this.updateGameInfo();
    });

    this.socket.on('gameStart', ({ currentTurn, nextValidSubBoard }) => {
      document.getElementById('status').textContent = ``;
      this.currentTurn = currentTurn;
      this.nextValidSubBoard = nextValidSubBoard;
      this.gameStatus = 'playing';
      this.updateValidMoves();
      this.updateGameInfo();
      this.showNotification('Game started!', 'success');
    });

    this.socket.on('moveMade', ({ cell, subcell, playerId, currentTurn, board, subBoards, nextValidSubBoard }) => {
      this.updateCell(cell, subcell, playerId);
      this.currentTurn = currentTurn;
      this.subBoards = subBoards;
      this.nextValidSubBoard = nextValidSubBoard;
      if(this.currentTurn === this.playerId) {
        this.showNotification('Your turn!', 'success');
      }
      this.updateSubBoards();
      this.updateValidMoves();
      this.updateGameInfo();
    });

    this.socket.on('gameOver', ({ winner, board, subBoards }) => {
      this.gameStatus = 'finished';
      this.subBoards = subBoards;
      this.updateSubBoards();
      const winnerText = winner === 3 ? "It's a draw!" : `Player ${winner} (${winner === 1 ? 'X' : 'O'}) wins!`;
      this.showNotification(winnerText, 'success');
      document.getElementById('status').textContent = `Reload to play again`;
      this.updateGameInfo();
      if(winner === this.playerId) {
        launchConfetti();
      }
    });

    this.socket.on('playerLeft', () => {
      this.gameStatus = 'finished';
      this.showNotification('Other player left the game', 'error');
      this.updateGameInfo();
    });

    this.socket.on('disconnect', () => {
      this.showNotification('Disconnected from server', 'error');
      this.updateGameInfo();
    });

    this.socket.on('roomCreated', ({ roomId }) => {
      this.joinRoom(roomId);
      document.getElementById('status').textContent = `Room ID: ${roomId}`;
    });
  }

  initializeBoard() {
    this.board.innerHTML = '';
    this.board.className = 'grid grid-cols-3 gap-4 p-4 bg-gray-800 rounded-xl max-w-[800px] mx-auto';
    
    for (let i = 0; i < 9; i++) {
      const subBoard = this.createSubBoard(i);
      this.board.appendChild(subBoard);
    }
  }

  createSubBoard(index) {
    const subBoard = document.createElement('div');
    subBoard.className = 'grid grid-cols-3 gap-1 bg-gray-600 rounded-md p-1';
    subBoard.dataset.index = index;

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = `w-16 h-16 ${this.colors.empty} rounded text-white text-center flex items-center justify-center text-2xl font-bold cursor-pointer hover:${this.colors.hover} transition-colors`;
      cell.dataset.index = i;
      cell.addEventListener('click', (e) => this.handleCellClick(e, index, i));
      subBoard.appendChild(cell);
    }

    return subBoard;
  }

  updateValidMoves() {
    // Reset all sub-boards
    const allSubBoards = this.board.children;
    for (let i = 0; i < allSubBoards.length; i++) {
      const subBoard = allSubBoards[i];
      subBoard.classList.remove('ring-4', 'ring-green-400');
      
      // Reset cell hover states
      Array.from(subBoard.children).forEach(cell => {
        if (!cell.classList.contains(this.colors.player1) && 
            !cell.classList.contains(this.colors.player2)) {
          cell.classList.remove('cursor-not-allowed');
          cell.classList.add('cursor-pointer');
        }
      });
    }

    if (this.gameStatus !== 'playing') return;

    // Highlight valid next sub-board(s)
    if (this.nextValidSubBoard === -1) {
      // All un-won sub-boards are valid
      for (let i = 0; i < this.subBoards.length; i++) {
        if (this.subBoards[i] === 0) {
          allSubBoards[i].classList.add('ring-4', 'ring-green-400');
        }
      }
    } else {
      // Only one sub-board is valid
      if (this.subBoards[this.nextValidSubBoard] === 0) {
        allSubBoards[this.nextValidSubBoard].classList.add('ring-4', 'ring-green-400');
      }
    }
  }

  updateSubBoards() {
    this.subBoards.forEach((winner, index) => {
      if (winner !== 0) {
        const subBoard = this.board.children[index];
        const cells = subBoard.children;
        
        // Apply winner style to all cells
        Array.from(cells).forEach(cell => {
          if (winner === 1) {
            cell.textContent = 'X';
            cell.className = `w-16 h-16 ${this.colors.player1} ${this.colors.subBoardWon} rounded text-white text-center flex items-center justify-center text-2xl font-bold cursor-not-allowed`;
          } else if (winner === 2) {
            cell.textContent = 'O';
            cell.className = `w-16 h-16 ${this.colors.player2} ${this.colors.subBoardWon} rounded text-white text-center flex items-center justify-center text-2xl font-bold cursor-not-allowed`;
          } else if (winner === 3) {
            cell.className = `w-16 h-16 ${this.colors.draw} rounded text-white text-center flex items-center justify-center text-2xl font-bold cursor-not-allowed`;
          }
        });
      }
    });
  }

  handleCellClick(event, cell, subcell) {
    if (this.gameStatus !== 'playing' || this.currentTurn !== this.playerId) {
      return;
    }

    // Check if move is valid based on nextValidSubBoard
    if (this.nextValidSubBoard !== -1 && this.nextValidSubBoard !== cell) {
      this.showNotification('Invalid move - wrong sub-board', 'error');
      return;
    }

    this.socket.emit('move', { cell, subcell });
  }

  updateCell(cell, subcell, playerId) {
    const subBoard = this.board.children[cell];
    if (!subBoard) return;

    const cellElement = subBoard.children[subcell];
    if (!cellElement) return;

    cellElement.textContent = playerId === 1 ? 'X' : 'O';
    cellElement.className = `w-16 h-16 rounded text-white text-center flex items-center justify-center text-2xl font-bold cursor-not-allowed ${
      playerId === 1 ? this.colors.player1 : this.colors.player2
    }`;
  }

  updateGameState(gameState) {
    if (!gameState) return;

    if (gameState.board) {
      gameState.board.forEach((subBoard, cellIndex) => {
        subBoard.forEach((value, subcellIndex) => {
          if (value !== 0) {
            this.updateCell(cellIndex, subcellIndex, value);
          }
        });
      });
    }

    this.updateSubBoards();
    this.updateValidMoves();
  }

  joinRoom(roomId) {
    const playerName = document.getElementById('username')?.value || generateUsername();
    this.socket.emit('joinRoom', { roomId, playerName });
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white ${
      type === 'error' ? 'bg-red-500' : 'bg-green-500'
    } shadow-lg z-50`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
}

let gameClient = null;

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  gameClient = new GameClient();

  console.log('\n  _________                        ___________.__     ___________           ___________            \r\n \/   _____\/__ ________   __________\\__    ___\/|__| ___\\__    ___\/____    ___\\__    ___\/___   ____  \r\n \\_____  \\|  |  \\____ \\_\/ __ \\_  __ \\|    |   |  |\/ ___\\|    |  \\__  \\ _\/ ___\\|    | \/  _ \\_\/ __ \\ \r\n \/        \\  |  \/  |_> >  ___\/|  | \\\/|    |   |  \\  \\___|    |   \/ __ \\\\  \\___|    |(  <_> )  ___\/ \r\n\/_______  \/____\/|   __\/ \\___  >__|   |____|   |__|\\___  >____|  (____  \/\\___  >____| \\____\/ \\___  >\r\n        \\\/      |__|        \\\/                        \\\/             \\\/     \\\/                  \\\/ \n\n')
});


document.getElementById('room').addEventListener('input', function() {
  if (this.value) {
    document.getElementById('start').textContent = 'Join Room';
  } else {
    document.getElementById('start').textContent = 'Create Room';
  }
});

document.getElementById('start').addEventListener('click', function() {
  const roomId = document.getElementById('room').value;
  if (roomId) {
    gameClient.joinRoom(roomId);
  } else {
    gameClient.socket.emit('createRoom');
  }
});

function generateUsername() {
  // Random username generator when user doens't provide one.
  // It's ✨ Special ✨
  const first = ["Ko", "Mi", "Sa", "Ka", "Yu", "To", "Na", "Ha", "Ci", "Ma"]
  const second = ["Ri", "Ki", "No", "Ta", "Yo", "Si", "Mo", "Ru", "Ne", "Ke"]

  const randomFirst = first[Math.floor(Math.random() * first.length)];
  const randomSecond = second[Math.floor(Math.random() * second.length)];

  return randomFirst + randomSecond;
}

  // https://codepen.io/bananascript/pen/EyZeWm

  // Globals
  var random = Math.random
    , cos = Math.cos
    , sin = Math.sin
    , PI = Math.PI
    , PI2 = PI * 2
    , timer = undefined
    , frame = undefined
    , confetti = [];

  var particles = 10
    , spread = 40
    , sizeMin = 3
    , sizeMax = 12 - sizeMin
    , eccentricity = 10
    , deviation = 100
    , dxThetaMin = -.1
    , dxThetaMax = -dxThetaMin - dxThetaMin
    , dyMin = .13
    , dyMax = .18
    , dThetaMin = .4
    , dThetaMax = .7 - dThetaMin;

  var colorThemes = [
    function() {
      return color(200 * random()|0, 200 * random()|0, 200 * random()|0);
    }, function() {
      var black = 200 * random()|0; return color(200, black, black);
    }, function() {
      var black = 200 * random()|0; return color(black, 200, black);
    }, function() {
      var black = 200 * random()|0; return color(black, black, 200);
    }, function() {
      return color(200, 100, 200 * random()|0);
    }, function() {
      return color(200 * random()|0, 200, 200);
    }, function() {
      var black = 256 * random()|0; return color(black, black, black);
    }, function() {
      return colorThemes[random() < .5 ? 1 : 2]();
    }, function() {
      return colorThemes[random() < .5 ? 3 : 5]();
    }, function() {
      return colorThemes[random() < .5 ? 2 : 4]();
    }
  ];
  function color(r, g, b) {
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Cosine interpolation
  function interpolation(a, b, t) {
    return (1-cos(PI*t))/2 * (b-a) + a;
  }

  // Create a 1D Maximal Poisson Disc over [0, 1]
  var radius = 1/eccentricity, radius2 = radius+radius;
  function createPoisson() {
    // domain is the set of points which are still available to pick from
    // D = union{ [d_i, d_i+1] | i is even }
    var domain = [radius, 1-radius], measure = 1-radius2, spline = [0, 1];
    while (measure) {
      var dart = measure * random(), i, l, interval, a, b, c, d;

      // Find where dart lies
      for (i = 0, l = domain.length, measure = 0; i < l; i += 2) {
        a = domain[i], b = domain[i+1], interval = b-a;
        if (dart < measure+interval) {
          spline.push(dart += a-measure);
          break;
        }
        measure += interval;
      }
      c = dart-radius, d = dart+radius;

      // Update the domain
      for (i = domain.length-1; i > 0; i -= 2) {
        l = i-1, a = domain[l], b = domain[i];
        // c---d          c---d  Do nothing
        //   c-----d  c-----d    Move interior
        //   c--------------d    Delete interval
        //         c--d          Split interval
        //       a------b
        if (a >= c && a < d)
          if (b > d) domain[l] = d; // Move interior (Left case)
          else domain.splice(l, 2); // Delete interval
        else if (a < c && b > c)
          if (b <= d) domain[i] = c; // Move interior (Right case)
          else domain.splice(i, 0, c, d); // Split interval
      }

      // Re-measure the domain
      for (i = 0, l = domain.length, measure = 0; i < l; i += 2)
        measure += domain[i+1]-domain[i];
    }

    return spline.sort();
  }

  // Create the overarching container
  var container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top      = '0';
  container.style.left     = '0';
  container.style.width    = '100%';
  container.style.height   = '0';
  container.style.overflow = 'visible';
  container.style.zIndex   = '9999';

  // Confetto constructor
  function Confetto(theme) {
    this.frame = 0;
    this.outer = document.createElement('div');
    this.inner = document.createElement('div');
    this.outer.appendChild(this.inner);

    var outerStyle = this.outer.style, innerStyle = this.inner.style;
    outerStyle.position = 'absolute';
    outerStyle.width  = (sizeMin + sizeMax * random()) + 'px';
    outerStyle.height = (sizeMin + sizeMax * random()) + 'px';
    innerStyle.width  = '100%';
    innerStyle.height = '100%';
    innerStyle.backgroundColor = theme();

    outerStyle.perspective = '50px';
    outerStyle.transform = 'rotate(' + (360 * random()) + 'deg)';
    this.axis = 'rotate3D(' +
      cos(360 * random()) + ',' +
      cos(360 * random()) + ',0,';
    this.theta = 360 * random();
    this.dTheta = dThetaMin + dThetaMax * random();
    innerStyle.transform = this.axis + this.theta + 'deg)';

    this.x = window.innerWidth * random();
    this.y = -deviation;
    this.dx = sin(dxThetaMin + dxThetaMax * random());
    this.dy = dyMin + dyMax * random();
    outerStyle.left = this.x + 'px';
    outerStyle.top  = this.y + 'px';

    // Create the periodic spline
    this.splineX = createPoisson();
    this.splineY = [];
    for (var i = 1, l = this.splineX.length-1; i < l; ++i)
      this.splineY[i] = deviation * random();
    this.splineY[0] = this.splineY[l] = deviation * random();

    this.update = function(height, delta) {
      this.frame += delta;
      this.x += this.dx * delta;
      this.y += this.dy * delta;
      this.theta += this.dTheta * delta;

      // Compute spline and convert to polar
      var phi = this.frame % 7777 / 7777, i = 0, j = 1;
      while (phi >= this.splineX[j]) i = j++;
      var rho = interpolation(
        this.splineY[i],
        this.splineY[j],
        (phi-this.splineX[i]) / (this.splineX[j]-this.splineX[i])
      );
      phi *= PI2;

      outerStyle.left = this.x + rho * cos(phi) + 'px';
      outerStyle.top  = this.y + rho * sin(phi) + 'px';
      innerStyle.transform = this.axis + this.theta + 'deg)';
      return this.y > height+deviation;
    };
  }

  function launchConfetti() {
    if (!frame) {
      // Append the container
      document.body.appendChild(container);

      // Add confetti
      var theme = colorThemes[0]
        , count = 0;
      (function addConfetto() {
        var confetto = new Confetto(theme);
        confetti.push(confetto);
        container.appendChild(confetto.outer);
        timer = setTimeout(addConfetto, spread * random());
      })(0);

      // Start the loop
      var prev = undefined;
      requestAnimationFrame(function loop(timestamp) {
        var delta = prev ? timestamp - prev : 0;
        prev = timestamp;
        var height = window.innerHeight;

        for (var i = confetti.length-1; i >= 0; --i) {
          if (confetti[i].update(height, delta)) {
            container.removeChild(confetti[i].outer);
            confetti.splice(i, 1);
          }
        }

        if (timer || confetti.length)
          return frame = requestAnimationFrame(loop);

        // Cleanup
        document.body.removeChild(container);
        frame = undefined;
      });
    }
  }