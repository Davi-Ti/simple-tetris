const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

// Configuração do jogo
const BLOCK_SIZE = 30;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
canvas.width = BLOCK_SIZE * BOARD_WIDTH;
canvas.height = BLOCK_SIZE * BOARD_HEIGHT;
let lockDelay = 0;
const LOCK_DELAY_TIME = 0.5; // tempo em ms

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

let board = Array.from({ length: BOARD_HEIGHT }, () =>
	Array(BOARD_WIDTH).fill(0)
);
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
		this.x = Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2);
		this.y = 0;
	}
}

function createPiece() {
	const index = Math.floor(Math.random() * PIECES.length);
	return new Piece(PIECES[index], COLORS[index]);
}

function drawBoard() {
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	for (let y = 0; y < BOARD_HEIGHT; y++) {
		for (let x = 0; x < BOARD_WIDTH; x++) {
			if (board[y][x]) {
				ctx.fillStyle = board[y][x];
				ctx.fillRect(
					x * BLOCK_SIZE,
					y * BLOCK_SIZE,
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
				ctx.fillRect(
					(piece.x + x) * BLOCK_SIZE,
					(piece.y + y) * BLOCK_SIZE,
					BLOCK_SIZE - 1,
					BLOCK_SIZE - 1
				);
			}
		});
	});
}

function drawGhostPiece() {
	let ghostY = piece.y;
	while (!collisionTest(piece.x, ghostY + 1)) {
		ghostY++;
	}
	ctx.fillStyle = hexToRgba(piece.color, 0.3);
	piece.shape.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value) {
				ctx.fillRect(
					(piece.x + x) * BLOCK_SIZE,
					(ghostY + y) * BLOCK_SIZE,
					BLOCK_SIZE - 1,
					BLOCK_SIZE - 1
				);
			}
		});
	});
}

function hexToRgba(hex, alpha) {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

function collisionTest(testX, testY) {
	return piece.shape.some((row, y) => {
		return row.some((value, x) => {
			if (!value) return false;
			const newX = testX + x;
			const newY = testY + y;
			return (
				newX < 0 ||
				newX >= BOARD_WIDTH ||
				newY >= BOARD_HEIGHT ||
				board[newY]?.[newX]
			);
		});
	});
}

function merge() {
	piece.shape.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value) {
				board[piece.y + y][piece.x + x] = piece.color;
			}
		});
	});
}

function rotate() {
	const rotated = piece.shape[0].map((_, i) =>
	  piece.shape.map((row) => row[i]).reverse()
	);
	const oldX = piece.x;
	const oldShape = piece.shape;
	// Lista de offsets para tentar um "wall kick"
	const offsets = [0, -1, 1, -2, 2];
	let kickSuccess = false;
	for (let offset of offsets) {
	  piece.x = oldX + offset;
	  piece.shape = rotated;
	  if (!collisionTest(piece.x, piece.y)) {
		kickSuccess = true;
		// Se houver rotação bem-sucedida, reinicia o lockDelay
		lockDelay = 0;
		break;
	  }
	}
	if (!kickSuccess) {
	  // Reverte a rotação e a posição, se nenhum deslocamento funcionar
	  piece.shape = oldShape;
	  piece.x = oldX;
	}
  }

function clearLines() {
	let linesCleared = 0;
	for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
		if (board[y].every((cell) => cell)) {
			board.splice(y, 1);
			board.unshift(Array(BOARD_WIDTH).fill(0));
			linesCleared++;
			y++; // reavalia a mesma linha após o splice
		}
	}
	if (linesCleared > 0) {
		score += linesCleared * 100 * level;
		document.getElementById("score").textContent = score;
		if (score > highScore) {
			highScore = score;
			document.getElementById("highscore").textContent = highScore;
			localStorage.setItem("tetrisHighScore", highScore);
		}
		level = Math.floor(score / 1000) + 1;
		document.getElementById("level").textContent = level;
		dropInterval = Math.max(100, 1000 - level * 50);
	}
}

function gameOver() {
	paused = true;
	showOverlay("Game Over");
}

function resetGame() {
	board = Array.from({ length: BOARD_HEIGHT }, () =>
		Array(BOARD_WIDTH).fill(0)
	);
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
  
	if (dropCounter > dropInterval) {
	  piece.y++;
	  if (collisionTest(piece.x, piece.y)) {
		piece.y--; // reverte o movimento
  
		// Inicia ou acumula o lock delay:
		lockDelay += deltaTime;
		if (lockDelay >= LOCK_DELAY_TIME) {
		  merge();
		  clearLines();
		  piece = nextPiece;
		  nextPiece = createPiece();
		  drawNextPiece();
		  // Reinicia o lockDelay
		  lockDelay = 0;
		  // Verifica se a nova peça já colide
		  if (collisionTest(piece.x, piece.y)) {
			gameOver();
		  }
		}
	  } else {
		// Se a peça desceu sem colisão, reinicia o lockDelay:
		lockDelay = 0;
	  }
	  dropCounter = 0;
	}
	drawBoard();
	drawGhostPiece();
	drawPiece();
	requestAnimationFrame(update);
  }
  

// Controles de teclado
document.addEventListener("keydown", (event) => {
	// Se estiver pausado, somente a tecla "P" (para retomar) é aceita
	if (paused && event.key.toLowerCase() !== "p") return;

	switch (event.keyCode) {
		case 37: // Esquerda
			piece.x--;
			if (collisionTest(piece.x, piece.y)) piece.x++;
			break;
		case 39: // Direita
			piece.x++;
			if (collisionTest(piece.x, piece.y)) piece.x--;
			break;
		case 40: // Soft Drop
			piece.y++;
			if (collisionTest(piece.x, piece.y)) piece.y--;
			dropCounter = 0;
			break;
		case 38: // Rotacionar
			rotate();
			break;
		case 32: // Hard Drop (tecla Espaço)
			while (!collisionTest(piece.x, piece.y + 1)) {
				piece.y++;
			}
			dropCounter = dropInterval; // força a mesclagem na próxima atualização
			break;
		case 80: // "P" para pausar/retomar
			togglePause();
			break;
	}
});

// Controles Mobile
function addHoldListener(element, callback, delay = 100) {
	let intervalId = null;
	element.addEventListener("touchstart", (e) => {
		e.preventDefault(); // previne comportamentos indesejados
		callback(); // executa imediatamente
		intervalId = setInterval(callback, delay);
	});
	element.addEventListener("touchend", () => {
		clearInterval(intervalId);
	});
	element.addEventListener("touchcancel", () => {
		clearInterval(intervalId);
	});
}

const btnLeft = document.getElementById("mobile-left");
addHoldListener(btnLeft, () => {
	piece.x--;
	if (collisionTest(piece.x, piece.y)) piece.x++;
});

const btnRight = document.getElementById("mobile-right");
addHoldListener(btnRight, () => {
	piece.x++;
	if (collisionTest(piece.x, piece.y)) piece.x--;
});

const btnDown = document.getElementById("mobile-down");
addHoldListener(btnDown, () => {
	piece.y++;
	if (collisionTest(piece.x, piece.y)) piece.y--;
	dropCounter = 0;
});

// Para os botões que não precisam repetir a ação, mantemos apenas touchstart
document.getElementById("mobile-rotate").addEventListener("touchstart", (e) => {
	e.preventDefault();
	rotate();
});

document
	.getElementById("mobile-hard-drop")
	.addEventListener("touchstart", (e) => {
		e.preventDefault();
		while (!collisionTest(piece.x, piece.y + 1)) {
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
	// Em Game Over, somente reinicia
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
		lastTime = performance.now();
	}
}

restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);

piece = createPiece();
nextPiece = createPiece();
drawNextPiece();
lastTime = performance.now();
update();
