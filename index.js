


document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const mainMenu = document.getElementById('main-menu');
    const multiplayerLobby = document.getElementById('multiplayer-lobby');
    const gameView = document.getElementById('game-view');
    const statusDisplay = document.getElementById('status-display');
    const cells = document.querySelectorAll('.cell');
    const restartButton = document.getElementById('restart-button');
    const resetScoreButton = document.getElementById('reset-score-button');
    const mainMenuButton = document.getElementById('main-menu-button');
    const scoreXDisplay = document.getElementById('score-x');
    const scoreODisplay = document.getElementById('score-o');
    const playerXLabel = document.getElementById('player-x-label');
    const playerOLabel = document.getElementById('player-o-label');

    // Menu Buttons
    const playVsCpuBtn = document.getElementById('play-vs-cpu-btn');
    const play2PlayerBtn = document.getElementById('play-2-player-btn');
    const hostGameBtn = document.getElementById('host-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');
    
    // Lobby Elements
    const lobbyTitle = document.getElementById('lobby-title');
    const hostView = document.getElementById('host-view');
    const joinView = document.getElementById('join-view');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const roomCodeInput = document.getElementById('room-code-input');
    const joinRoomSubmitBtn = document.getElementById('join-room-submit-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const waitingMsg = document.getElementById('waiting-msg');


    // --- Game State ---
    let gameActive = true;
    let currentPlayer = 'X';
    let gameState = ["", "", "", "", "", "", "", "", ""];
    let score = {
        X: parseInt(localStorage.getItem('scoreX')) || 0,
        O: parseInt(localStorage.getItem('scoreO')) || 0
    };
    let gameMode = null; // 'vs-cpu', 'local-multiplayer', 'multiplayer'
    let playerSymbol = 'X'; // For multiplayer, am I X or O?
    let channel = null;

    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    // --- Screen Management ---
    function showScreen(screen) {
        mainMenu.classList.add('hidden');
        multiplayerLobby.classList.add('hidden');
        gameView.classList.add('hidden');
        if (screen === 'menu') mainMenu.classList.remove('hidden');
        if (screen === 'lobby') multiplayerLobby.classList.remove('hidden');
        if (screen === 'game') gameView.classList.remove('hidden');
    }

    // --- Game Logic ---
    function updateScoreDisplay() {
        scoreXDisplay.textContent = score.X.toString();
        scoreODisplay.textContent = score.O.toString();
    }

    function saveScores() {
        localStorage.setItem('scoreX', score.X.toString());
        localStorage.setItem('scoreO', score.O.toString());
    }

    function handleCellPlayed(clickedCellIndex) {
        if (gameState[clickedCellIndex] !== "" || !gameActive) {
            return;
        }
        gameState[clickedCellIndex] = currentPlayer;
        const cell = cells[clickedCellIndex];
        cell.innerHTML = `<span class="mark">${currentPlayer}</span>`;
        cell.classList.add(currentPlayer.toLowerCase());
        handleResultValidation();
    }

    function handlePlayerChange() {
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        updateStatus();

        if (gameMode === 'vs-cpu' && currentPlayer === 'O' && gameActive) {
            // Use a short delay to make the CPU's move feel more natural
            setTimeout(getComputerMove, 500);
        }
    }

    function getComputerMove() {
        // 1. Check for a winning move for 'O'
        for (let i = 0; i < gameState.length; i++) {
            if (gameState[i] === "") {
                const tempState = [...gameState];
                tempState[i] = 'O';
                if (checkWinner(tempState) === 'O') {
                    handleCellPlayed(i);
                    return;
                }
            }
        }

        // 2. Check to block 'X' from winning
        for (let i = 0; i < gameState.length; i++) {
            if (gameState[i] === "") {
                const tempState = [...gameState];
                tempState[i] = 'X';
                if (checkWinner(tempState) === 'X') {
                    handleCellPlayed(i);
                    return;
                }
            }
        }

        // 3. Take the center if available
        if (gameState[4] === "") {
            handleCellPlayed(4);
            return;
        }

        // 4. Take a random available corner
        const corners = [0, 2, 6, 8];
        const availableCorners = corners.filter(index => gameState[index] === "");
        if (availableCorners.length > 0) {
            const randomCorner = availableCorners[Math.floor(Math.random() * availableCorners.length)];
            handleCellPlayed(randomCorner);
            return;
        }

        // 5. Take any remaining available cell (sides)
        makeRandomValidMove();
    }

    function makeRandomValidMove() {
        const availableCells = gameState.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
        if (availableCells.length > 0) {
            const randomMove = availableCells[Math.floor(Math.random() * availableCells.length)];
            handleCellPlayed(randomMove);
        }
    }

    // Helper function to check for a winner on a given board state
    function checkWinner(board) {
        for (let i = 0; i < winningConditions.length; i++) {
            const [a, b, c] = winningConditions[i];
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a]; // Returns 'X' or 'O'
            }
        }
        return null; // No winner
    }

    function handleResultValidation() {
        const winner = checkWinner(gameState);
        
        if (winner) {
            const winningCombination = winningConditions.find(cond => 
                gameState[cond[0]] === winner && 
                gameState[cond[1]] === winner && 
                gameState[cond[2]] === winner
            );

            score[currentPlayer]++;
            updateScoreDisplay();
            saveScores();
            gameActive = false;
            winningCombination.forEach(index => cells[index].classList.add('winning-cell'));
            restartButton.classList.add('pulse');
            updateStatus();
            return;
        }

        if (!gameState.includes("")) {
            gameActive = false;
            restartButton.classList.add('pulse');
            updateStatus();
            return;
        }

        handlePlayerChange();
    }
    
    function updateStatus() {
        if (!gameActive) {
            if (!gameState.includes("")) {
                statusDisplay.textContent = "It's a draw!";
            } else {
                let winnerName = "";
                if (gameMode === 'vs-cpu') {
                    winnerName = currentPlayer === 'X' ? 'You' : 'CPU';
                } else if (gameMode === 'multiplayer') {
                    winnerName = currentPlayer === playerSymbol ? 'You' : 'Your Opponent';
                } else if (gameMode === 'local-multiplayer') {
                    winnerName = `Player ${currentPlayer}`;
                }
                statusDisplay.innerHTML = `${winnerName} won!`;
            }
        } else {
            let turnName = "";
            if (gameMode === 'vs-cpu') {
                turnName = currentPlayer === 'X' ? "Your" : "CPU's";
            } else if (gameMode === 'multiplayer') {
                turnName = currentPlayer === playerSymbol ? 'Your' : "Opponent's";
            } else if (gameMode === 'local-multiplayer') {
                turnName = `Player ${currentPlayer}'s`;
            }
            statusDisplay.innerHTML = `${turnName} turn`;
        }
    }

    function handleCellClick(event) {
        if (!gameActive) return;
        const clickedCell = event.currentTarget;
        const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

        // Prevent human from playing during CPU's turn
        if (gameMode === 'vs-cpu' && currentPlayer === 'O') {
            return;
        }

        if(gameMode === 'multiplayer') {
            if (currentPlayer !== playerSymbol) {
                // Not your turn
                return;
            }
            if (gameState[clickedCellIndex] === "") {
                channel.postMessage({type: 'move', index: clickedCellIndex});
            }
        }
        handleCellPlayed(clickedCellIndex);
    }

    function handleRestartGame() {
        if(gameMode === 'multiplayer' && channel) {
            channel.postMessage({type: 'restart'});
        }
        resetBoard();
    }

    function resetBoard() {
        restartButton.classList.remove('pulse');
        gameActive = true;
        currentPlayer = "X";
        gameState = ["", "", "", "", "", "", "", "", ""];
        cells.forEach(cell => {
            cell.innerHTML = "";
            cell.classList.remove('x', 'o', 'winning-cell');
            cell.removeAttribute('disabled');
        });
        updateStatus();
    }
    
    function handleResetScore() {
        score.X = 0;
        score.O = 0;
        updateScoreDisplay();
        saveScores();
    }

    // --- Mode Setup ---
    function setupVsCpu() {
        gameMode = 'vs-cpu';
        playerXLabel.textContent = 'X (You)';
        playerOLabel.textContent = 'O (CPU)';
        resetBoard();
        showScreen('game');
    }

    function setupLocalMultiplayer() {
        gameMode = 'local-multiplayer';
        playerXLabel.textContent = 'Player X';
        playerOLabel.textContent = 'Player O';
        resetBoard();
        showScreen('game');
    }

    function setupMultiplayer() {
        gameMode = 'multiplayer';
        if (playerSymbol === 'X') {
            playerXLabel.innerHTML = `<span class="player-x">X (You)</span>`;
            playerOLabel.innerHTML = `<span class="player-o">O (Opponent)</span>`;
        } else {
            playerXLabel.innerHTML = `<span class="player-x">X (Opponent)</span>`;
            playerOLabel.innerHTML = `<span class="player-o">O (You)</span>`;
        }
        resetBoard();
        showScreen('game');
    }

    // --- Multiplayer (Broadcast Channel) ---
    function hostGame() {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        roomCodeDisplay.textContent = code;
        lobbyTitle.textContent = 'Host Game';
        hostView.classList.remove('hidden');
        joinView.classList.add('hidden');
        showScreen('lobby');

        channel = new BroadcastChannel(`tictactoe-${code}`);
        channel.onmessage = (event) => {
            if(event.data.type === 'join_request') {
                playerSymbol = 'X';
                channel.postMessage({type: 'join_accepted'});
                setupMultiplayer();
            }
            handleChannelMessage(event);
        };
    }

    function joinGameLobby() {
        lobbyTitle.textContent = 'Join Game';
        hostView.classList.add('hidden');
        joinView.classList.remove('hidden');
        showScreen('lobby');
    }

    function joinGame() {
        const code = roomCodeInput.value.toUpperCase();
        if(!code) return;

        joinRoomSubmitBtn.disabled = true;
        joinRoomSubmitBtn.textContent = 'Joining...';
        
        channel = new BroadcastChannel(`tictactoe-${code}`);
        
        let joinSuccessful = false;

        const joinTimeout = setTimeout(() => {
            if (!joinSuccessful) {
                channel.close();
                channel = null;
                alert('Invalid or expired room code. Please try again.');
                joinRoomSubmitBtn.disabled = false;
                joinRoomSubmitBtn.textContent = 'Join';
                roomCodeInput.value = '';
            }
        }, 3000);

        channel.onmessage = (event) => {
             if(event.data.type === 'join_accepted') {
                joinSuccessful = true;
                clearTimeout(joinTimeout);
                playerSymbol = 'O';
                setupMultiplayer();
            }
            handleChannelMessage(event);
        };
        channel.postMessage({type: 'join_request'});
    }
    
    function handleChannelMessage(event) {
        if (!channel) return;
        const { type, index } = event.data;
        if(type === 'move') {
            handleCellPlayed(index);
        } else if (type === 'restart') {
            resetBoard();
            statusDisplay.textContent = 'Opponent started a new round!';
        } else if (type === 'leave') {
            if (gameMode === 'multiplayer') {
                alert('Your opponent has left the game. Returning to menu.');
                cleanupAndGoToMenu();
            }
        }
    }
    
    function cleanupAndGoToMenu() {
        if (channel) {
            channel.onmessage = null; // Detach listener
            channel.close();
            channel = null;
        }
        gameMode = null;
        playerSymbol = 'X';
        resetBoard();
        handleResetScore(); // Reset score when returning to menu
        showScreen('menu');
    }

    function returnToMenu() {
        if (gameMode === 'multiplayer' && channel) {
            channel.postMessage({type: 'leave'});
        }
        cleanupAndGoToMenu();
    }

    // --- Event Listeners ---
    playVsCpuBtn.addEventListener('click', setupVsCpu);
    play2PlayerBtn.addEventListener('click', setupLocalMultiplayer);
    hostGameBtn.addEventListener('click', hostGame);
    joinGameBtn.addEventListener('click', joinGameLobby);
    joinRoomSubmitBtn.addEventListener('click', joinGame);
    backToMenuBtn.addEventListener('click', returnToMenu);

    copyCodeBtn.addEventListener('click', () => {
        const code = roomCodeDisplay.textContent;
        if (navigator.clipboard && code) {
            navigator.clipboard.writeText(code).then(() => {
                const originalText = waitingMsg.textContent;
                waitingMsg.textContent = 'Code Copied!';
                copyCodeBtn.disabled = true;
                setTimeout(() => {
                    waitingMsg.textContent = originalText;
                    copyCodeBtn.disabled = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Could not copy code.');
            });
        }
    });

    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    restartButton.addEventListener('click', handleRestartGame);
    resetScoreButton.addEventListener('click', handleResetScore);
    mainMenuButton.addEventListener('click', returnToMenu);

    // --- Initial Load ---
    updateScoreDisplay();
    showScreen('menu');
});