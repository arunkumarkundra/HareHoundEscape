class HareAndHoundsGame {
    constructor() {
        this.boardSize = 10;
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.timeLimit = 60;
        this.timeElapsed = 0;
        this.moveCount = 0; // Add move counter
        this.timer = null;
        this.gameOver = false;
        this.modal = new bootstrap.Modal(document.getElementById('gameOverModal'));

        this.initializeGame();
        this.setupEventListeners();
    }

    initializeGame() {
        // Place hare randomly at bottom row
        const randomCol = Math.floor(Math.random() * this.boardSize);
        this.harePosition = { row: this.boardSize - 1, col: randomCol };

        // Place 4 hounds randomly on the top half of the board (not in hare position)
        this.houndPositions = [];
        while (this.houndPositions.length < 4) {
            const row = Math.floor(Math.random() * (this.boardSize / 2)); // Only use top half of board
            const col = Math.floor(Math.random() * this.boardSize);
            const position = { row, col };

            // Check if position is not occupied by another hound
            if (!this.isHoundAt(row, col) && 
                !(row === this.harePosition.row && col === this.harePosition.col)) {
                this.houndPositions.push(position);
            }
        }

        this.moveCount = 0; // Reset move counter
        this.renderBoard();
        this.startTimer();
    }

    renderBoard() {
        const gameBoard = document.getElementById('game-board');
        gameBoard.innerHTML = '';
        gameBoard.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';

                if (row === this.harePosition.row && col === this.harePosition.col) {
                    cell.textContent = '🐇';
                    cell.classList.add('hare');
                } else if (this.isHoundAt(row, col)) {
                    cell.textContent = '🐶';
                    cell.classList.add('hound');
                }

                gameBoard.appendChild(cell);
            }
        }
    }

    isHoundAt(row, col) {
        return this.houndPositions.some(pos => pos.row === row && pos.col === col);
    }

    moveHare(direction) {
        if (this.gameOver) return;

        const newPosition = { ...this.harePosition };

        switch (direction) {
            case 'left':
                newPosition.col -= 1;
                break;
            case 'right':
                newPosition.col += 1;
                break;
            case 'forward':
                newPosition.row -= 1;
                break;
        }

        if (this.isValidMove(newPosition)) {
            this.moveCount++; // Increment move counter
            this.harePosition = newPosition;

            // Check if a hound caught the hare after move
            if (this.isHoundAt(this.harePosition.row, this.harePosition.col)) {
                this.endGame(false, "caught");
                return;
            }

            this.checkWinCondition();
            if (!this.gameOver) {
                this.moveHounds();
                this.checkLoseCondition();
                this.renderBoard();
            }
        }
    }

    isValidMove(position) {
        return position.row >= 0 && position.row < this.boardSize &&
               position.col >= 0 && position.col < this.boardSize;
    }

    moveHounds() {
        // Calculate escape routes for the hare
        const escapeRoutes = this.calculateEscapeRoutes();

        // Sort hounds by their strategic position
        this.houndPositions.sort((a, b) => {
            const scoreA = this.calculateHoundScore(a, escapeRoutes);
            const scoreB = this.calculateHoundScore(b, escapeRoutes);
            return scoreB - scoreA; // Higher score moves first
        });

        // Move each hound strategically
        for (let hound of this.houndPositions) {
            const possibleMoves = this.getHoundMoves(hound);
            if (possibleMoves.length > 0) {
                const bestMove = this.chooseBestHoundMove(hound, possibleMoves, escapeRoutes);
                hound.row = bestMove.row;
                hound.col = bestMove.col;

                // Check if hound caught the hare after moving
                if (hound.row === this.harePosition.row && hound.col === this.harePosition.col) {
                   // this.harePosition = null; // Remove the hare from the board
                   // this.renderBoard(); // Ensure the board updates before showing message
                    this.endGame(false, "caught");
                    return;
                }
            }
        }
    }

    calculateEscapeRoutes() {
        const routes = [];
        const visited = new Set();

        const findPaths = (pos, path) => {
            const key = `${pos.row},${pos.col}`;
            if (pos.row === 0 || visited.has(key)) return;

            visited.add(key);
            path.push(pos);

            if (pos.row === this.harePosition.row && pos.col === this.harePosition.col) {
                routes.push([...path]);
            } else {
                // Include diagonal moves for more aggressive pursuit
                const moves = [
                    { row: pos.row - 1, col: pos.col },     // up
                    { row: pos.row - 1, col: pos.col - 1 }, // up-left
                    { row: pos.row - 1, col: pos.col + 1 }, // up-right
                    { row: pos.row, col: pos.col - 1 },     // left
                    { row: pos.row, col: pos.col + 1 }      // right
                ];

                for (const move of moves) {
                    if (this.isValidMove(move)) {
                        findPaths(move, path);
                    }
                }
            }

            path.pop();
            visited.delete(key);
        };

        findPaths(this.harePosition, []);
        return routes;
    }

    calculateHoundScore(hound, escapeRoutes) {
        let score = 0;

        // Distance to hare (closer is better)
        const distToHare = Math.abs(hound.row - this.harePosition.row) + 
                          Math.abs(hound.col - this.harePosition.col);
        score += (this.boardSize * 2 - distToHare) * 3; // Increased weight for pursuit

        // Blocking escape routes
        for (const route of escapeRoutes) {
            for (const pos of route) {
                const distToRoute = Math.abs(hound.row - pos.row) + 
                                  Math.abs(hound.col - pos.col);
                if (distToRoute <= 2) {
                    score += (3 - distToRoute) * 4; // Increased weight for blocking
                }
            }
        }

        // Coordination with other hounds
        const otherHounds = this.houndPositions.filter(h => h !== hound);
        for (const other of otherHounds) {
            const distBetween = Math.abs(hound.row - other.row) + 
                               Math.abs(hound.col - other.col);
            if (distBetween <= 4) { // Increased range for coordination
                score += (5 - distBetween) * 2;
            }
        }

        // Bonus for positions that could lead to capture
        if (Math.abs(hound.row - this.harePosition.row) <= 1 &&
            Math.abs(hound.col - this.harePosition.col) <= 1) {
            score += 10; // High bonus for potential capture positions
        }

        return score;
    }

    chooseBestHoundMove(hound, possibleMoves, escapeRoutes) {
        return possibleMoves.reduce((best, move) => {
            const moveScore = this.calculateHoundScore({...move}, escapeRoutes);
            const bestScore = this.calculateHoundScore({...best}, escapeRoutes);
            return moveScore > bestScore ? move : best;
        }, possibleMoves[0]);
    }

    getHoundMoves(hound) {
        const moves = [];
        // Include diagonal movements for more aggressive pursuit
        const directions = [
            { row: 1, col: 0 },   // down
            { row: 1, col: -1 },  // down-left
            { row: 1, col: 1 },   // down-right
            { row: 0, col: -1 },  // left
            { row: 0, col: 1 }    // right
        ];

        for (let dir of directions) {
            const newPos = {
                row: hound.row + dir.row,
                col: hound.col + dir.col
            };

            if (this.isValidMove(newPos) && !this.isHoundAt(newPos.row, newPos.col)) {
                moves.push(newPos);
            }
        }

        return moves;
    }

    checkWinCondition() {
        if (this.harePosition.row === 0) {
            this.endGame(true);
    //          this.renderBoard(); // Ensure the hare is shown at the top
    //          setTimeout(() => this.endGame(true), 100); // Slight delay for better UX
        }
    }

    checkLoseCondition() {
        const surroundingCells = [
            { row: this.harePosition.row - 1, col: this.harePosition.col },     // up
            { row: this.harePosition.row + 1, col: this.harePosition.col },     // down
            { row: this.harePosition.row, col: this.harePosition.col - 1 },     // left
            { row: this.harePosition.row, col: this.harePosition.col + 1 },     // right
            { row: this.harePosition.row - 1, col: this.harePosition.col - 1 }, // up-left
            { row: this.harePosition.row - 1, col: this.harePosition.col + 1 }, // up-right
            { row: this.harePosition.row + 1, col: this.harePosition.col - 1 }, // down-left
            { row: this.harePosition.row + 1, col: this.harePosition.col + 1 }  // down-right
        ];

        const trapped = surroundingCells.every(pos => 
            !this.isValidMove(pos) || 
            pos.row < 0 || 
            pos.row >= this.boardSize ||
            pos.col < 0 || 
            pos.col >= this.boardSize ||
            this.isHoundAt(pos.row, pos.col)
        );

        if (trapped) {
            this.endGame(false, "trapped");
        }
    }

    startTimer() {
        const timerDisplay = document.getElementById('timer');
        let timeLeft = this.timeLimit;

        this.timer = setInterval(() => {
            timeLeft--;
            this.timeElapsed = this.timeLimit - timeLeft;
            timerDisplay.textContent = timeLeft;

            if (timeLeft <= 0) {
                this.endGame(false, "timeout");
            }
        }, 1000);
    }

    endGame(won, reason = "") {
        this.gameOver = true;
        clearInterval(this.timer);

        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const nameInput = document.getElementById('nameInputGroup');
        const shareButton = document.getElementById('shareScore');

        if (won) {
            title.textContent = '🎉 Victory!';
            message.textContent = `Congratulations! You helped the hare escape in ${this.timeElapsed} seconds with ${this.moveCount} moves!`;
            nameInput.style.display = 'block';
            shareButton.style.display = 'block';
        } else {
            title.textContent = '😢 Game Over';
            message.textContent = reason === "caught" ? 
                "The hare was caught by a hound!" :
                reason === "trapped" ?
                "The hare was trapped by the hounds!" :
                "Time's up! The hare couldn't escape in time!";
            nameInput.style.display = 'none';
            shareButton.style.display = 'none';
        }

        this.modal.show();
    }

    setupEventListeners() {
        document.getElementById('moveLeft').addEventListener('click', () => this.moveHare('left'));
        document.getElementById('moveRight').addEventListener('click', () => this.moveHare('right'));
        document.getElementById('moveForward').addEventListener('click', () => this.moveHare('forward'));

        document.getElementById('shareScore').addEventListener('click', this.shareScore.bind(this));
        document.getElementById('playAgain').addEventListener('click', () => {
            this.modal.hide();
            this.resetGame();
        });

        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    this.moveHare('left');
                    break;
                case 'ArrowRight':
                    this.moveHare('right');
                    break;
                case 'ArrowUp':
                    this.moveHare('forward');
                    break;
            }
        });
    }

    async shareScore() {
        const playerName = document.getElementById('playerName').value || 'Anonymous';
        const gameBoard = document.getElementById('game-board');
        const modal = document.getElementById('gameOverModal');

        // Create a canvas to combine the game board and modal content
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = 800;
        canvas.height = 600;

        // Draw game state and modal content
        try {
            // Convert the game board and modal to a data URL
            const image = await html2canvas(document.body);
            const imageUrl = image.toDataURL('image/png');

            const message = `${playerName} completed Hare & Hounds in ${this.timeElapsed} seconds using ${this.moveCount} moves! Can you help the hare escape? Play now at ${window.location.href}`;

            if (navigator.share) {
                await navigator.share({
                    title: 'Hare & Hounds Escape Game',
                    text: message,
                    url: window.location.href,
                    files: [
                        new File([await (await fetch(imageUrl)).blob()], 
                        'game-result.png', 
                        { type: 'image/png' })
                    ]
                });
            } else {
                alert('Sharing is not supported on this browser');
            }
        } catch (err) {
            console.error('Error sharing:', err);
            // Fallback to basic sharing if image sharing fails
            const message = `${playerName} played Hare & Hounds Escape Game! Can you help the hare escape? Play now at ${window.location.href}`;
            if (navigator.share) {
                await navigator.share({
                    title: 'Hare & Hounds Escape Game',
                    text: message,
                    url: window.location.href
                });
            } else {
                alert('Sharing is not supported on this browser');
            }
        }
    }

    resetGame() {
        this.gameOver = false;
        clearInterval(this.timer);
        this.timeElapsed = 0;
        this.initializeGame();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HareAndHoundsGame();
});
