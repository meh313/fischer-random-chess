/**
 * Chess960 (Fischer Random Chess) game logic
 */

// Piece types
const PIECE = {
    KING: 'k',
    QUEEN: 'q',
    ROOK: 'r',
    BISHOP: 'b',
    KNIGHT: 'n',
    PAWN: 'p'
};

// Colors
const COLOR = {
    WHITE: 'w',
    BLACK: 'b'
};

class Chess {
    constructor() {
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        this.currentPlayer = COLOR.WHITE;
        this.moveHistory = [];
        this.gameOver = false;
        this.gameResult = null;
        this.startPosition = null;
    }

    /**
     * Initialize a new Chess960 position
     * @returns {string} FEN notation of the starting position
     */
    initializeChess960() {
        // Clear the board
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        this.currentPlayer = COLOR.WHITE;
        this.moveHistory = [];
        this.gameOver = false;
        this.gameResult = null;

        // Generate random position for Chess960
        const backrank = this.generateChess960Position();
        this.startPosition = backrank;

        // Set up white pieces (bottom rank)
        for (let i = 0; i < 8; i++) {
            this.board[7][i] = { type: backrank[i], color: COLOR.WHITE };
            this.board[6][i] = { type: PIECE.PAWN, color: COLOR.WHITE };
        }

        // Set up black pieces (top rank)
        for (let i = 0; i < 8; i++) {
            this.board[0][i] = { type: backrank[i], color: COLOR.BLACK };
            this.board[1][i] = { type: PIECE.PAWN, color: COLOR.BLACK };
        }

        return this.generateFEN();
    }

    /**
     * Generate a valid Chess960 starting position
     * @returns {Array} Array of piece types representing the backrank
     */
    generateChess960Position() {
        // Following Fischer Random Chess rules:
        // 1. Bishops must be on opposite-colored squares
        // 2. King must be between the rooks
        // 3. The remaining pieces can be placed randomly

        let backrank = Array(8).fill(null);
        
        // 1. Place bishops on opposite colored squares
        const bishopDarkPos = this.getRandomPosition([0, 2, 4, 6]); // Dark squares
        const bishopLightPos = this.getRandomPosition([1, 3, 5, 7]); // Light squares
        backrank[bishopDarkPos] = PIECE.BISHOP;
        backrank[bishopLightPos] = PIECE.BISHOP;
        
        // 2. Place the queen in a random empty position
        const queenPos = this.getRandomEmptyPosition(backrank);
        backrank[queenPos] = PIECE.QUEEN;
        
        // 3. Place knights in random empty positions
        const knight1Pos = this.getRandomEmptyPosition(backrank);
        backrank[knight1Pos] = PIECE.KNIGHT;
        
        const knight2Pos = this.getRandomEmptyPosition(backrank);
        backrank[knight2Pos] = PIECE.KNIGHT;
        
        // 4. Place rooks and king:
        // - Find the remaining 3 empty positions
        const emptyPositions = [];
        for (let i = 0; i < 8; i++) {
            if (backrank[i] === null) {
                emptyPositions.push(i);
            }
        }
        
        // - Place the rooks at the first and last empty position
        backrank[emptyPositions[0]] = PIECE.ROOK;
        backrank[emptyPositions[2]] = PIECE.ROOK;
        
        // - Place the king in the middle empty position
        backrank[emptyPositions[1]] = PIECE.KING;
        
        return backrank;
    }

    /**
     * Get a random position from an array of positions
     * @param {Array} positions Array of possible positions
     * @returns {number} Random position
     */
    getRandomPosition(positions) {
        const randomIndex = Math.floor(Math.random() * positions.length);
        return positions[randomIndex];
    }

    /**
     * Get a random empty position on the backrank
     * @param {Array} backrank Current backrank configuration
     * @returns {number} Random empty position
     */
    getRandomEmptyPosition(backrank) {
        const emptyPositions = [];
        for (let i = 0; i < 8; i++) {
            if (backrank[i] === null) {
                emptyPositions.push(i);
            }
        }
        return this.getRandomPosition(emptyPositions);
    }

    /**
     * Generate FEN (Forsyth–Edwards Notation) for the current board position
     * @returns {string} FEN notation
     */
    generateFEN() {
        let fen = '';
        
        // Board position
        for (let rank = 0; rank < 8; rank++) {
            let emptyCount = 0;
            
            for (let file = 0; file < 8; file++) {
                const piece = this.board[rank][file];
                
                if (piece === null) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    
                    let pieceChar = piece.type;
                    if (piece.color === COLOR.WHITE) {
                        pieceChar = pieceChar.toUpperCase();
                    }
                    
                    fen += pieceChar;
                }
            }
            
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            
            if (rank < 7) {
                fen += '/';
            }
        }
        
        // Active color
        fen += ' ' + this.currentPlayer;
        
        // Castling availability (simplified for now)
        fen += ' KQkq';
        
        // En passant target square (simplified for now)
        fen += ' -';
        
        // Halfmove clock and fullmove number (simplified for now)
        fen += ' 0 1';
        
        return fen;
    }

    /**
     * Get all valid moves for a specific piece
     * @param {number} row Row index of the piece
     * @param {number} col Column index of the piece
     * @returns {Array} Array of valid moves as [row, col] coordinates
     */
    getValidMoves(row, col) {
        const piece = this.board[row][col];
        
        if (!piece || piece.color !== this.currentPlayer) {
            return [];
        }
        
        const moves = [];
        
        switch (piece.type) {
            case PIECE.PAWN:
                this.getPawnMoves(row, col, moves);
                break;
            case PIECE.KNIGHT:
                this.getKnightMoves(row, col, moves);
                break;
            case PIECE.BISHOP:
                this.getBishopMoves(row, col, moves);
                break;
            case PIECE.ROOK:
                this.getRookMoves(row, col, moves);
                break;
            case PIECE.QUEEN:
                this.getQueenMoves(row, col, moves);
                break;
            case PIECE.KING:
                this.getKingMoves(row, col, moves);
                break;
        }
        
        return moves;
    }

    /**
     * Get all valid pawn moves
     * @param {number} row Row index of the pawn
     * @param {number} col Column index of the pawn
     * @param {Array} moves Array to store valid moves
     */
    getPawnMoves(row, col, moves) {
        const piece = this.board[row][col];
        const direction = piece.color === COLOR.WHITE ? -1 : 1;
        
        // Forward move
        if (this.isWithinBoard(row + direction, col) && 
            this.board[row + direction][col] === null) {
            moves.push([row + direction, col]);
            
            // Double move from starting position
            const startRow = piece.color === COLOR.WHITE ? 6 : 1;
            if (row === startRow && 
                this.board[row + 2 * direction][col] === null) {
                moves.push([row + 2 * direction, col]);
            }
        }
        
        // Captures
        const captureOffsets = [-1, 1];
        for (const offset of captureOffsets) {
            const newCol = col + offset;
            if (this.isWithinBoard(row + direction, newCol)) {
                const targetPiece = this.board[row + direction][newCol];
                if (targetPiece && targetPiece.color !== piece.color) {
                    moves.push([row + direction, newCol]);
                }
            }
        }
        
        // TODO: Add en passant and promotion
    }

    /**
     * Get all valid knight moves
     * @param {number} row Row index of the knight
     * @param {number} col Column index of the knight
     * @param {Array} moves Array to store valid moves
     */
    getKnightMoves(row, col, moves) {
        const piece = this.board[row][col];
        const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        for (const [rowOffset, colOffset] of offsets) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;
            
            if (this.isWithinBoard(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (targetPiece === null || targetPiece.color !== piece.color) {
                    moves.push([newRow, newCol]);
                }
            }
        }
    }

    /**
     * Get all valid bishop moves
     * @param {number} row Row index of the bishop
     * @param {number} col Column index of the bishop
     * @param {Array} moves Array to store valid moves
     */
    getBishopMoves(row, col, moves) {
        const directions = [
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];
        
        this.getSlidingMoves(row, col, directions, moves);
    }

    /**
     * Get all valid rook moves
     * @param {number} row Row index of the rook
     * @param {number} col Column index of the rook
     * @param {Array} moves Array to store valid moves
     */
    getRookMoves(row, col, moves) {
        const directions = [
            [-1, 0], [0, -1], [0, 1], [1, 0]
        ];
        
        this.getSlidingMoves(row, col, directions, moves);
    }

    /**
     * Get all valid queen moves
     * @param {number} row Row index of the queen
     * @param {number} col Column index of the queen
     * @param {Array} moves Array to store valid moves
     */
    getQueenMoves(row, col, moves) {
        const directions = [
            [-1, -1], [-1, 0], [-1, 1], [0, -1],
            [0, 1], [1, -1], [1, 0], [1, 1]
        ];
        
        this.getSlidingMoves(row, col, directions, moves);
    }

    /**
     * Get all valid king moves
     * @param {number} row Row index of the king
     * @param {number} col Column index of the king
     * @param {Array} moves Array to store valid moves
     */
    getKingMoves(row, col, moves) {
        const piece = this.board[row][col];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1], [0, -1],
            [0, 1], [1, -1], [1, 0], [1, 1]
        ];
        
        for (const [rowOffset, colOffset] of directions) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;
            
            if (this.isWithinBoard(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (targetPiece === null || targetPiece.color !== piece.color) {
                    moves.push([newRow, newCol]);
                }
            }
        }
        
        // TODO: Add castling
    }

    /**
     * Get all valid sliding moves (for bishop, rook, queen)
     * @param {number} row Starting row
     * @param {number} col Starting column
     * @param {Array} directions Array of [rowOffset, colOffset] directions
     * @param {Array} moves Array to store valid moves
     */
    getSlidingMoves(row, col, directions, moves) {
        const piece = this.board[row][col];
        
        for (const [rowDir, colDir] of directions) {
            let newRow = row + rowDir;
            let newCol = col + colDir;
            
            while (this.isWithinBoard(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                
                if (targetPiece === null) {
                    // Empty square, can move
                    moves.push([newRow, newCol]);
                } else if (targetPiece.color !== piece.color) {
                    // Enemy piece, can capture and stop
                    moves.push([newRow, newCol]);
                    break;
                } else {
                    // Friendly piece, stop
                    break;
                }
                
                newRow += rowDir;
                newCol += colDir;
            }
        }
    }

    /**
     * Check if coordinates are within the board boundaries
     * @param {number} row Row index
     * @param {number} col Column index
     * @returns {boolean} True if coordinates are valid
     */
    isWithinBoard(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    /**
     * Make a move on the board
     * @param {number} fromRow Source row
     * @param {number} fromCol Source column
     * @param {number} toRow Target row
     * @param {number} toCol Target column
     * @returns {boolean} True if the move was successful
     */
    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        
        if (!piece || piece.color !== this.currentPlayer) {
            return false;
        }
        
        const validMoves = this.getValidMoves(fromRow, fromCol);
        const isValidMove = validMoves.some(([row, col]) => row === toRow && col === toCol);
        
        if (!isValidMove) {
            return false;
        }
        
        // Store move in history
        const capturedPiece = this.board[toRow][toCol];
        this.moveHistory.push({
            piece: piece,
            from: [fromRow, fromCol],
            to: [toRow, toCol],
            captured: capturedPiece
        });
        
        // Make the move
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Check for pawn promotion
        if (piece.type === PIECE.PAWN && (toRow === 0 || toRow === 7)) {
            // Auto-promote to queen for simplicity
            this.board[toRow][toCol] = { type: PIECE.QUEEN, color: piece.color };
        }
        
        // Switch player
        this.currentPlayer = this.currentPlayer === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
        
        // TODO: Check for check/checkmate/stalemate
        
        return true;
    }

    /**
     * Get the current player's color
     * @returns {string} Current player's color
     */
    getCurrentPlayer() {
        return this.currentPlayer;
    }

    /**
     * Get the piece at the specified position
     * @param {number} row Row index
     * @param {number} col Column index
     * @returns {Object|null} Piece object or null if empty
     */
    getPieceAt(row, col) {
        return this.board[row][col];
    }

    /**
     * Check if the game is over
     * @returns {boolean} True if the game is over
     */
    isGameOver() {
        return this.gameOver;
    }

    /**
     * Get the game result
     * @returns {string|null} Game result or null if the game is not over
     */
    getGameResult() {
        return this.gameResult;
    }

    /**
     * Get the move history
     * @returns {Array} Array of move objects
     */
    getMoveHistory() {
        return this.moveHistory;
    }

    /**
     * Get the starting position
     * @returns {Array} Starting position as an array of piece types
     */
    getStartPosition() {
        return this.startPosition;
    }
} 