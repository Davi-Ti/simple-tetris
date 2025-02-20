const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

// Configuração do jogo
const BLOCK_SIZE = 30;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const HIDDEN_ROWS = 2; // Linhas ocultas para spawn
const TOTAL_ROWS = BOARD_HEIGHT + HIDDEN_ROWS;

// Ajusta o tamanho do canvas
canvas.width = BLOCK_SIZE * BOARD_WIDTH;
canvas.height = BLOCK_SIZE * BOARD_HEIGHT; // desenha apenas as linhas visíveis

// Tempo que a peça pode ficar encostada antes de travar
let lockDelay = 0;
const LOCK_DELAY_TIME = 200; // em ms

let score = 0;
let level = 1;
let highScore = localStorage.getItem("tetrisHighScore") || 0;
document.getElementById("highscore").textContent = highScore;

// Tetrominos e cores
const PIECES = [
  [[1, 1, 1, 1]], // I
  [
    [1, 1, 1],
    [0, 1, 0],
  ], // T
  [
    [1, 1, 1],
    [1, 0, 0],
  ], // L
  [
    [1, 1, 1],
    [0, 0, 1],
  ], // J
  [
    [1, 1],
    [1, 1],
  ], // O
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // S
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // Z
];

const COLORS = [
  "#00f0f0",
  "#f0a000",
  "#0000f0",
  "#f0f000",
  "#a0a0a0",
  "#00f000",
  "#f00000",
];

// Cria o tabuleiro (incluindo linhas "ocultas")
let board = Array.from({ length: TOTAL_ROWS }, () => Array(BOARD_WIDTH).fill(0));

let piece = null;
let nextPiece = null;
let dropCounter = 0;
let dropInterval = 1000; // intervalo inicial (ms)
let lastTime = 0;
let paused = false;

class Piece {
  constructor(shape, color) {
    this.shape = shape;
    this.color = color;
    // Centraliza horizontalmente e spawn na zona oculta
    this.x = Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2);
    this.y = -HIDDEN_ROWS;
  }
}

function createPiece() {
  const index = Math.floor(Math.random() * PIECES.length);
  return new Piece(PIECES[index], COLORS[index]);
}

// Verifica colisão com o tabuleiro
function collision(piece, testX, testY) {
  return piece.shape.some((row, y) => {
    return row.some((value, x) => {
      if (!value) return false;
      const boardX = testX + x;
      const boardY = testY + y + HIDDEN_ROWS; // converte pra índice real
      return (
        boardX < 0 ||
        boardX >= BOARD_WIDTH ||
        boardY >= TOTAL_ROWS ||
        (boardY >= 0 && board[boardY][boardX])
      );
    });
  });
}

function drawBoard() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Desenha apenas as linhas visíveis (de HIDDEN_ROWS até TOTAL_ROWS-1)
  for (let y = HIDDEN_ROWS; y < TOTAL_ROWS; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (board[y][x]) {
        ctx.fillStyle = board[y][x];
        ctx.fillRect(
          x * BLOCK_SIZE,
          (y - HIDDEN_ROWS) * BLOCK_SIZE,
          BLOCK_SIZE - 1,
          BLOCK_SIZE - 1
        );
      }
    }
  }
}

function drawPiece() {
  ctx.fillStyle = piece.color;
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const drawY = piece.y + y + HIDDEN_ROWS;
        // Só desenha se estiver na área visível
        if (drawY >= HIDDEN_ROWS && drawY < TOTAL_ROWS) {
          ctx.fillRect(
            (piece.x + x) * BLOCK_SIZE,
            (drawY - HIDDEN_ROWS) * BLOCK_SIZE,
            BLOCK_SIZE - 1,
            BLOCK_SIZE - 1
          );
        }
      }
    });
  });
}

function drawGhostPiece() {
  // Calcula posição "fantasma" da peça
  let ghostY = piece.y;
  while (!collision(piece, piece.x, ghostY + 1)) {
    ghostY++;
  }

  ctx.fillStyle = hexToRgba(piece.color, 0.3);
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const drawY = ghostY + y + HIDDEN_ROWS;
        // Desenha fantasma só na área visível
        if (drawY >= HIDDEN_ROWS && drawY < TOTAL_ROWS) {
          ctx.fillRect(
            (piece.x + x) * BLOCK_SIZE,
            (drawY - HIDDEN_ROWS) * BLOCK_SIZE,
            BLOCK_SIZE - 1,
            BLOCK_SIZE - 1
          );
        }
      }
    });
  });
}

// Converte cor hex para RGBA (para desenhar o fantasma com transparência)
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Desenha a próxima peça no canvas "next"
function drawNextPiece() {
  nextCtx.fillStyle = "#000";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = nextPiece.color;

  const scale = 0.6;
  const size = BLOCK_SIZE * scale;
  const offset = (nextCanvas.width - nextPiece.shape[0].length * size) / 2;

  nextPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        nextCtx.fillRect(offset + x * size, y * size, size - 1, size - 1);
      }
    });
  });
}

// Quando a peça "trava", mescla no board
function merge() {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardX = piece.x + x;
        const boardY = piece.y + y + HIDDEN_ROWS;
        board[boardY][boardX] = piece.color;
      }
    });
  });
}

// Rotação simples + "wall kicks" básicos
function rotate() {
  const rotated = piece.shape[0].map((_, i) =>
    piece.shape.map((row) => row[i]).reverse()
  );
  const oldX = piece.x;
  const oldShape = piece.shape;

  // Tenta aplicar alguns deslocamentos para não colidir na parede
  const offsets = [0, -1, 1, -2, 2];
  let kickSuccess = false;
  for (let offset of offsets) {
    if (!collision({ shape: rotated, color: piece.color }, piece.x + offset, piece.y)) {
      piece.x += offset;
      piece.shape = rotated;
      lockDelay = 0; // zera o lockDelay quando a peça é rotacionada com sucesso
      kickSuccess = true;
      break;
    }
  }
  // Se nenhum deslocamento funcionou, restaura a forma original
  if (!kickSuccess) {
    piece.shape = oldShape;
    piece.x = oldX;
  }
}

// Remove linhas completas no tabuleiro
function clearLines() {
  let linesCleared = 0;
  // Verifica todas as linhas do board, incluindo as ocultas
  for (let y = TOTAL_ROWS - 1; y >= 0; y--) {
    // Se todos os cells estiverem preenchidos (não for 0), remove a linha
    if (board[y].every(cell => cell)) {
      board.splice(y, 1);
      board.unshift(Array(BOARD_WIDTH).fill(0));
      linesCleared++;
      // Reavalia o mesmo índice pois o splice "puxa" as linhas de cima
      y++;
    }
  }

  if (linesCleared > 0) {
    score += linesCleared * 100 * level;
    document.getElementById("score").textContent = score;

    // Atualiza highscore se necessário
    if (score > highScore) {
      highScore = score;
      document.getElementById("highscore").textContent = highScore;
      localStorage.setItem("tetrisHighScore", highScore);
    }

    // Ajusta level e velocidade
    level = Math.floor(score / 1000) + 1;
    document.getElementById("level").textContent = level;
    dropInterval = Math.max(100, 1000 - level * 50);
  }
}

function gameOver() {
  paused = true;
  console.log("Game Over");
  showOverlay("Game Over");
}

function resetGame() {
  board = Array.from({ length: TOTAL_ROWS }, () => Array(BOARD_WIDTH).fill(0));
  score = 0;
  level = 1;
  document.getElementById("score").textContent = score;
  document.getElementById("level").textContent = level;
  dropInterval = 1000;
  piece = createPiece();
  nextPiece = createPiece();
  drawNextPiece();
  paused = false;
  hideOverlay();
}

function update(time = 0) {
  if (paused) {
    requestAnimationFrame(update);
    return;
  }
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  // Se a próxima posição (y+1) colidir, inicia contagem do lockDelay
  if (collision(piece, piece.x, piece.y + 1)) {
    lockDelay += deltaTime;
    // Se passar do tempo de lockDelay, fixa a peça
    if (lockDelay >= LOCK_DELAY_TIME) {
      merge();
      clearLines();

      // Puxa a próxima peça
      piece = nextPiece;
      nextPiece = createPiece();
      drawNextPiece();
      lockDelay = 0;

      // Se a nova peça nascer colidindo, game over
      if (collision(piece, piece.x, piece.y)) {
        gameOver();
      }
    }
  } else {
    // Se não está colidindo, zera lockDelay
    lockDelay = 0;
    // Faz a peça cair a cada "dropInterval"
    if (dropCounter > dropInterval) {
      piece.y++;
      dropCounter = 0;
    }
  }

  drawBoard();
  drawGhostPiece();
  drawPiece();
  requestAnimationFrame(update);
}

// Controles de teclado
document.addEventListener("keydown", (event) => {
  // Se estiver pausado, só aceita 'P' para retomar
  if (paused && event.key.toLowerCase() !== "p") return;

  switch (event.keyCode) {
    case 37: // Seta esquerda
      piece.x--;
      if (collision(piece, piece.x, piece.y)) {
        piece.x++;
      } else if (collision(piece, piece.x, piece.y + 1)) {
        // Se colidir ao descer, zera lockDelay
        lockDelay = 0;
      }
      break;

    case 39: // Seta direita
      piece.x++;
      if (collision(piece, piece.x, piece.y)) {
        piece.x--;
      } else if (collision(piece, piece.x, piece.y + 1)) {
        lockDelay = 0;
      }
      break;

    case 40: // Seta para baixo (soft drop)
      piece.y++;
      if (collision(piece, piece.x, piece.y)) {
        piece.y--;
      } else if (collision(piece, piece.x, piece.y + 1)) {
        lockDelay = 0;
      }
      dropCounter = 0;
      break;

    case 38: // Seta para cima (rotaciona)
      rotate();
      break;

    case 32: // Espaço (hard drop)
      while (!collision(piece, piece.x, piece.y + 1)) {
        piece.y++;
      }
      // Força o dropCounter para travar imediatamente
      dropCounter = dropInterval;
      break;

    case 80: // Tecla 'P' (pause)
      togglePause();
      break;
  }
});

// Função auxiliar para "segurar" o toque no mobile
function addHoldListener(element, callback, delay = 100) {
  let intervalId = null;
  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    callback();
    intervalId = setInterval(callback, delay);
  });
  element.addEventListener("touchend", () => {
    clearInterval(intervalId);
  });
  element.addEventListener("touchcancel", () => {
    clearInterval(intervalId);
  });
}

// Controles Mobile
const btnLeft = document.getElementById("mobile-left");
addHoldListener(btnLeft, () => {
  piece.x--;
  if (collision(piece, piece.x, piece.y)) piece.x++;
});

const btnRight = document.getElementById("mobile-right");
addHoldListener(btnRight, () => {
  piece.x++;
  if (collision(piece, piece.x, piece.y)) piece.x--;
});

const btnDown = document.getElementById("mobile-down");
addHoldListener(btnDown, () => {
  piece.y++;
  if (collision(piece, piece.x, piece.y)) piece.y--;
  dropCounter = 0;
});

document.getElementById("mobile-rotate").addEventListener("touchstart", (e) => {
  e.preventDefault();
  rotate();
});

document.getElementById("mobile-hard-drop").addEventListener("touchstart", (e) => {
  e.preventDefault();
  while (!collision(piece, piece.x, piece.y + 1)) {
    piece.y++;
  }
  dropCounter = dropInterval;
});

// Overlay de Pausa / Game Over
const overlay = document.getElementById("overlay");
const restartBtn = document.getElementById("restart-btn");
const pauseBtn = document.getElementById("pause-btn");

function showOverlay(message) {
  overlay.classList.remove("hidden");
  document.getElementById("overlay-message").textContent = message;
  if (message === "Game Over") {
    pauseBtn.classList.add("hidden");
  } else {
    pauseBtn.classList.remove("hidden");
  }
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function togglePause() {
  paused = !paused;
  if (paused) {
    showOverlay("Paused");
  } else {
    hideOverlay();
    lastTime = performance.now(); // reseta o "tempo" para evitar salto
  }
}

restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);

// Inicializa o jogo
piece = createPiece();
nextPiece = createPiece();
drawNextPiece();
lastTime = performance.now();
update();
