"use strict";

/* ================================
   CONFIGURAÇÃO & ELEMENTOS DO DOM
   ================================ */
const BLOCK_SIZE = 30;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

boardCanvas.width = BLOCK_SIZE * BOARD_WIDTH;
boardCanvas.height = BLOCK_SIZE * BOARD_HEIGHT;

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const highScoreEl = document.getElementById("highscore");

const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const restartBtn = document.getElementById("restart-btn");
const pauseBtn = document.getElementById("pause-btn");

// Botões mobile
const btnLeft = document.getElementById("mobile-left");
const btnRight = document.getElementById("mobile-right");
const btnDown = document.getElementById("mobile-down");
const btnRotate = document.getElementById("mobile-rotate");
const btnHardDrop = document.getElementById("mobile-hard-drop");

/* ================================
         VARIÁVEIS GLOBAIS
   ================================ */
let board = [];
let score = 0;
let level = 1;
let highScore = localStorage.getItem("tetrisHighScore") || 0;
highScoreEl.textContent = highScore;

let dropInterval = 1000;
let dropCounter = 0;
let lastTime = 0;
let paused = false;

// Definição dos Tetrominos e suas cores
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

/* ================================
          CLASSE PEÇA
   ================================ */
class Piece {
  constructor(shape, color) {
    this.shape = shape;
    this.color = color;
    // Inicia centralizada no topo
    this.x = Math.floor(BOARD_WIDTH / 2 - shape[0].length / 2);
    this.y = 0;
  }
}

function createPiece() {
  const index = Math.floor(Math.random() * PIECES.length);
  return new Piece(PIECES[index], COLORS[index]);
}

/* ================================
          BOARD & DESENHO
   ================================ */
function initBoard() {
  board = Array.from({ length: BOARD_HEIGHT }, () =>
    Array(BOARD_WIDTH).fill(0)
  );
}

function drawBoard() {
  boardCtx.fillStyle = "#000";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (board[y][x]) {
        boardCtx.fillStyle = board[y][x];
        boardCtx.fillRect(
          x * BLOCK_SIZE,
          y * BLOCK_SIZE,
          BLOCK_SIZE - 1,
          BLOCK_SIZE - 1
        );
      }
    }
  }
}

// Desenha a peça atual
function drawPiece(pieceObj) {
  boardCtx.fillStyle = pieceObj.color;
  pieceObj.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        boardCtx.fillRect(
          (pieceObj.x + x) * BLOCK_SIZE,
          (pieceObj.y + y) * BLOCK_SIZE,
          BLOCK_SIZE - 1,
          BLOCK_SIZE - 1
        );
      }
    });
  });
}

// Desenha uma "ghost piece" para indicar onde a peça cairia
function drawGhostPiece() {
  let ghostY = currentPiece.y;
  while (!collision(currentPiece.x, ghostY + 1, currentPiece.shape)) {
    ghostY++;
  }
  boardCtx.fillStyle = hexToRgba(currentPiece.color, 0.3);
  currentPiece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        boardCtx.fillRect(
          (currentPiece.x + x) * BLOCK_SIZE,
          (ghostY + y) * BLOCK_SIZE,
          BLOCK_SIZE - 1,
          BLOCK_SIZE - 1
        );
      }
    });
  });
}

// Converte cor hex (#rrggbb) para rgba com transparência
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Desenha a próxima peça no canvas de preview
function drawNextPiece() {
  nextCtx.fillStyle = "#000";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;

  const scale = 0.6;
  const previewSize = BLOCK_SIZE * scale;
  nextCtx.fillStyle = nextPiece.color;
  nextPiece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        nextCtx.fillRect(
          x * previewSize,
          y * previewSize,
          previewSize - 1,
          previewSize - 1
        );
      }
    });
  });
}

/* ================================
       COLISÃO, MERGE & CLEAR
   ================================ */
// Retorna true se houver colisão (limites ou bloco já existente)
function collision(offsetX, offsetY, shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const newX = offsetX + x;
        const newY = offsetY + y;
        if (
          newX < 0 ||
          newX >= BOARD_WIDTH ||
          newY >= BOARD_HEIGHT ||
          (newY >= 0 && board[newY][newX])
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

// Mescla a peça atual ao tabuleiro
function mergePiece() {
  currentPiece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        board[currentPiece.y + y][currentPiece.x + x] = currentPiece.color;
      }
    });
  });
}

// Verifica e remove linhas completas
function clearLines() {
  let linesCleared = 0;
  for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell)) {
      board.splice(y, 1);
      board.unshift(Array(BOARD_WIDTH).fill(0));
      linesCleared++;
      y++; // reavalia a mesma linha
    }
  }
  if (linesCleared > 0) {
    score += linesCleared * 100 * level;
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem("tetrisHighScore", highScore);
    }
    level = Math.floor(score / 1000) + 1;
    levelEl.textContent = level;
    dropInterval = Math.max(100, 1000 - level * 50);
  }
}

/* ================================
         ROTAÇÃO DA PEÇA
   ================================ */
function rotatePiece() {
  const rotated = currentPiece.shape[0].map((_, i) =>
    currentPiece.shape.map((row) => row[i]).reverse()
  );
  const oldX = currentPiece.x;
  const oldShape = currentPiece.shape;
  const offsets = [0, -1, 1, -2, 2];
  for (let offset of offsets) {
    currentPiece.x = oldX + offset;
    currentPiece.shape = rotated;
    if (!collision(currentPiece.x, currentPiece.y, currentPiece.shape)) {
      return;
    }
  }
  currentPiece.x = oldX;
  currentPiece.shape = oldShape;
}

/* ================================
         CONTROLE DE JOGO
   ================================ */
let currentPiece = null;
let nextPiece = null;

function gameOver() {
  paused = true;
  overlayMessage.textContent = "Game Over";
  overlay.classList.remove("hidden");
}

function resetGame() {
  initBoard();
  score = 0;
  level = 1;
  scoreEl.textContent = score;
  levelEl.textContent = level;
  dropInterval = 1000;
  currentPiece = createPiece();
  nextPiece = createPiece();
  drawNextPiece();
  overlay.classList.add("hidden");
  paused = false;
}

/* ================================
           LOOP DE ATUALIZAÇÃO
   ================================ */
function update(time = 0) {
  if (paused) {
    requestAnimationFrame(update);
    return;
  }
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  if (dropCounter > dropInterval) {
    currentPiece.y++;
    if (collision(currentPiece.x, currentPiece.y, currentPiece.shape)) {
      currentPiece.y--;
      mergePiece();
      clearLines();
      currentPiece = nextPiece;
      nextPiece = createPiece();
      drawNextPiece();
      if (collision(currentPiece.x, currentPiece.y, currentPiece.shape)) {
        gameOver();
        return;
      }
    }
    dropCounter = 0;
  }

  drawBoard();
  drawGhostPiece();
  drawPiece(currentPiece);
  requestAnimationFrame(update);
}

/* ================================
         CONTROLE DE ENTRADA
   ================================ */
// Teclado
document.addEventListener("keydown", (e) => {
  // Se estiver pausado, somente 'p' retoma o jogo
  if (paused && e.key.toLowerCase() !== "p") return;

  switch (e.keyCode) {
    case 37: // Esquerda
      currentPiece.x--;
      if (collision(currentPiece.x, currentPiece.y, currentPiece.shape))
        currentPiece.x++;
      break;
    case 39: // Direita
      currentPiece.x++;
      if (collision(currentPiece.x, currentPiece.y, currentPiece.shape))
        currentPiece.x--;
      break;
    case 40: // Soft Drop
      currentPiece.y++;
      if (collision(currentPiece.x, currentPiece.y, currentPiece.shape))
        currentPiece.y--;
      dropCounter = 0;
      break;
    case 38: // Rotacionar
      rotatePiece();
      break;
    case 32: // Hard Drop
      while (!collision(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
        currentPiece.y++;
      }
      dropCounter = dropInterval;
      break;
    case 80: // 'P' para pausar/retomar
      togglePause();
      break;
  }
});

// Função para alternar pausa
function togglePause() {
  paused = !paused;
  if (paused) {
    overlayMessage.textContent = "Paused";
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }
}

// Eventos de toque para controles mobile
function addHoldListener(element, callback, delay = 100) {
  let intervalId = null;
  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    callback();
    intervalId = setInterval(callback, delay);
  });
  element.addEventListener("touchend", () => clearInterval(intervalId));
  element.addEventListener("touchcancel", () => clearInterval(intervalId));
}

addHoldListener(btnLeft, () => {
  currentPiece.x--;
  if (collision(currentPiece.x, currentPiece.y, currentPiece.shape))
    currentPiece.x++;
});
addHoldListener(btnRight, () => {
  currentPiece.x++;
  if (collision(currentPiece.x, currentPiece.y, currentPiece.shape))
    currentPiece.x--;
});
addHoldListener(btnDown, () => {
  currentPiece.y++;
  if (collision(currentPiece.x, currentPiece.y, currentPiece.shape))
    currentPiece.y--;
  dropCounter = 0;
});
btnRotate.addEventListener("touchstart", (e) => {
  e.preventDefault();
  rotatePiece();
});
btnHardDrop.addEventListener("touchstart", (e) => {
  e.preventDefault();
  while (!collision(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
    currentPiece.y++;
  }
  dropCounter = dropInterval;
});

// Botões da sobreposição
restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);

/* ================================
           INICIALIZAÇÃO
   ================================ */
initBoard();
currentPiece = createPiece();
nextPiece = createPiece();
drawNextPiece();
lastTime = performance.now();
update();
