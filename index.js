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
canvas.width = BLOCK_SIZE * BOARD_WIDTH;
canvas.height = BLOCK_SIZE * BOARD_HEIGHT; // desenha apenas as linhas visíveis

let lockDelay = 0;
const LOCK_DELAY_TIME = 200; // tempo em ms

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

// Cria um tabuleiro com TOTAL_ROWS linhas (incluindo as ocultas)
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

// Função de colisão que converte as coordenadas da peça para índices do tabuleiro
function collision(piece, testX, testY) {
	return piece.shape.some((row, y) => {
		return row.some((value, x) => {
			if (!value) return false;
			const boardX = testX + x;
			// Converte a posição da peça para o índice real no board
			const boardY = testY + y + HIDDEN_ROWS;
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
	// Desenha somente as linhas visíveis (de HIDDEN_ROWS até TOTAL_ROWS-1)
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
	let ghostY = piece.y;
	while (!collision(piece, piece.x, ghostY + 1)) {
		ghostY++;
	}
	ctx.fillStyle = hexToRgba(piece.color, 0.3);
	piece.shape.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value) {
				const drawY = ghostY + y + HIDDEN_ROWS;
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

function merge() {
	let gameOverTriggered = false;
	piece.shape.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value) {
				const boardX = piece.x + x;
				const boardY = piece.y + y + HIDDEN_ROWS;
				// Se a peça lockar em uma linha acima da visível, dispara game over
				if (boardY < HIDDEN_ROWS) {
					gameOverTriggered = true;
				} else {
					board[boardY][boardX] = piece.color;
				}
			}
		});
	});
	if (gameOverTriggered) {
		gameOver();
	}
}

function rotate() {
	const rotated = piece.shape[0].map((_, i) =>
		piece.shape.map((row) => row[i]).reverse()
	);
	const oldX = piece.x;
	const oldShape = piece.shape;
	// Tenta aplicar "wall kicks"
	const offsets = [0, -1, 1, -2, 2];
	let kickSuccess = false;
	for (let offset of offsets) {
		if (!collision({ shape: rotated, color: piece.color }, piece.x + offset, piece.y)) {
			piece.x += offset;
			piece.shape = rotated;
			lockDelay = 0;
			kickSuccess = true;
			break;
		}
	}
	if (!kickSuccess) {
		piece.shape = oldShape;
		piece.x = oldX;
	}
}

function clearLines() {
	let linesCleared = 0;
	// Verifica apenas as linhas visíveis
	for (let y = TOTAL_ROWS - 1; y >= HIDDEN_ROWS; y--) {
		if (board[y].every(cell => cell)) {
			board.splice(y, 1);
			board.unshift(Array(BOARD_WIDTH).fill(0));
			linesCleared++;
			y++; // reavalia a mesma linha após o unshift
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

	if (collision(piece, piece.x, piece.y + 1)) {
		lockDelay += deltaTime;
		if (lockDelay >= LOCK_DELAY_TIME) {
			merge();
			if (paused) return; // se game over foi disparado durante o merge
			clearLines();
			piece = nextPiece;
			nextPiece = createPiece();
			drawNextPiece();
			lockDelay = 0;
			// Se a nova peça, ao spawnar, já colide na área visível, dispara game over
			if (collision(piece, piece.x, piece.y)) {
				gameOver();
			}
		}
	} else {
		lockDelay = 0;
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
	if (paused && event.key.toLowerCase() !== "p") return;
	switch (event.keyCode) {
		case 37: // Esquerda
			piece.x--;
			if (collision(piece, piece.x, piece.y)) piece.x++;
			else if (collision(piece, piece.x, piece.y + 1)) lockDelay = 0;
			break;
		case 39: // Direita
			piece.x++;
			if (collision(piece, piece.x, piece.y)) piece.x--;
			else if (collision(piece, piece.x, piece.y + 1)) lockDelay = 0;
			break;
		case 40: // Soft Drop
			piece.y++;
			if (collision(piece, piece.x, piece.y)) piece.y--;
			else if (collision(piece, piece.x, piece.y + 1)) lockDelay = 0;
			dropCounter = 0;
			break;
		case 38: // Rotacionar
			rotate();
			break;
		case 32: // Hard Drop
			while (!collision(piece, piece.x, piece.y + 1)) {
				piece.y++;
			}
			dropCounter = dropInterval;
			break;
		case 80: // Pausar/Retomar
			togglePause();
			break;
	}
});

// Controles Mobile
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
