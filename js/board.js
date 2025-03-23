/**
 * Chessboard UI representation and interaction
 */

class ChessBoard {
    constructor(containerElement, chess) {
        this.containerElement = containerElement;
        this.chess = chess;
        this.boardElement = null;
        this.selectedPiece = null;
        this.isDragging = false;
        this.currentValidMoves = [];
        this.pieceImages = {
            [COLOR.WHITE + PIECE.KING]: 'wk',
            [COLOR.WHITE + PIECE.QUEEN]: 'wq',
            [COLOR.WHITE + PIECE.ROOK]: 'wr',
            [COLOR.WHITE + PIECE.BISHOP]: 'wb',
            [COLOR.WHITE + PIECE.KNIGHT]: 'wn',
            [COLOR.WHITE + PIECE.PAWN]: 'wp',
            [COLOR.BLACK + PIECE.KING]: 'bk',
            [COLOR.BLACK + PIECE.QUEEN]: 'bq',
            [COLOR.BLACK + PIECE.ROOK]: 'br',
            [COLOR.BLACK + PIECE.BISHOP]: 'bb',
            [COLOR.BLACK + PIECE.KNIGHT]: 'bn',
            [COLOR.BLACK + PIECE.PAWN]: 'bp'
        };
        
        // Initialize the board UI
        this.initializeBoard();
        
        // Setup event handlers
        this.setupEventListeners();
    }
    
    /**
     * Initialize the chessboard UI
     */
    initializeBoard() {
        // Clear the container
        this.containerElement.innerHTML = '';
        
        // Create the board element
        this.boardElement = document.createElement('div');
        this.boardElement.className = 'chessboard';
        this.containerElement.appendChild(this.boardElement);
        
        // Create squares
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                // Add coordinate label
                const coordLabel = document.createElement('div');
                coordLabel.className = 'coord-label';
                const algebraic = this.squareToAlgebraic(row, col);
                coordLabel.textContent = algebraic;
                square.appendChild(coordLabel);
                
                this.boardElement.appendChild(square);
            }
        }
    }
    
    /**
     * Setup event listeners for board interaction
     */
    setupEventListeners() {
        // Click on squares
        this.boardElement.addEventListener('click', (event) => {
            const square = event.target.closest('.square');
            if (!square) return;
            
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            
            this.handleSquareClick(row, col);
        });
        
        // Drag and drop
        this.boardElement.addEventListener('mousedown', (event) => {
            const pieceElement = event.target.closest('.piece');
            if (!pieceElement) return;
            
            const square = pieceElement.closest('.square');
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            
            this.startDragging(row, col, event);
            event.preventDefault(); // Prevent default drag behavior
        });
        
        document.addEventListener('mousemove', (event) => {
            if (this.isDragging) {
                this.updateDragging(event);
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (this.isDragging) {
                this.stopDragging(event);
            }
        });
    }
    
    /**
     * Handle click on a square
     * @param {number} row Row index
     * @param {number} col Column index
     */
    handleSquareClick(row, col) {
        const piece = this.chess.getPieceAt(row, col);
        
        // If no piece is selected and the clicked square has a piece of the current player
        if (!this.selectedPiece && piece && piece.color === this.chess.getCurrentPlayer()) {
            // Select the piece
            this.selectPiece(row, col);
        }
        // If a piece is already selected
        else if (this.selectedPiece) {
            const fromRow = this.selectedPiece.row;
            const fromCol = this.selectedPiece.col;
            
            // If clicking on the same piece, deselect it
            if (fromRow === row && fromCol === col) {
                this.clearSelection();
                return;
            }
            
            // If clicking on another own piece, select that piece instead
            if (piece && piece.color === this.chess.getCurrentPlayer()) {
                this.clearSelection();
                this.selectPiece(row, col);
                return;
            }
            
            // Check if the clicked square is a valid move
            const isValidMove = this.currentValidMoves.some(([r, c]) => r === row && c === col);
            
            if (isValidMove) {
                // Try to make a move
                const moveResult = this.chess.makeMove(fromRow, fromCol, row, col);
                if (moveResult) {
                    this.updateBoard();
                    
                    // Announce the move
                    this.announceMove(fromRow, fromCol, row, col);
                    
                    // Check for game over
                    this.checkGameState();
                }
            }
            
            // Clear selection
            this.clearSelection();
        }
    }
    
    /**
     * Select a piece
     * @param {number} row Row index
     * @param {number} col Column index
     */
    selectPiece(row, col) {
        const piece = this.chess.getPieceAt(row, col);
        if (!piece || piece.color !== this.chess.getCurrentPlayer()) {
            return;
        }
        
        // Set the selected piece
        this.selectedPiece = {
            row: row,
            col: col,
            piece: piece
        };
        
        // Mark the square as selected
        const square = this.getSquareElement(row, col);
        square.classList.add('selected');
        
        // Get valid moves for the piece
        this.currentValidMoves = this.chess.getValidMoves(row, col);
        
        // Highlight valid moves
        this.highlightValidMoves();
    }
    
    /**
     * Clear the current selection
     */
    clearSelection() {
        if (!this.selectedPiece) {
            return;
        }
        
        // Clear the selected piece
        this.selectedPiece = null;
        
        // Remove selected class from all squares
        const squares = this.boardElement.querySelectorAll('.square');
        squares.forEach(square => {
            square.classList.remove('selected');
            square.classList.remove('valid-move');
        });
        
        // Clear valid moves
        this.currentValidMoves = [];
    }
    
    /**
     * Highlight valid moves for the selected piece
     */
    highlightValidMoves() {
        for (const [row, col] of this.currentValidMoves) {
            const square = this.getSquareElement(row, col);
            square.classList.add('valid-move');
        }
    }
    
    /**
     * Start dragging a piece
     * @param {number} row Row index
     * @param {number} col Column index
     * @param {Event} event Mouse event
     */
    startDragging(row, col, event) {
        const piece = this.chess.getPieceAt(row, col);
        if (!piece || piece.color !== this.chess.getCurrentPlayer()) {
            return;
        }
        
        // Set up dragging
        this.isDragging = true;
        
        // Create the dragging element
        const pieceElement = this.getSquareElement(row, col).querySelector('.piece');
        const dragElement = pieceElement.cloneNode(true);
        dragElement.classList.add('dragging');
        dragElement.style.position = 'absolute';
        dragElement.style.zIndex = '1000';
        
        // Get the original size of the piece
        const rect = pieceElement.getBoundingClientRect();
        dragElement.style.width = rect.width + 'px';
        dragElement.style.height = rect.height + 'px';
        
        document.body.appendChild(dragElement);
        
        // Store dragging state
        this.draggingState = {
            piece: piece,
            row: row,
            col: col,
            element: dragElement
        };
        
        // Hide the original piece
        pieceElement.style.opacity = '0.3';
        
        // Select the piece (to show valid moves)
        this.selectPiece(row, col);
        
        // Position the dragging element immediately
        this.updateDragging(event);
    }
    
    /**
     * Update the dragging element position
     * @param {Event} event Mouse event
     */
    updateDragging(event) {
        if (!this.isDragging || !this.draggingState) {
            return;
        }
        
        // Position the dragging element to center on cursor
        const element = this.draggingState.element;
        const rect = element.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        element.style.left = (event.clientX - centerX) + 'px';
        element.style.top = (event.clientY - centerY) + 'px';
    }
    
    /**
     * Stop dragging and make a move if valid
     * @param {Event} event Mouse event
     */
    stopDragging(event) {
        if (!this.isDragging || !this.draggingState) {
            return;
        }
        
        // Remove the dragging element
        this.draggingState.element.remove();
        
        // Show the original piece
        const pieceElement = this.getSquareElement(this.draggingState.row, this.draggingState.col).querySelector('.piece');
        if (pieceElement) {
            pieceElement.style.opacity = '1';
        }
        
        // Find the square under the cursor
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        const square = elements.find(el => el.classList.contains('square'));
        
        if (square) {
            const toRow = parseInt(square.dataset.row);
            const toCol = parseInt(square.dataset.col);
            
            // Try to make a move
            const fromRow = this.draggingState.row;
            const fromCol = this.draggingState.col;
            
            if (fromRow !== toRow || fromCol !== toCol) {
                const moveResult = this.chess.makeMove(fromRow, fromCol, toRow, toCol);
                if (moveResult) {
                    this.updateBoard();
                    
                    // Announce the move
                    this.announceMove(fromRow, fromCol, toRow, toCol);
                    
                    // Check for game over
                    this.checkGameState();
                }
            }
        }
        
        // Clean up
        this.isDragging = false;
        this.draggingState = null;
        this.clearSelection();
    }
    
    /**
     * Update the board UI to reflect the current game state
     */
    updateBoard() {
        // Clear all pieces
        const pieces = this.boardElement.querySelectorAll('.piece');
        pieces.forEach(piece => piece.remove());
        
        // Add pieces based on current board state
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.chess.getPieceAt(row, col);
                if (piece) {
                    this.placePiece(row, col, piece);
                }
            }
        }
        
        // Update current player indicator
        const playerTurnElement = document.getElementById('player-turn');
        if (playerTurnElement) {
            const currentPlayer = this.chess.getCurrentPlayer() === COLOR.WHITE ? 'White' : 'Black';
            playerTurnElement.textContent = `${currentPlayer} to move`;
        }
    }
    
    /**
     * Place a piece on the board
     * @param {number} row Row index
     * @param {number} col Column index
     * @param {Object} piece Piece object
     */
    placePiece(row, col, piece) {
        const square = this.getSquareElement(row, col);
        if (!square) return;
        
        const pieceElement = document.createElement('img');
        pieceElement.className = 'piece';
        
        const pieceKey = piece.color + piece.type;
        const pieceCode = this.pieceImages[pieceKey];
        
        pieceElement.src = `img/pieces/${pieceCode}.svg`;
        pieceElement.alt = pieceCode;
        pieceElement.draggable = false; // Prevent default drag
        
        square.appendChild(pieceElement);
    }
    
    /**
     * Get the DOM element for a square
     * @param {number} row Row index
     * @param {number} col Column index
     * @returns {Element} Square element
     */
    getSquareElement(row, col) {
        return this.boardElement.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
    }
    
    /**
     * Reset the board with a new Chess960 position
     */
    resetBoard() {
        this.chess.initializeChess960();
        this.updateBoard();
        this.clearSelection();
        
        // Reset game status
        const gameStatusElement = document.getElementById('game-status');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Game in progress';
        }
        
        // Clear move history
        this.clearMoveHistory();
    }
    
    /**
     * Clear the move history UI
     */
    clearMoveHistory() {
        const movesElement = document.getElementById('moves');
        if (movesElement) {
            movesElement.innerHTML = '';
        }
    }
    
    /**
     * Announce a move in the move history
     * @param {number} fromRow Source row
     * @param {number} fromCol Source column
     * @param {number} toRow Target row
     * @param {number} toCol Target column
     */
    announceMove(fromRow, fromCol, toRow, toCol) {
        const movesElement = document.getElementById('moves');
        if (!movesElement) return;
        
        const history = this.chess.getMoveHistory();
        const move = history[history.length - 1];
        
        // Get algebraic notation
        const fromSquare = this.squareToAlgebraic(fromRow, fromCol);
        const toSquare = this.squareToAlgebraic(toRow, toCol);
        
        // Create move text
        const pieceSymbol = this.getPieceSymbol(move.piece);
        const captureSymbol = move.captured ? 'x' : '';
        const moveText = `${pieceSymbol}${fromSquare}${captureSymbol}${toSquare}`;
        
        // Create or update the move pair
        const moveNumber = Math.ceil(history.length / 2);
        let movePair = document.getElementById(`move-${moveNumber}`);
        
        if (!movePair) {
            movePair = document.createElement('div');
            movePair.id = `move-${moveNumber}`;
            movePair.className = 'move-pair';
            
            const moveNumberElement = document.createElement('span');
            moveNumberElement.className = 'move-number';
            moveNumberElement.textContent = `${moveNumber}.`;
            
            movePair.appendChild(moveNumberElement);
            movesElement.appendChild(movePair);
        }
        
        const moveElement = document.createElement('span');
        moveElement.className = 'move';
        moveElement.textContent = moveText;
        
        movePair.appendChild(moveElement);
        
        // Scroll to the bottom
        movesElement.scrollTop = movesElement.scrollHeight;
    }
    
    /**
     * Convert board coordinates to algebraic notation
     * @param {number} row Row index
     * @param {number} col Column index
     * @returns {string} Algebraic notation (e.g. "e4")
     */
    squareToAlgebraic(row, col) {
        const file = String.fromCharCode(97 + col); // a, b, c, ...
        const rank = 8 - row; // 1, 2, 3, ...
        return file + rank;
    }
    
    /**
     * Get the symbol for a piece
     * @param {Object} piece Piece object
     * @returns {string} Piece symbol
     */
    getPieceSymbol(piece) {
        if (piece.type === PIECE.PAWN) {
            return '';
        }
        
        switch (piece.type) {
            case PIECE.KING: return 'K';
            case PIECE.QUEEN: return 'Q';
            case PIECE.ROOK: return 'R';
            case PIECE.BISHOP: return 'B';
            case PIECE.KNIGHT: return 'N';
            default: return '';
        }
    }
    
    /**
     * Check the game state and update UI accordingly
     */
    checkGameState() {
        if (this.chess.isGameOver()) {
            const gameStatusElement = document.getElementById('game-status');
            if (gameStatusElement) {
                const result = this.chess.getGameResult();
                gameStatusElement.textContent = result;
            }
        }
    }
} 