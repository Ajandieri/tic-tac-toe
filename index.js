
import { GoogleGenAI, Type } from "@google/genai";
import mqtt from 'mqtt';

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
    
    // --- Multiplayer State ---
    const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
    let client = null;
    let roomCode = null;

    // Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash';

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
            // Disable board during AI turn to prevent user input
            cells.forEach(cell => cell.setAttribute('disabled', 'true'));
            getComputerMove();
        }
    }

    async function getComputerMove() {
        statusDisplay.textContent = 'Computer is thinking...';
        
        const prompt = `You are a medium-level Tic-Tac-Toe AI opponent. It's your turn to play as 'O'. The board is represented by this array: ${JSON.stringify(gameState)}. 'X' is the human opponent. Empty strings "" are available squares (indices 0-8). Your goal is to play well, blocking wins and taking opportunities to win yourself, but you don't need to play with flawless, perfect logic every single time. A smart, but not perfect, move is ideal. Return your move as a JSON object with a single "move" key, indicating the index of your chosen square (0-8). Only choose an index that corresponds to an empty string in the board array.`;
        
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            move: {
                                type: Type.INTEGER,
                                description: 'The board index (0-8) for the AI\'s move.'
                            }
                        },
                        required: ['move']
                    }
                }
            });

            const jsonResponse = JSON.parse(response.text);
            const move = jsonResponse.move;

            if (typeof move === 'number' && move >= 0 && move <= 8 && gameState[move] === "") {
                handleCellPlayed(move);
            } else {
                // Fallback if AI gives invalid move
                makeRandomValidMove();
            }
        } catch (error) {
            console.error("AI Error:", error);
            statusDisplay.textContent = 'The AI is stumped! Making a random move.';
            makeRandomValidMove();
        } finally {
            // Re-enable board after AI move
            cells.forEach(cell => cell.removeAttribute('disabled'));
        }
    }

    function makeRandomValidMove() {
        const availableCells = gameState.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
        if (availableCells.length > 0) {
            const randomMove = availableCells[Math.floor(Math.random() * availableCells.length)];
            handleCellPlayed(randomMove);
        }
    }

    function handleResultValidation() {
        let roundWon = false;
        let winningCombination = [];
        for (let i = 0; i < winningConditions.length; i++) {
            const winCondition = winningConditions[i];
            const a = gameState[winCondition[0]];
            const b = gameState[winCondition[1]];
            const c = gameState[winCondition[2]];
            if (a === '' || b === '' || c === '') continue;
            if (a === b && b === c) {
                roundWon = true;
                winningCombination = winCondition;
                break;
            }
        }

        if (roundWon) {
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

        if(gameMode === 'multiplayer') {
            if (currentPlayer !== playerSymbol) {
                // Not your turn
                return;
            }
            if (gameState[clickedCellIndex] === "") {
                client.publish(`tictactoe-game/${roomCode}`, JSON.stringify({type: 'move', index: clickedCellIndex}));
            }
        }
        handleCellPlayed(clickedCellIndex);
    }

    function handleRestartGame() {
        if(gameMode === 'multiplayer' && client) {
            client.publish(`tictactoe-game/${roomCode}`, JSON.stringify({type: 'restart'}));
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
        updateStatus(); // Update status after resetting state
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

    // --- Multiplayer (MQTT) ---
    function mqttGameMessageHandler(topic, payload) {
        if (topic !== `tictactoe-game/${roomCode}`) return;
        const message = JSON.parse(payload.toString());
        handleRemoteMessage(message);
    }

    function handleRemoteMessage(data) {
        if (!client) return;
        const { type, index } = data;
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

    function hostGame() {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        roomCodeDisplay.textContent = code;
        lobbyTitle.textContent = 'Host Game';
        hostView.classList.remove('hidden');
        joinView.classList.add('hidden');
        showScreen('lobby');

        roomCode = code;
        const topic = `tictactoe-game/${roomCode}`;
        client = mqtt.connect(brokerUrl);

        const hostInitialMessageHandler = (receivedTopic, payload) => {
            if (receivedTopic !== topic) return;
            const message = JSON.parse(payload.toString());

            if (message.type === 'join_request') {
                playerSymbol = 'X';
                client.publish(topic, JSON.stringify({type: 'join_accepted'}));
                client.off('message', hostInitialMessageHandler);
                client.on('message', mqttGameMessageHandler);
                setupMultiplayer();
            }
        };

        client.on('connect', () => {
            client.subscribe(topic, (err) => {
                if (err) {
                    console.error('MQTT Subscribe error:', err);
                    alert('Error hosting game. Please try again.');
                    cleanupAndGoToMenu();
                }
            });
        });

        client.on('message', hostInitialMessageHandler);

        client.on('error', (err) => {
            console.error('MQTT Connection Error:', err);
            alert('Could not connect to the game service. Please check your internet connection and try again.');
            cleanupAndGoToMenu();
        });
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
        
        roomCode = code;
        const topic = `tictactoe-game/${roomCode}`;
        client = mqtt.connect(brokerUrl);
        
        let joinSuccessful = false;

        const joinTimeout = setTimeout(() => {
            if (!joinSuccessful) {
                if(client) client.end();
                client = null;
                alert('Invalid or expired room code. Please try again.');
                joinRoomSubmitBtn.disabled = false;
                joinRoomSubmitBtn.textContent = 'Join';
                roomCodeInput.value = '';
            }
        }, 5000);

        const joinerInitialMessageHandler = (receivedTopic, payload) => {
            if (receivedTopic !== topic) return;
            const message = JSON.parse(payload.toString());
            if (message.type === 'join_accepted') {
                joinSuccessful = true;
                clearTimeout(joinTimeout);
                playerSymbol = 'O';
                client.off('message', joinerInitialMessageHandler);
                client.on('message', mqttGameMessageHandler);
                setupMultiplayer();
            }
        };

        client.on('connect', () => {
            client.subscribe(topic, (err) => {
                if(err) {
                    console.error('MQTT Subscribe error:', err);
                    clearTimeout(joinTimeout);
                    alert('Error joining game. Please try again.');
                    cleanupAndGoToMenu();
                    return;
                }
                client.publish(topic, JSON.stringify({type: 'join_request'}));
            });
        });

        client.on('message', joinerInitialMessageHandler);
        
        client.on('error', (err) => {
            console.error('MQTT Connection Error:', err);
            clearTimeout(joinTimeout);
            alert('Could not connect to the game service. Please check the room code and try again.');
            joinRoomSubmitBtn.disabled = false;
            joinRoomSubmitBtn.textContent = 'Join';
            cleanupAndGoToMenu();
        });
    }
        
    function cleanupAndGoToMenu() {
        if (client) {
            client.end();
            client = null;
        }
        gameMode = null;
        roomCode = null;
        playerSymbol = 'X';
        resetBoard();
        handleResetScore(); // Reset score when returning to menu
        showScreen('menu');
        joinRoomSubmitBtn.disabled = false;
        joinRoomSubmitBtn.textContent = 'Join';
    }

    function returnToMenu() {
        if (gameMode === 'multiplayer' && client && roomCode) {
            client.publish(`tictactoe-game/${roomCode}`, JSON.stringify({type: 'leave'}));
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