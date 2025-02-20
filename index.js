class Piece {
	constructor(shape, color) {
		this.shape = shape;
		this.color = color;
		this.x = 3;
		this.y = 0;
		this.ghostY = 0;
	}

	rotate(matrix) {
		const N = this.shape.length - 1;
		const newShape = this.shape.map((row, i) =>
			row.map((val, j) => this.shape[N - j][i])
		);

		// Testar colisão após rotação
		if (!this.collision(0, 0, matrix, newShape)) {
			this.shape = newShape;
		} else {
			// Kick de rotação (tenta ajustar posição)
			const kicks = [
				[0, 0],
				[-1, 0],
				[1, 0],
				[0, -1],
				[-1, -1],
				[1, -1],
			];
			for (const [dx, dy] of kicks) {
				if (!this.collision(dx, dy, matrix, newShape)) {
					this.shape = newShape;
					this.x += dx;
					this.y += dy;
					break;
				}
			}
		}
	}

	collision(dx, dy, matrix, shape = this.shape) {
		for (let y = 0; y < shape.length; y++) {
			for (let x = 0; x < shape[y].length; x++) {
				if (shape[y][x]) {
					const newX = this.x + x + dx;
					const newY = this.y + y + dy;
					if (
						newX < 0 ||
						newX >= matrix[0].length ||
						newY >= matrix.length ||
						(newY >= 0 && matrix[newY][newX])
					) {
						return true;
					}
				}
			}
		}
		return false;
	}

	calculateGhost(matrix) {
		let dy = 0;
		while (!this.collision(0, dy + 1, matrix)) {
			dy++;
		}
		this.ghostY = dy;
	}
}

class Game {
	constructor() {
		this.canvas = document.getElementById("board");
		this.ctx = this.canvas.getContext("2d");
		this.nextCanvas = document.getElementById("next");
		this.nextCtx = this.nextCanvas.getContext("2d");

		this.BLOCK_SIZE = 30;
		this.BOARD_WIDTH = 10;
		this.BOARD_HEIGHT = 20;

		this.board = Array(this.BOARD_HEIGHT)
			.fill()
			.map(() => Array(this.BOARD_WIDTH).fill(0));
		this.score = 0;
		this.highScore = localStorage.getItem("tetrisHighScore") || 0;
		this.level = 1;
		this.lockDelay = 500;
		this.lastLock = 0;
		this.gameOver = false;
		this.paused = false;

		this.pieces = [
			[[[1, 1, 1, 1]], "#00f0f0"], // I
			[
				[
					[1, 1],
					[1, 1],
				],
				"#f0f000",
			], // O
			[
				[
					[0, 1, 0],
					[1, 1, 1],
				],
				"#a000f0",
			], // T
			[
				[
					[1, 0],
					[1, 0],
					[1, 1],
				],
				"#f0a000",
			], // L
			[
				[
					[0, 1],
					[0, 1],
					[1, 1],
				],
				"#0000f0",
			], // J
			[
				[
					[1, 1, 0],
					[0, 1, 1],
				],
				"#f00000",
			], // S
			[
				[
					[0, 1, 1],
					[1, 1, 0],
				],
				"#00f000",
			], // Z
		];

		this.currentPiece = null;
		this.nextPiece = null;
		this.init();
	}

	init() {
		this.ctx.scale(this.BLOCK_SIZE, this.BLOCK_SIZE);
		this.nextCtx.scale(this.BLOCK_SIZE, this.BLOCK_SIZE);
		this.spawnNewPiece();
		this.setupControls();
		this.gameLoop();
	}

	spawnNewPiece() {
		this.currentPiece = this.nextPiece || this.createRandomPiece();
		this.nextPiece = this.createRandomPiece();
		this.lastLock = Date.now();
		this.currentPiece.calculateGhost(this.board);

		if (this.currentPiece.collision(0, 0, this.board)) {
			this.gameOver = true;
			this.showOverlay("Game Over!");
		}
	}

	createRandomPiece() {
		const random = Math.floor(Math.random() * this.pieces.length);
		return new Piece(...this.pieces[random]);
	}

	draw() {
		// Limpar canvas
		this.ctx.fillStyle = "#000";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// Desenhar tabuleiro
		this.board.forEach((row, y) => {
			row.forEach((value, x) => {
				if (value) {
					this.ctx.fillStyle = value;
					this.ctx.fillRect(x, y, 1, 1);
				}
			});
		});

		// Desenhar peça fantasma
		if (this.currentPiece) {
			this.ctx.fillStyle = this.currentPiece.color + "60";
			this.currentPiece.shape.forEach((row, y) => {
				row.forEach((value, x) => {
					if (value) {
						this.ctx.fillRect(
							x + this.currentPiece.x,
							y + this.currentPiece.y + this.currentPiece.ghostY,
							1,
							1
						);
					}
				});
			});
		}

		// Desenhar peça atual
		if (this.currentPiece) {
			this.ctx.fillStyle = this.currentPiece.color;
			this.currentPiece.shape.forEach((row, y) => {
				row.forEach((value, x) => {
					if (value) {
						this.ctx.fillRect(
							x + this.currentPiece.x,
							y + this.currentPiece.y,
							1,
							1
						);
					}
				});
			});
		}

		// Desenhar próxima peça
		this.nextCtx.fillStyle = "#000";
		this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
		this.nextCtx.fillStyle = this.nextPiece.color;
		this.nextPiece.shape.forEach((row, y) => {
			row.forEach((value, x) => {
				if (value) {
					this.nextCtx.fillRect(x + 1, y + 1, 1, 1);
				}
			});
		});
	}

	clearLines() {
		let linesCleared = 0;

		for (let y = this.board.length - 1; y >= 0; y--) {
			if (this.board[y].every((cell) => cell)) {
				this.board.splice(y, 1);
				this.board.unshift(Array(this.BOARD_WIDTH).fill(0));
				linesCleared++;
				y++;
			}
		}

		if (linesCleared > 0) {
			this.score += [100, 300, 500, 800][linesCleared - 1] * this.level;
			this.level = Math.floor(this.score / 1000) + 1;
			document.getElementById("score").textContent = this.score;
			if (this.score > this.highScore) {
				this.highScore = this.score;
				localStorage.setItem("tetrisHighScore", this.highScore);
				document.getElementById("highscore").textContent = this.highScore;
			}
		}
	}

	lockPiece() {
		this.currentPiece.shape.forEach((row, y) => {
			row.forEach((value, x) => {
				if (value) {
					this.board[y + this.currentPiece.y][x + this.currentPiece.x] =
						this.currentPiece.color;
				}
			});
		});

		this.clearLines();
		this.spawnNewPiece();
	}

	hardDrop() {
		this.score += 2 * this.currentPiece.ghostY;
		this.currentPiece.y += this.currentPiece.ghostY;
		this.lockPiece();
	}

	gameLoop() {
		if (this.gameOver || this.paused) return;

		const dropSpeed = Math.max(50, 1000 - this.level * 100);

		if (!this.currentPiece.collision(0, 1, this.board)) {
			if (Date.now() - this.lastDrop > dropSpeed) {
				this.currentPiece.y++;
				this.lastDrop = Date.now();
			}
		} else {
			if (Date.now() - this.lastLock > this.lockDelay) {
				this.lockPiece();
			}
		}

		this.currentPiece.calculateGhost(this.board);
		this.draw();
		requestAnimationFrame(() => this.gameLoop());
	}

	setupControls() {
		// Teclado
		document.addEventListener("keydown", (e) => {
			if (this.gameOver || this.paused) return;

			switch (e.key) {
				case "ArrowLeft":
					if (!this.currentPiece.collision(-1, 0, this.board)) {
						this.currentPiece.x--;
						this.lastLock = Date.now();
					}
					break;
				case "ArrowRight":
					if (!this.currentPiece.collision(1, 0, this.board)) {
						this.currentPiece.x++;
						this.lastLock = Date.now();
					}
					break;
				case "ArrowDown":
					if (!this.currentPiece.collision(0, 1, this.board)) {
						this.currentPiece.y++;
						this.score++;
						this.lastLock = Date.now();
					}
					break;
				case "ArrowUp":
					this.currentPiece.rotate(this.board);
					this.lastLock = Date.now();
					break;
				case " ":
					this.hardDrop();
					break;
			}
			this.draw();
		});

		// Controles mobile
		const handleMobile = (action) => {
			if (this.gameOver || this.paused) return;

			switch (action) {
				case "left":
					if (!this.currentPiece.collision(-1, 0, this.board)) {
						this.currentPiece.x--;
						this.lastLock = Date.now();
					}
					break;
				case "right":
					if (!this.currentPiece.collision(1, 0, this.board)) {
						this.currentPiece.x++;
						this.lastLock = Date.now();
					}
					break;
				case "down":
					if (!this.currentPiece.collision(0, 1, this.board)) {
						this.currentPiece.y++;
						this.score++;
						this.lastLock = Date.now();
					}
					break;
				case "rotate":
					this.currentPiece.rotate(this.board);
					this.lastLock = Date.now();
					break;
				case "hardDrop":
					this.hardDrop();
					break;
			}
			this.draw();
		};

		["left", "right", "down", "rotate", "hardDrop"].forEach((action) => {
			document
				.getElementById(`mobile-${action}`)
				.addEventListener("touchstart", (e) => {
					e.preventDefault();
					handleMobile(action);
				});
		});
	}

	showOverlay(message) {
		document.getElementById("overlay").classList.remove("hidden");
		document.getElementById("overlay-message").textContent = message;
		document
			.getElementById("pause-btn")
			.classList.toggle("hidden", this.gameOver);
	}

	resetGame() {
		this.board = Array(this.BOARD_HEIGHT)
			.fill()
			.map(() => Array(this.BOARD_WIDTH).fill(0));
		this.score = 0;
		this.level = 1;
		this.gameOver = false;
		this.spawnNewPiece();
		document.getElementById("score").textContent = "0";
		document.getElementById("overlay").classList.add("hidden");
		this.gameLoop();
	}
}

// Inicialização do jogo
let game = new Game();

// Controles da interface
document.getElementById("restart-btn").addEventListener("click", () => {
	game.resetGame();
});

document.getElementById("pause-btn").addEventListener("click", () => {
	game.paused = !game.paused;
	document.getElementById("pause-btn").textContent = game.paused
		? "Resume"
		: "Pause";
	if (!game.paused) game.gameLoop();
});

function togglePause() {
	game.paused = !game.paused;
	document.getElementById("overlay").classList.toggle("hidden");
	document.getElementById("overlay-message").textContent = "Paused";
	if (!game.paused) game.gameLoop();
}

// Prevenir comportamento padrão de touch
document.addEventListener(
	"touchstart",
	(e) => {
		if (e.target.classList.contains("mobile-btn")) {
			e.preventDefault();
		}
	},
	{ passive: false }
);
