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
        // Add tracking for castling rights and en passant
        this.castlingRights = {
            w: { kingSide: true, queenSide: true },
            b: { kingSide: true, queenSide: true }
        };
        this.enPassantTarget = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
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
        // Reset castling rights and en passant
        this.castlingRights = {
            w: { kingSide: true, queenSide: true },
            b: { kingSide: true, queenSide: true }
        };
        this.enPassantTarget = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;

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
        
        // Castling availability
        let castling = '';
        if (this.castlingRights.w.kingSide) castling += 'K';
        if (this.castlingRights.w.queenSide) castling += 'Q';
        if (this.castlingRights.b.kingSide) castling += 'k';
        if (this.castlingRights.b.queenSide) castling += 'q';
        fen += ' ' + (castling || '-');
        
        // En passant target square
        fen += ' ' + (this.enPassantTarget || '-');
        
        // Halfmove clock and fullmove number
        fen += ' ' + this.halfMoveClock + ' ' + this.fullMoveNumber;
        
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
        
        // Filter out moves that would leave the king in check
        return moves.filter(([toRow, toCol]) => {
            // Make a temporary move
            const originalPiece = this.board[toRow][toCol];
            const movingPiece = this.board[row][col];
            
            // Store original en passant state if this is a pawn move
            let capturedPawnPos = null;
            if (movingPiece.type === PIECE.PAWN && this.enPassantTarget &&
                toRow === this.enPassantTarget[0] && toCol === this.enPassantTarget[1]) {
                const captureRow = row;
                capturedPawnPos = [captureRow, toCol];
            }
            
            // Make the move
            this.board[toRow][toCol] = movingPiece;
            this.board[row][col] = null;
            
            // If this is an en passant capture, remove the captured pawn
            if (capturedPawnPos) {
                this.board[capturedPawnPos[0]][capturedPawnPos[1]] = null;
            }
            
            // Check if the king is in check after the move
            const isKingSafe = !this.isInCheck(piece.color);
            
            // Undo the move
            this.board[row][col] = movingPiece;
            this.board[toRow][toCol] = originalPiece;
            
            // Restore captured pawn if this was an en passant move
            if (capturedPawnPos) {
                this.board[capturedPawnPos[0]][capturedPawnPos[1]] = {
                    type: PIECE.PAWN,
                    color: piece.color === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE
                };
            }
            
            return isKingSafe;
        });
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
        
        // En passant captures
        if (this.enPassantTarget) {
            const [epRow, epCol] = this.enPassantTarget;
            if (row === (piece.color === COLOR.WHITE ? 3 : 4)) {
                if (Math.abs(col - epCol) === 1 && epRow === row + direction) {
                    moves.push([epRow, epCol]);
                }
            }
        }
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
                    // Only add the move if it doesn't put the king in check
                    if (!this.isSquareUnderAttack(newRow, newCol, piece.color)) {
                        moves.push([newRow, newCol]);
                    }
                }
            }
        }
        
        // Castling
        if (!this.isInCheck(piece.color)) {
            const rights = this.castlingRights[piece.color === COLOR.WHITE ? 'w' : 'b'];
            const rank = piece.color === COLOR.WHITE ? 7 : 0;
            
            // Find rook positions (Chess960)
            let kingStartCol = col;
            let kingSideRookCol = -1;
            let queenSideRookCol = -1;
            
            for (let i = 0; i < 8; i++) {
                const p = this.board[rank][i];
                if (p && p.type === PIECE.ROOK && p.color === piece.color) {
                    if (i > kingStartCol && kingSideRookCol === -1) {
                        kingSideRookCol = i;
                    } else if (i < kingStartCol) {
                        queenSideRookCol = i;
                    }
                }
            }
            
            // Kingside castling
            if (rights.kingSide && kingSideRookCol !== -1) {
                let canCastle = true;
                // Check if squares between king and rook are empty
                for (let i = kingStartCol + 1; i < kingSideRookCol; i++) {
                    if (this.board[rank][i] !== null || 
                        this.isSquareUnderAttack(rank, i, piece.color)) {
                        canCastle = false;
                        break;
                    }
                }
                if (canCastle) {
                    moves.push([rank, kingStartCol + 2]);
                }
            }
            
            // Queenside castling
            if (rights.queenSide && queenSideRookCol !== -1) {
                let canCastle = true;
                // Check if squares between king and rook are empty
                for (let i = queenSideRookCol + 1; i < kingStartCol; i++) {
                    if (this.board[rank][i] !== null || 
                        this.isSquareUnderAttack(rank, i, piece.color)) {
                        canCastle = false;
                        break;
                    }
                }
                if (canCastle) {
                    moves.push([rank, kingStartCol - 2]);
                }
            }
        }
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
        const moveEntry = {
            piece: piece,
            from: [fromRow, fromCol],
            to: [toRow, toCol],
            captured: capturedPiece,
            castling: null,
            enPassant: null,
            promotion: null
        };
        
        // Make the move
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Handle special moves
        if (piece.type === PIECE.PAWN) {
            // Reset halfmove clock on pawn move
            this.halfMoveClock = 0;
            
            // En passant capture
            if (this.enPassantTarget && 
                toRow === this.enPassantTarget[0] && 
                toCol === this.enPassantTarget[1]) {
                const captureRow = fromRow;
                this.board[captureRow][toCol] = null;
                moveEntry.enPassant = [captureRow, toCol];
            }
            
            // Set en passant target on double move
            if (Math.abs(toRow - fromRow) === 2) {
                this.enPassantTarget = [
                    (fromRow + toRow) / 2,
                    fromCol
                ];
            } else {
                this.enPassantTarget = null;
            }
            
            // Pawn promotion
            if (toRow === 0 || toRow === 7) {
                // Auto-promote to queen for simplicity
                this.board[toRow][toCol] = { type: PIECE.QUEEN, color: piece.color };
                moveEntry.promotion = PIECE.QUEEN;
            }
        } else {
            // Reset en passant target on non-pawn moves
            this.enPassantTarget = null;
            
            // Update halfmove clock
            if (capturedPiece) {
                this.halfMoveClock = 0;
            } else {
                this.halfMoveClock++;
            }
        }
        
        // Handle castling
        if (piece.type === PIECE.KING) {
            const rank = piece.color === COLOR.WHITE ? 7 : 0;
            if (Math.abs(toCol - fromCol) === 2) {
                // This is a castling move
                const isKingSide = toCol > fromCol;
                let rookFromCol, rookToCol;
                
                // Find the rook (Chess960 compatible)
                if (isKingSide) {
                    for (let i = fromCol + 1; i < 8; i++) {
                        const p = this.board[rank][i];
                        if (p && p.type === PIECE.ROOK && p.color === piece.color) {
                            rookFromCol = i;
                            break;
                        }
                    }
                    rookToCol = fromCol + 1;
                } else {
                    for (let i = fromCol - 1; i >= 0; i--) {
                        const p = this.board[rank][i];
                        if (p && p.type === PIECE.ROOK && p.color === piece.color) {
                            rookFromCol = i;
                            break;
                        }
                    }
                    rookToCol = fromCol - 1;
                }
                
                // Move the rook
                this.board[rank][rookToCol] = this.board[rank][rookFromCol];
                this.board[rank][rookFromCol] = null;
                moveEntry.castling = {
                    rook: {
                        from: [rank, rookFromCol],
                        to: [rank, rookToCol]
                    }
                };
            }
            
            // Remove castling rights
            const rights = this.castlingRights[piece.color === COLOR.WHITE ? 'w' : 'b'];
            rights.kingSide = false;
            rights.queenSide = false;
        }
        
        // Update castling rights if rook moves or is captured
        if (piece.type === PIECE.ROOK || 
            (capturedPiece && capturedPiece.type === PIECE.ROOK)) {
            const rank = fromRow;
            const col = capturedPiece ? toCol : fromCol;
            const color = capturedPiece ? capturedPiece.color : piece.color;
            const rights = this.castlingRights[color === COLOR.WHITE ? 'w' : 'b'];
            
            // Check if this was a starting position rook
            if (rank === (color === COLOR.WHITE ? 7 : 0)) {
                // Find king position to determine which side
                let kingCol = -1;
                for (let i = 0; i < 8; i++) {
                    const p = this.board[rank][i];
                    if (p && p.type === PIECE.KING && p.color === color) {
                        kingCol = i;
                        break;
                    }
                }
                
                if (kingCol !== -1) {
                    if (col > kingCol) {
                        rights.kingSide = false;
                    } else {
                        rights.queenSide = false;
                    }
                }
            }
        }
        
        // Store the move in history
        this.moveHistory.push(moveEntry);
        
        // Update move numbers
        if (this.currentPlayer === COLOR.BLACK) {
            this.fullMoveNumber++;
        }
        
        // Switch player
        this.currentPlayer = this.currentPlayer === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
        
        // Check for game end conditions
        this.checkGameEnd();
        
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

    /**
     * Check if a square is under attack by the opponent
     * @param {number} row Row index
     * @param {number} col Column index
     * @param {string} defendingColor Color of the defending side
     * @returns {boolean} True if the square is under attack
     */
    isSquareUnderAttack(row, col, defendingColor) {
        const attackingColor = defendingColor === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
        
        // Check for attacking pieces in all directions
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === attackingColor) {
                    // Get all possible moves for this piece
                    const moves = [];
                    switch (piece.type) {
                        case PIECE.PAWN:
                            // Special case for pawns - they attack diagonally
                            const direction = piece.color === COLOR.WHITE ? -1 : 1;
                            const attackCols = [c - 1, c + 1];
                            const attackRow = r + direction;
                            if (attackRow === row) {
                                if (attackCols.includes(col)) {
                                    return true;
                                }
                            }
                            break;
                        case PIECE.KNIGHT:
                            this.getKnightMoves(r, c, moves);
                            break;
                        case PIECE.BISHOP:
                            this.getBishopMoves(r, c, moves);
                            break;
                        case PIECE.ROOK:
                            this.getRookMoves(r, c, moves);
                            break;
                        case PIECE.QUEEN:
                            this.getQueenMoves(r, c, moves);
                            break;
                        case PIECE.KING:
                            // Use basic king moves without castling
                            const directions = [
                                [-1, -1], [-1, 0], [-1, 1], [0, -1],
                                [0, 1], [1, -1], [1, 0], [1, 1]
                            ];
                            for (const [rowOffset, colOffset] of directions) {
                                const newRow = r + rowOffset;
                                const newCol = c + colOffset;
                                if (this.isWithinBoard(newRow, newCol)) {
                                    moves.push([newRow, newCol]);
                                }
                            }
                            break;
                    }
                    
                    // Check if any of the moves attack the target square
                    if (moves.some(([r, c]) => r === row && c === col)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * Check if a player is in check
     * @param {string} color Color of the player to check
     * @returns {boolean} True if the player is in check
     */
    isInCheck(color) {
        // Find the king
        let kingRow = -1;
        let kingCol = -1;
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.type === PIECE.KING && piece.color === color) {
                    kingRow = r;
                    kingCol = c;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }
        
        return this.isSquareUnderAttack(kingRow, kingCol, color);
    }

    /**
     * Check if a player is in checkmate
     * @param {string} color Color of the player to check
     * @returns {boolean} True if the player is in checkmate
     */
    isInCheckmate(color) {
        if (!this.isInCheck(color)) {
            return false;
        }
        
        // Check if any move can get out of check
        return !this.hasLegalMoves(color);
    }

    /**
     * Check if the game is in stalemate
     * @param {string} color Color of the player to check
     * @returns {boolean} True if the game is in stalemate
     */
    isInStalemate(color) {
        if (this.isInCheck(color)) {
            return false;
        }
        
        // Check if the player has any legal moves
        return !this.hasLegalMoves(color);
    }

    /**
     * Check if a player has any legal moves
     * @param {string} color Color of the player to check
     * @returns {boolean} True if the player has legal moves
     */
    hasLegalMoves(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    const moves = this.getValidMoves(r, c);
                    if (moves.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Check for game end conditions
     */
    checkGameEnd() {
        const currentColor = this.currentPlayer;
        
        if (this.isInCheckmate(currentColor)) {
            this.gameOver = true;
            this.gameResult = currentColor === COLOR.WHITE ? 'Black wins' : 'White wins';
        } else if (this.isInStalemate(currentColor)) {
            this.gameOver = true;
            this.gameResult = 'Stalemate';
        } else if (this.halfMoveClock >= 100) {
            this.gameOver = true;
            this.gameResult = 'Draw by fifty-move rule';
        }
        // TODO: Add three-fold repetition and insufficient material checks
    }
} 