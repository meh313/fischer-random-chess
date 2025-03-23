/**
 * Game manager connecting chess logic, board UI, and multiplayer
 */

class Game {
    constructor() {
        this.chess = new Chess();
        this.boardUI = null;
        this.socket = new GameSocket(this);
        this.playerColor = COLOR.WHITE; // Default player color
        this.isMultiplayer = false;
        this.gameStarted = false;
        
        // Connect to the game server
        this.socket.connect();
    }

    /**
     * Initialize the game
     * @param {Element} boardContainer Board container element
     */
    initialize(boardContainer) {
        // Generate a new Chess960 position
        this.chess.initializeChess960();
        
        // Initialize the board UI
        this.boardUI = new ChessBoard(boardContainer, this.chess);
        this.boardUI.updateBoard();
        
        // Set up game controls
        this.setupGameControls();
    }

    /**
     * Set up game control buttons
     */
    setupGameControls() {
        // New game button
        const newGameBtn = document.getElementById('new-game-btn');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => this.startNewGame());
        }
        
        // Invite button
        const inviteBtn = document.getElementById('invite-btn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => this.showInviteModal());
        }
        
        // Resign button
        const resignBtn = document.getElementById('resign-btn');
        if (resignBtn) {
            resignBtn.addEventListener('click', () => this.resignGame());
        }
        
        // Draw button
        const drawBtn = document.getElementById('draw-btn');
        if (drawBtn) {
            drawBtn.addEventListener('click', () => this.offerDraw());
        }
        
        // Copy link button
        const copyLinkBtn = document.getElementById('copy-link-btn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => this.copyInviteLink());
        }
        
        // Close modal button
        const closeModal = document.querySelector('.close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideInviteModal());
        }
    }

    /**
     * Start a new game
     * @param {boolean} multiplayer Whether to start a multiplayer game
     */
    startNewGame(multiplayer = false) {
        // Reset game state
        this.chess.initializeChess960();
        this.boardUI.resetBoard();
        this.gameStarted = true;
        
        // Update game status
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Game in progress';
        }
        
        if (multiplayer) {
            this.isMultiplayer = true;
            
            // Create a new multiplayer game
            const gameId = this.socket.createGame();
            
            // Show invite modal
            this.showInviteModal();
        } else {
            this.isMultiplayer = false;
        }
    }

    /**
     * Show the invite modal
     */
    showInviteModal() {
        // If not already in a game, create one
        if (!this.socket.isConnectedToGame()) {
            this.startNewGame(true);
        }
        
        // Get the invite link
        const inviteLink = this.socket.getInviteLink();
        
        // Update the invite link input
        const inviteLinkInput = document.getElementById('invite-link');
        if (inviteLinkInput) {
            inviteLinkInput.value = inviteLink;
        }
        
        // Show the modal
        const modal = document.getElementById('invite-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * Hide the invite modal
     */
    hideInviteModal() {
        const modal = document.getElementById('invite-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Copy the invite link to clipboard
     */
    copyInviteLink() {
        const inviteLinkInput = document.getElementById('invite-link');
        if (!inviteLinkInput) return;
        
        // Select the text field
        inviteLinkInput.select();
        inviteLinkInput.setSelectionRange(0, 99999); // For mobile devices
        
        // Copy the text inside the text field
        try {
            navigator.clipboard.writeText(inviteLinkInput.value);
            
            // Visual feedback
            const copyBtn = document.getElementById('copy-link-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            
            // Fallback
            document.execCommand('copy');
        }
    }

    /**
     * Handle joining a multiplayer game
     * @param {boolean} isHost Whether the player is the host
     */
    onJoinGame(isHost) {
        this.isMultiplayer = true;
        this.gameStarted = true;
        
        if (!isHost) {
            // If not the host, play as black
            this.playerColor = COLOR.BLACK;
            
            // Update game status
            const gameStatusElement = document.getElementById('game-status');
            if (gameStatusElement) {
                gameStatusElement.textContent = 'Game in progress';
            }
        }
    }

    /**
     * Handle receiving a move from the opponent
     * @param {Object} moveData Move data
     */
    onReceivedMove(moveData) {
        // Apply the move to the local game
        const { fromRow, fromCol, toRow, toCol } = moveData;
        
        // Make the move
        this.chess.makeMove(fromRow, fromCol, toRow, toCol);
        
        // Update the board
        this.boardUI.updateBoard();
        
        // Announce the move
        this.boardUI.announceMove(fromRow, fromCol, toRow, toCol);
        
        // Check game state
        this.boardUI.checkGameState();
    }

    /**
     * Handle making a move in the game
     * @param {number} fromRow Source row
     * @param {number} fromCol Source column
     * @param {number} toRow Target row
     * @param {number} toCol Target column
     * @returns {boolean} True if the move was successful
     */
    makeMove(fromRow, fromCol, toRow, toCol) {
        // Check if it's the player's turn in multiplayer mode
        if (this.isMultiplayer && this.chess.getCurrentPlayer() !== this.playerColor) {
            return false;
        }
        
        // Make the move
        const moveResult = this.chess.makeMove(fromRow, fromCol, toRow, toCol);
        
        if (moveResult && this.isMultiplayer) {
            // Send the move to the opponent
            this.socket.sendMove({
                fromRow,
                fromCol,
                toRow,
                toCol
            });
        }
        
        return moveResult;
    }

    /**
     * Resign the current game
     */
    resignGame() {
        if (!this.gameStarted) return;
        
        // Update game status
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            const resigningPlayer = this.chess.getCurrentPlayer() === COLOR.WHITE ? 'White' : 'Black';
            gameStatusElement.textContent = `${resigningPlayer} resigned`;
        }
        
        // Mark game as over
        this.chess.gameOver = true;
        this.chess.gameResult = this.chess.getCurrentPlayer() === COLOR.WHITE 
            ? 'Black wins by resignation' 
            : 'White wins by resignation';
        
        this.gameStarted = false;
        
        // Notify opponent in multiplayer mode
        if (this.isMultiplayer) {
            // In a real implementation, we would send a resignation message
        }
    }

    /**
     * Offer a draw to the opponent
     */
    offerDraw() {
        if (!this.gameStarted) return;
        
        if (this.isMultiplayer) {
            // In a real implementation, we would send a draw offer message
            // For now, we'll just show an alert
            alert('Draw offer sent to opponent');
        } else {
            // In single-player mode, automatically accept the draw
            this.acceptDraw();
        }
    }

    /**
     * Accept a draw offer
     */
    acceptDraw() {
        // Update game status
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Game drawn by agreement';
        }
        
        // Mark game as over
        this.chess.gameOver = true;
        this.chess.gameResult = 'Draw by agreement';
        
        this.gameStarted = false;
    }

    /**
     * Get the current player color
     * @returns {string} Current player color
     */
    getPlayerColor() {
        return this.playerColor;
    }

    /**
     * Check if the game is in multiplayer mode
     * @returns {boolean} True if in multiplayer mode
     */
    isMultiplayerMode() {
        return this.isMultiplayer;
    }

    /**
     * Check if the game has started
     * @returns {boolean} True if the game has started
     */
    hasGameStarted() {
        return this.gameStarted;
    }
} 