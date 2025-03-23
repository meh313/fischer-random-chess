/**
 * Socket management for multiplayer functionality
 */

class GameSocket {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.gameId = null;
        this.playerId = null;
        this.isHost = false;
        this.connected = false;
        this.opponent = null;
    }

    /**
     * Connect to the game server
     */
    connect() {
        // For local development, we'll simulate the socket connection
        // In a real implementation, this would use WebSockets
        console.log('Connecting to game server...');
        
        // Simulate connection
        setTimeout(() => {
            this.connected = true;
            this.playerId = this.generatePlayerId();
            console.log('Connected to game server. Player ID:', this.playerId);
            
            // Set up event listeners
            this.setupEvents();
        }, 500);
    }

    /**
     * Set up event handling for socket messages
     */
    setupEvents() {
        // This would be implemented with actual socket events in a real app
        // For now, we'll simulate the events
        
        // Check for game ID in URL (for joining games)
        this.checkForGameInUrl();
    }

    /**
     * Check if there's a game ID in the URL to join
     */
    checkForGameInUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('game');
        
        if (gameId) {
            this.joinGame(gameId);
        }
    }

    /**
     * Create a new game
     * @returns {string} Game ID
     */
    createGame() {
        if (!this.connected) {
            console.error('Not connected to server');
            return null;
        }
        
        // Generate a game ID
        this.gameId = this.generateGameId();
        this.isHost = true;
        
        console.log('Created game with ID:', this.gameId);
        
        // Update game status
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Waiting for opponent...';
        }
        
        // Update game ID display
        const gameIdElement = document.getElementById('game-id');
        if (gameIdElement) {
            gameIdElement.textContent = `Game ID: ${this.gameId}`;
        }
        
        // In a real implementation, we would send a message to the server
        // For now, we'll simulate a server response
        
        return this.gameId;
    }

    /**
     * Join an existing game
     * @param {string} gameId Game ID to join
     * @returns {boolean} True if joined successfully
     */
    joinGame(gameId) {
        if (!this.connected) {
            console.error('Not connected to server');
            return false;
        }
        
        console.log('Joining game with ID:', gameId);
        
        // In a real implementation, we would send a join request to the server
        // and validate that the game exists
        
        // For now, we'll simulate a successful join
        this.gameId = gameId;
        this.isHost = false;
        
        // Update game status
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Connected to game';
        }
        
        // Update game ID display
        const gameIdElement = document.getElementById('game-id');
        if (gameIdElement) {
            gameIdElement.textContent = `Game ID: ${this.gameId}`;
        }
        
        // Simulate opponent (host) already being in the game
        this.opponent = {
            id: 'host-' + gameId,
            name: 'Opponent'
        };
        
        // Notify the game that we've joined
        this.game.onJoinGame(this.isHost);
        
        return true;
    }

    /**
     * Send a move to the opponent
     * @param {Object} move Move data
     */
    sendMove(move) {
        if (!this.connected || !this.gameId) {
            console.error('Not connected to a game');
            return;
        }
        
        console.log('Sending move:', move);
        
        // In a real implementation, we would send this move to the server
        // For now, we'll simulate the message being sent
        
        // Simulate a delay before the move reaches the opponent
        setTimeout(() => {
            // In a real app, this would happen on the opponent's device
            // after receiving the move via the server
            this.game.onReceivedMove(move);
        }, 100);
    }

    /**
     * Send a game state update
     * @param {Object} state Game state data
     */
    sendGameState(state) {
        if (!this.connected || !this.gameId) {
            console.error('Not connected to a game');
            return;
        }
        
        console.log('Sending game state:', state);
        
        // In a real implementation, we would send this state to the server
        // For now, we'll simulate the message being sent
    }

    /**
     * Send a chat message
     * @param {string} message Chat message
     */
    sendChatMessage(message) {
        if (!this.connected || !this.gameId) {
            console.error('Not connected to a game');
            return;
        }
        
        console.log('Sending chat message:', message);
        
        // In a real implementation, we would send this message to the server
        // For now, we'll simulate the message being sent
    }

    /**
     * Generate a unique player ID
     * @returns {string} Player ID
     */
    generatePlayerId() {
        return 'player-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a unique game ID
     * @returns {string} Game ID
     */
    generateGameId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    /**
     * Get the invite link for the current game
     * @returns {string} Invite link
     */
    getInviteLink() {
        if (!this.gameId) {
            return null;
        }
        
        return window.location.origin + window.location.pathname + '?game=' + this.gameId;
    }

    /**
     * Check if the player is the host
     * @returns {boolean} True if the player is the host
     */
    isGameHost() {
        return this.isHost;
    }

    /**
     * Check if connected to a game
     * @returns {boolean} True if connected to a game
     */
    isConnectedToGame() {
        return this.connected && this.gameId !== null;
    }

    /**
     * Get the current game ID
     * @returns {string} Game ID
     */
    getGameId() {
        return this.gameId;
    }
} 