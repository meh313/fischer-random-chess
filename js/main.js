/**
 * Main application entry point for Fischer Random Chess (Chess960)
 */

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get the chessboard container
    const chessboardContainer = document.getElementById('chessboard');
    
    if (!chessboardContainer) {
        console.error('Chessboard container not found');
        return;
    }
    
    // Initialize the game
    const game = new Game();
    game.initialize(chessboardContainer);
    
    // Global game instance for debugging
    window.game = game;
    
    // Update game status
    const gameStatusElement = document.getElementById('game-status');
    if (gameStatusElement) {
        gameStatusElement.textContent = 'Ready to play';
    }
    
    // Log the starting position
    console.log('Starting position:', game.chess.getStartPosition());
    
    // Display the starting position type (for chess960 enthusiasts)
    const startPos = game.chess.getStartPosition();
    if (startPos) {
        // Find the position number (0-959)
        // This is a simplified calculation and may not be accurate for all positions
        const posNumber = Chess960PositionToNumber(startPos);
        console.log('Chess960 Position Number (approximate):', posNumber);
    }
});

/**
 * Convert a Chess960 position to its position number (0-959)
 * Note: This is a simplified implementation and may not be accurate for all positions
 * @param {Array} position Array of piece types representing the backrank
 * @returns {number} Position number (0-959) or -1 if invalid
 */
function Chess960PositionToNumber(position) {
    // This is a simplified calculation and not fully accurate
    // A complete implementation would use a lookup table or more complex algorithm
    // based on the exact rules of Chess960 position numbering
    
    try {
        // Find bishop positions
        const bishopPositions = [];
        for (let i = 0; i < position.length; i++) {
            if (position[i] === PIECE.BISHOP) {
                bishopPositions.push(i);
            }
        }
        
        // Check if bishops are on opposite colors
        const bishop1Parity = bishopPositions[0] % 2;
        const bishop2Parity = bishopPositions[1] % 2;
        
        if (bishop1Parity === bishop2Parity) {
            return -1; // Invalid - bishops must be on opposite colors
        }
        
        // Find queen position
        let queenPos = -1;
        for (let i = 0; i < position.length; i++) {
            if (position[i] === PIECE.QUEEN) {
                queenPos = i;
                break;
            }
        }
        
        // Find knight positions
        const knightPositions = [];
        for (let i = 0; i < position.length; i++) {
            if (position[i] === PIECE.KNIGHT) {
                knightPositions.push(i);
            }
        }
        
        // Find rook and king positions
        const rookPositions = [];
        let kingPos = -1;
        for (let i = 0; i < position.length; i++) {
            if (position[i] === PIECE.ROOK) {
                rookPositions.push(i);
            } else if (position[i] === PIECE.KING) {
                kingPos = i;
            }
        }
        
        // Check if king is between rooks
        if (!(kingPos > rookPositions[0] && kingPos < rookPositions[1])) {
            return -1; // Invalid - king must be between rooks
        }
        
        // Calculate a hash for the position
        // This is a very simplified version and not the official numbering
        let hash = 0;
        hash += bishopPositions[0] * 10 + bishopPositions[1];
        hash += queenPos * 100;
        hash += knightPositions[0] * 1000 + knightPositions[1] * 10000;
        hash += rookPositions[0] * 100000 + kingPos * 1000000 + rookPositions[1] * 10000000;
        
        // Take the modulo to get a number between 0 and 959
        return hash % 960;
    } catch (error) {
        console.error('Error calculating position number:', error);
        return -1;
    }
} 