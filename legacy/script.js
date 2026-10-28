document.addEventListener('DOMContentLoaded', function() {
    // Game state
    const gameState = {
        board: [],
        currentTurn: 'white',
        selectedSquare: null,
        possibleMoves: [],
        gamePhase: 'move',
        duckPosition: null,
        variants: {
            fischer: false,
            dragon: false,
            duck: false
        },
        moveHistory: [],
        boardFlipped: false,
        enPassantTarget: null,
        gameStatus: 'normal', // 'normal', 'check', 'checkmate'
        kingPositions: {
            white: [7, 4],
            black: [0, 4]
        },
        moveStack: []
    };
    
    // DOM elements
    const chessBoard = document.getElementById('chess-board');
    const currentTurnDisplay = document.getElementById('current-turn');
    const gamePhaseDisplay = document.getElementById('game-phase');
    const gameStateDisplay = document.getElementById('game-state');
    const gameVariantDisplay = document.getElementById('game-variant');
    const moveHistoryContainer = document.getElementById('move-history');
    const gameMessage = document.getElementById('game-message');
    const variantInstructions = document.getElementById('variant-instructions');
    
    // Toggle elements
    const fischerToggle = document.getElementById('fischer-toggle');
    const dragonToggle = document.getElementById('dragon-toggle');
    const duckToggle = document.getElementById('duck-toggle');
    
    // Button elements
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    const flipBoardBtn = document.getElementById('flip-board-btn');
    const settingsBtn = document.getElementById('settings-btn');
    
    // Initialize the board
    function initializeBoard() {
        chessBoard.innerHTML = '';
        
        // Create 8x8 board
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                const squareColor = (row + col) % 2 === 0 ? 'light' : 'dark';
                
                square.className = `chess-square ${squareColor}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                // Add coordinates for the first and last ranks/files
                if ((row === 7 && !gameState.boardFlipped) || (row === 0 && gameState.boardFlipped)) {
                    const coord = document.createElement('div');
                    coord.className = 'absolute bottom-1 right-1 text-xs font-bold';
                    coord.textContent = String.fromCharCode(97 + col);
                    square.appendChild(coord);
                }
                
                if ((col === 0 && !gameState.boardFlipped) || (col === 7 && gameState.boardFlipped)) {
                    const coord = document.createElement('div');
                    coord.className = 'absolute top-1 left-1 text-xs font-bold';
                    coord.textContent = 8 - row;
                    square.appendChild(coord);
                }
                
                square.addEventListener('click', () => handleSquareClick(row, col));
                
                chessBoard.appendChild(square);
            }
        }
        
        // Set up initial piece positions
        setupInitialPosition();
        updateBoardDisplay();
        updateGameStatus();
    }
    
    // Set up initial piece positions
    function setupInitialPosition() {
        // Clear the board
        gameState.board = Array(8).fill().map(() => Array(8).fill(null));
        gameState.currentTurn = 'white';
        gameState.selectedSquare = null;
        gameState.possibleMoves = [];
        gameState.enPassantTarget = null;
        gameState.gameStatus = 'normal';
        gameState.moveHistory = [];
        gameState.moveStack = [];
        
        
        if (gameState.variants.fischer) {
            setupFischerRandomPosition();
        } else {
            setupStandardPosition();
        }
        
        // Update king positions
        updateKingPositions();
    }
    
    // Set up standard chess position
    function setupStandardPosition() {
        // Pawns
        for (let col = 0; col < 8; col++) {
            gameState.board[1][col] = { type: 'pawn', color: 'black', hasMoved: false };
            gameState.board[6][col] = { type: 'pawn', color: 'white', hasMoved: false };
        }
        
        // Other pieces
        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        
        for (let col = 0; col < 8; col++) {
            gameState.board[0][col] = { type: backRow[col], color: 'black', hasMoved: false };
            gameState.board[7][col] = { type: backRow[col], color: 'white', hasMoved: false };
            
            // Apply dragon bishop variant if enabled
            if (gameState.variants.dragon && backRow[col] === 'bishop') {
                gameState.board[0][col].isDragon = true;
                gameState.board[7][col].isDragon = true;
            }
            
            // Set initial king positions
            if (backRow[col] === 'king') {
                gameState.kingPositions.black = [0, col];
                gameState.kingPositions.white = [7, col];
            }
        }
    }
    
    // Set up Fischer Random (Chess960) position
    function setupFischerRandomPosition() {
        // 1. Place bishops on opposite colors
        const positions = Array(8).fill(null);
        const darkSquares = [1, 3, 5, 7];
        const lightSquares = [0, 2, 4, 6];
        const bishop1 = darkSquares[Math.floor(Math.random() * darkSquares.length)];
        const bishop2 = lightSquares[Math.floor(Math.random() * lightSquares.length)];
        positions[bishop1] = 'bishop';
        positions[bishop2] = 'bishop';

        // 2. Place queen
        let empties = positions.map((p, i) => p === null ? i : null).filter(i => i !== null);
        const queenPos = empties[Math.floor(Math.random() * empties.length)];
        positions[queenPos] = 'queen';

        // 3. Place knights
        empties = positions.map((p, i) => p === null ? i : null).filter(i => i !== null);
        for (let n = 0; n < 2; n++) {
            const idx = Math.floor(Math.random() * empties.length);
            positions[empties[idx]] = 'knight';
            empties.splice(idx, 1);
        }

        // 4. Place king between two rooks
        empties = positions.map((p, i) => p === null ? i : null).filter(i => i !== null);
        // There are 3 empty squares left; choose king's position so that at least one empty on each side for rooks
        // Possible king positions: not at the ends
        const possibleKingPositions = empties.filter(i => {
            const left = empties.filter(e => e < i);
            const right = empties.filter(e => e > i);
            return left.length > 0 && right.length > 0;
        });
        const kingPos = possibleKingPositions[Math.floor(Math.random() * possibleKingPositions.length)];
        positions[kingPos] = 'king';
        // Place rooks in the remaining two spots
        empties = positions.map((p, i) => p === null ? i : null).filter(i => i !== null);
        positions[empties[0]] = 'rook';
        positions[empties[1]] = 'rook';

        // Place black pieces
        for (let col = 0; col < 8; col++) {
            gameState.board[0][col] = { type: positions[col], color: 'black', hasMoved: false };
            if (gameState.variants.dragon && positions[col] === 'bishop') {
                gameState.board[0][col].isDragon = true;
            }
            if (positions[col] === 'king') {
                gameState.kingPositions.black = [0, col];
            }
        }
        // Place white pieces (mirror of black)
        for (let col = 0; col < 8; col++) {
            gameState.board[7][col] = { type: positions[col], color: 'white', hasMoved: false };
            if (gameState.variants.dragon && positions[col] === 'bishop') {
                gameState.board[7][col].isDragon = true;
            }
            if (positions[col] === 'king') {
                gameState.kingPositions.white = [7, col];
            }
        }
        // Pawns
        for (let col = 0; col < 8; col++) {
            gameState.board[1][col] = { type: 'pawn', color: 'black', hasMoved: false };
            gameState.board[6][col] = { type: 'pawn', color: 'white', hasMoved: false };
        }
    }
    
    // Update the visual display of the board
    function updateBoardDisplay() {
        const squares = chessBoard.querySelectorAll('.chess-square');
        
        // Clear highlights and pieces
        squares.forEach(square => {
            square.className = square.className.replace(/check|checkmate|pin/g, '').trim();
            square.innerHTML = '';
            
            // Re-add coordinates if needed
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            
            if ((row === 7 && !gameState.boardFlipped) || (row === 0 && gameState.boardFlipped)) {
                const coord = document.createElement('div');
                coord.className = 'absolute bottom-1 right-1 text-xs font-bold';
                coord.textContent = String.fromCharCode(97 + col);
                square.appendChild(coord);
            }
            
            if ((col === 0 && !gameState.boardFlipped) || (col === 7 && gameState.boardFlipped)) {
                const coord = document.createElement('div');
                coord.className = 'absolute top-1 left-1 text-xs font-bold';
                coord.textContent = 8 - row;
                square.appendChild(coord);
            }
        });
        
        // Place pieces
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = gameState.board[row][col];
                const displayRow = gameState.boardFlipped ? 7 - row : row;
                const displayCol = gameState.boardFlipped ? 7 - col : col;
                const squareIndex = displayRow * 8 + displayCol;
                const square = squares[squareIndex];
                
                // Set square color
                const squareColor = (row + col) % 2 === 0 ? 'light' : 'dark';
                square.className = `chess-square ${squareColor}`;
                
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color}`;
                    
                    if (piece.isDragon) {
                        pieceElement.classList.add('dragon-bishop');
                    }
                    
                    // Set piece symbol
                    switch (piece.type) {
                        case 'king': pieceElement.textContent = piece.color === 'white' ? '♔' : '♚'; break;
                        case 'queen': pieceElement.textContent = piece.color === 'white' ? '♕' : '♛'; break;
                        case 'rook': pieceElement.textContent = piece.color === 'white' ? '♖' : '♜'; break;
                        case 'bishop': pieceElement.textContent = piece.color === 'white' ? '♗' : '♝'; break;
                        case 'knight': pieceElement.textContent = piece.color === 'white' ? '♘' : '♞'; break;
                        case 'pawn': pieceElement.textContent = piece.color === 'white' ? '♙' : '♟'; break;
                    }
                    
                    square.appendChild(pieceElement);
                }
            }
        }
        
        // Highlight selected square
        if (gameState.selectedSquare) {
            const [row, col] = gameState.selectedSquare;
            const displayRow = gameState.boardFlipped ? 7 - row : row;
            const displayCol = gameState.boardFlipped ? 7 - col : col;
            const squareIndex = displayRow * 8 + displayCol;
            squares[squareIndex].classList.add('highlight');
        }
        
        // Highlight possible moves
        gameState.possibleMoves.forEach(([row, col]) => {
            const displayRow = gameState.boardFlipped ? 7 - row : row;
            const displayCol = gameState.boardFlipped ? 7 - col : col;
            const squareIndex = displayRow * 8 + displayCol;
            squares[squareIndex].classList.add('possible-move');
        });
        
        // Place duck if in duck mode
        if (gameState.variants.duck && gameState.duckPosition) {
            const [row, col] = gameState.duckPosition;
            const displayRow = gameState.boardFlipped ? 7 - row : row;
            const displayCol = gameState.boardFlipped ? 7 - col : col;
            const squareIndex = displayRow * 8 + displayCol;
            
            const duckElement = document.createElement('div');
            duckElement.className = 'duck-piece';
            squares[squareIndex].appendChild(duckElement);
        }
        
        // Highlight the checked king's square
        highlightCheckedKing();
    }
    
    // Highlight the checked king's square
    function highlightCheckedKing() {
        const squares = chessBoard.querySelectorAll('.chess-square');
        
        // Highlight check and checkmate
        if (gameState.gameStatus === 'check' || gameState.gameStatus === 'checkmate') {
            const kingPos = gameState.kingPositions[gameState.currentTurn];
            const displayRow = gameState.boardFlipped ? 7 - kingPos[0] : kingPos[0];
            const displayCol = gameState.boardFlipped ? 7 - kingPos[1] : kingPos[1];
            const squareIndex = displayRow * 8 + displayCol;
            
            // Ensure the square exists before adding class
            if (squares[squareIndex]) {
                if (gameState.gameStatus === 'checkmate') {
                    squares[squareIndex].classList.add('checkmate');
                } else {
                    squares[squareIndex].classList.add('check');
                }
            }
        }
    }
    
    // Handle square clicks
    function handleSquareClick(row, col) {
        // Convert display coordinates to board coordinates if flipped
        if (gameState.boardFlipped) {
            row = 7 - row;
            col = 7 - col;
        }
        
        const piece = gameState.board[row][col];
        
        // Duck placement phase
        if (gameState.gamePhase === 'place-duck') {
            // Can't place duck on a square with a piece
            if (!piece) {
                gameState.duckPosition = [row, col];
                gameState.gamePhase = 'move';
                gameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
                
                // Check for check/checkmate after duck placement
                checkGameStatus();
                updateGameStatus();
                updateBoardDisplay();
                
                // Add to move history
                addToMoveHistory(`Duck placed at ${String.fromCharCode(97 + col)}${8 - row}`);
            }
            return;
        }
        
        // If a piece is selected and this is a possible move, make the move
        if (gameState.selectedSquare && gameState.possibleMoves.some(([r, c]) => r === row && c === col)) {
            makeMove(gameState.selectedSquare[0], gameState.selectedSquare[1], row, col);
            return;
        }
        
        // If no piece is selected or selecting opponent's piece, select this piece if it's the current player's
        if (piece && piece.color === gameState.currentTurn) {
            gameState.selectedSquare = [row, col];
            gameState.possibleMoves = calculatePossibleMoves(row, col);
            
            // Filter moves that would leave king in check
            gameState.possibleMoves = gameState.possibleMoves.filter(([toRow, toCol]) => {
                // Simulate the move
                const originalBoard = JSON.parse(JSON.stringify(gameState.board));
                const originalKingPos = [...gameState.kingPositions[gameState.currentTurn]];
                const originalEnPassant = gameState.enPassantTarget;
                
                // Make the move on a copy of the board
                const movingPiece = gameState.board[row][col];
                gameState.board[toRow][toCol] = movingPiece;
                gameState.board[row][col] = null;
                
                // Handle en passant capture
                if (movingPiece.type === 'pawn' && col !== toCol && !gameState.board[toRow][toCol]) {
                    gameState.board[row][toCol] = null; // Capture the pawn
                }
                
                // Update king position if moving king
                if (movingPiece.type === 'king') {
                    gameState.kingPositions[gameState.currentTurn] = [toRow, toCol];
                }
                
                // Check if king is in check after move
                const isCheck = isSquareUnderAttack(
                    gameState.kingPositions[gameState.currentTurn][0],
                    gameState.kingPositions[gameState.currentTurn][1],
                    gameState.currentTurn
                );
                
                // Restore original state
                gameState.board = originalBoard;
                gameState.kingPositions[gameState.currentTurn] = originalKingPos;
                gameState.enPassantTarget = originalEnPassant;
                
                return !isCheck;
            });
            
            updateBoardDisplay();
        } else {
            gameState.selectedSquare = null;
            gameState.possibleMoves = [];
            updateBoardDisplay();
        }
    }
    
    // Calculate possible moves for a piece
    function calculatePossibleMoves(row, col) {
        const piece = gameState.board[row][col];
        if (!piece) return [];
        
        const moves = [];
        const opponentColor = piece.color === 'white' ? 'black' : 'white';
        
        switch (piece.type) {
            case 'pawn':
                // Pawns move forward one square (two from starting position)
                const direction = piece.color === 'white' ? -1 : 1;
                
                // Normal move
                if (isValidSquare(row + direction, col) && !gameState.board[row + direction][col]) {
                    moves.push([row + direction, col]);
                    
                    // Double move from starting position
                    const startRow = piece.color === 'white' ? 6 : 1;
                    if (row === startRow && 
                        !gameState.board[row + 2 * direction][col] && 
                        !gameState.board[row + direction][col]) {
                        moves.push([row + 2 * direction, col]);
                    }
                }
                
                // Captures
                for (const captureCol of [col - 1, col + 1]) {
                    if (isValidSquare(row + direction, captureCol)) {
                        const targetPiece = gameState.board[row + direction][captureCol];
                        
                        // Normal capture
                        if (targetPiece && targetPiece.color !== piece.color) {
                            moves.push([row + direction, captureCol]);
                        }
                        
                        // En passant capture
                        if (!targetPiece && 
                            gameState.enPassantTarget && 
                            gameState.enPassantTarget[0] === row && 
                            gameState.enPassantTarget[1] === captureCol) {
                            moves.push([row + direction, captureCol]);
                        }
                    }
                }
                break;
                
            case 'knight':
                // Knight moves in L-shape
                for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    if (isValidSquare(newRow, newCol)) {
                        const targetPiece = gameState.board[newRow][newCol];
                        if (!targetPiece || targetPiece.color !== piece.color) {
                            moves.push([newRow, newCol]);
                        }
                    }
                }
                break;
                
            case 'bishop':
                if (piece.isDragon && gameState.variants.dragon) {
                    // Dragon bishop moves (standard bishop + Xiangqi horse)
                    
                    // Standard bishop moves (diagonals)
                    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                        let newRow = row + dr;
                        let newCol = col + dc;
                        
                        while (isValidSquare(newRow, newCol)) {
                            const targetPiece = gameState.board[newRow][newCol];
                            
                            if (!targetPiece) {
                                moves.push([newRow, newCol]);
                            } else {
                                if (targetPiece.color !== piece.color) {
                                    moves.push([newRow, newCol]);
                                }
                                break;
                            }
                            
                            newRow += dr;
                            newCol += dc;
                        }
                    }
                    
                    // Xiangqi horse moves (1 orthogonally then 1 diagonally out)
                    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                        const intermediateRow = row + dr;
                        const intermediateCol = col + dc;
                        
                        // Check if intermediate square is empty
                        if (isValidSquare(intermediateRow, intermediateCol) && !gameState.board[intermediateRow][intermediateCol]) {
                            // Now check diagonal moves
                            for (const [ddr, ddc] of [[dr + (dr !== 0 ? 0 : 1), dc + (dc !== 0 ? 0 : 1)], 
                                                     [dr + (dr !== 0 ? 0 : -1), dc + (dc !== 0 ? 0 : -1)]]) {
                                const newRow = intermediateRow + ddr;
                                const newCol = intermediateCol + ddc;
                                
                                if (isValidSquare(newRow, newCol)) {
                                    const targetPiece = gameState.board[newRow][newCol];
                                    if (!targetPiece || targetPiece.color !== piece.color) {
                                        moves.push([newRow, newCol]);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Standard bishop moves (diagonals)
                    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                        let newRow = row + dr;
                        let newCol = col + dc;
                        
                        while (isValidSquare(newRow, newCol)) {
                            const targetPiece = gameState.board[newRow][newCol];
                            
                            if (!targetPiece) {
                                moves.push([newRow, newCol]);
                            } else {
                                if (targetPiece.color !== piece.color) {
                                    moves.push([newRow, newCol]);
                                }
                                break;
                            }
                            
                            newRow += dr;
                            newCol += dc;
                        }
                    }
                }
                break;
                
            case 'rook':
                // Rook moves (straight lines)
                for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                    let newRow = row + dr;
                    let newCol = col + dc;
                    
                    while (isValidSquare(newRow, newCol)) {
                        const targetPiece = gameState.board[newRow][newCol];
                        
                        if (!targetPiece) {
                            moves.push([newRow, newCol]);
                        } else {
                            if (targetPiece.color !== piece.color) {
                                moves.push([newRow, newCol]);
                            }
                            break;
                        }
                        
                        newRow += dr;
                        newCol += dc;
                    }
                }
                break;
                
            case 'queen':
                // Queen moves (combination of rook and bishop)
                for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                    let newRow = row + dr;
                    let newCol = col + dc;
                    
                    while (isValidSquare(newRow, newCol)) {
                        const targetPiece = gameState.board[newRow][newCol];
                        
                        if (!targetPiece) {
                            moves.push([newRow, newCol]);
                        } else {
                            if (targetPiece.color !== piece.color) {
                                moves.push([newRow, newCol]);
                            }
                            break;
                        }
                        
                        newRow += dr;
                        newCol += dc;
                    }
                }
                break;
                
            case 'king':
                // King moves (one square in any direction)
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        
                        const newRow = row + dr;
                        const newCol = col + dc;
                        
                        if (isValidSquare(newRow, newCol)) {
                            const targetPiece = gameState.board[newRow][newCol];
                            if (!targetPiece || targetPiece.color !== piece.color) {
                                // Check if the square is under attack
                                if (!isSquareUnderAttack(newRow, newCol, piece.color)) {
                                    moves.push([newRow, newCol]);
                                }
                            }
                        }
                    }
                }
                
                // Castling (simplified version)
                if (!piece.hasMoved) {
                    // Kingside castling
                    if (gameState.board[row][5] === null && 
                        gameState.board[row][6] === null && 
                        gameState.board[row][7]?.type === 'rook' && 
                        !gameState.board[row][7].hasMoved) {
                            
                        // Check if squares are not under attack
                        if (!isSquareUnderAttack(row, 5, piece.color) && 
                            !isSquareUnderAttack(row, 6, piece.color)) {
                            moves.push([row, 6]); // King moves two squares
                        }
                    }
                    
                    // Queenside castling
                    if (gameState.board[row][3] === null && 
                        gameState.board[row][2] === null && 
                        gameState.board[row][1] === null && 
                        gameState.board[row][0]?.type === 'rook' && 
                        !gameState.board[row][0].hasMoved) {
                            
                        // Check if squares are not under attack
                        if (!isSquareUnderAttack(row, 3, piece.color) && 
                            !isSquareUnderAttack(row, 2, piece.color)) {
                            moves.push([row, 2]); // King moves two squares
                        }
                    }
                }
                break;
        }
        
        return moves;
    }
    
    // Check if coordinates are within the board
    function isValidSquare(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }
    
    // Check if a square is under attack by opponent pieces
    function isSquareUnderAttack(row, col, defenderColor) {
        const attackerColor = defenderColor === 'white' ? 'black' : 'white';
        
        // Check for pawn attacks
        const pawnDirection = attackerColor === 'white' ? 1 : -1;
        for (const dc of [-1, 1]) {
            const pawnRow = row - pawnDirection;
            const pawnCol = col + dc;
            
            if (isValidSquare(pawnRow, pawnCol)) {
                const piece = gameState.board[pawnRow][pawnCol];
                if (piece && piece.type === 'pawn' && piece.color === attackerColor) {
                    return true;
                }
            }
        }
        
        // Check for knight attacks
        for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
            const knightRow = row + dr;
            const knightCol = col + dc;
            
            if (isValidSquare(knightRow, knightCol)) {
                const piece = gameState.board[knightRow][knightCol];
                if (piece && piece.type === 'knight' && piece.color === attackerColor) {
                    return true;
                }
            }
        }
        
        // Check for bishop/queen attacks (diagonals)
        for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            let newRow = row + dr;
            let newCol = col + dc;
            
            while (isValidSquare(newRow, newCol)) {
                const piece = gameState.board[newRow][newCol];
                
                if (piece) {
                    if (piece.color === attackerColor && 
                        (piece.type === 'bishop' || piece.type === 'queen' || 
                         (piece.type === 'king' && Math.abs(newRow - row) === 1))) {
                        return true;
                    }
                    break;
                }
                
                newRow += dr;
                newCol += dc;
            }
        }
        
        // Check for rook/queen attacks (straight lines)
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            let newRow = row + dr;
            let newCol = col + dc;
            
            while (isValidSquare(newRow, newCol)) {
                const piece = gameState.board[newRow][newCol];
                
                if (piece) {
                    if (piece.color === attackerColor && 
                        (piece.type === 'rook' || piece.type === 'queen' || 
                         (piece.type === 'king' && Math.abs(newRow - row) === 1))) {
                        return true;
                    }
                    break;
                }
                
                newRow += dr;
                newCol += dc;
            }
        }
        
        return false;
    }
    
    // Make a move from (fromRow, fromCol) to (toRow, toCol)
    function makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = gameState.board[fromRow][fromCol];
        const capturedPiece = gameState.board[toRow][toCol];
        
        // Save game state for undo
        gameState.moveStack.push({
            board: JSON.parse(JSON.stringify(gameState.board)),
            currentTurn: gameState.currentTurn,
            gamePhase: gameState.gamePhase,
            duckPosition: gameState.duckPosition ? [...gameState.duckPosition] : null,
            enPassantTarget: gameState.enPassantTarget ? [...gameState.enPassantTarget] : null,
            kingPositions: JSON.parse(JSON.stringify(gameState.kingPositions)),
            gameStatus: gameState.gameStatus,
            moveHistory: [...gameState.moveHistory]
        });
        
        // Add to move history
        const pieceSymbol = getPieceSymbol(piece);
        const fromNotation = `${String.fromCharCode(97 + fromCol)}${8 - fromRow}`;
        const toNotation = `${String.fromCharCode(97 + toCol)}${8 - toRow}`;
        
        // Handle en passant capture
        let enPassantCapture = false;
        if (piece.type === 'pawn' && fromCol !== toCol && !gameState.board[toRow][toCol]) {
            // This is an en passant capture
            gameState.board[fromRow][toCol] = null;
            enPassantCapture = true;
            addToMoveHistory(`${fromNotation[0]}x${toNotation}e.p.`);
        } else if (capturedPiece) {
            // Normal capture
            addToMoveHistory(`${pieceSymbol}${fromNotation[0]}x${toNotation}`);
        } else {
            // Normal move
            addToMoveHistory(`${pieceSymbol}${fromNotation}-${toNotation}`);
        }
        
        // Move the piece
        gameState.board[toRow][toCol] = piece;
        gameState.board[fromRow][fromCol] = null;
        
        // Mark piece as moved
        piece.hasMoved = true;
        
        // Handle pawn promotion (simplified to always promote to queen)
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            gameState.board[toRow][toCol] = { type: 'queen', color: piece.color, hasMoved: true };
            addToMoveHistory("=Q");
        }
        
        // Handle en passant target for double pawn move
        gameState.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
            gameState.enPassantTarget = [toRow, toCol];
        }
        
        // Handle castling
        if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
            // Determine if it's kingside or queenside castling
            if (toCol > fromCol) {
                // Kingside castling - move rook
                const rook = gameState.board[fromRow][7];
                gameState.board[fromRow][5] = rook;
                gameState.board[fromRow][7] = null;
                addToMoveHistory("O-O");
            } else {
                // Queenside castling - move rook
                const rook = gameState.board[fromRow][0];
                gameState.board[fromRow][3] = rook;
                gameState.board[fromRow][0] = null;
                addToMoveHistory("O-O-O");
            }
        }
        
        // Update king position if moving king
        if (piece.type === 'king') {
            gameState.kingPositions[piece.color] = [toRow, toCol];
        }
        
        // Handle duck placement if in duck mode
        if (gameState.variants.duck) {
            gameState.gamePhase = 'place-duck';
        } else {
            gameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
            
            // Check for check/checkmate
            checkGameStatus();
        }
        
        // Clear selection
        gameState.selectedSquare = null;
        gameState.possibleMoves = [];
        
        updateGameStatus();
        updateBoardDisplay();
    }
    
    // Check game status (check, checkmate, stalemate)
    function checkGameStatus() {
        const currentPlayer = gameState.currentTurn;
        const kingPos = gameState.kingPositions[currentPlayer];
        
        // Check if the current player's king is in check
        const inCheck = isSquareUnderAttack(kingPos[0], kingPos[1], currentPlayer);
        
        if (inCheck) {
            // Check if it's checkmate
            let hasLegalMoves = false;
            
            // Check all pieces of the current player to see if any legal moves exist
            for (let row = 0; row < 8 && !hasLegalMoves; row++) {
                for (let col = 0; col < 8 && !hasLegalMoves; col++) {
                    const piece = gameState.board[row][col];
                    
                    if (piece && piece.color === currentPlayer) {
                        const moves = calculatePossibleMoves(row, col);
                        
                        // Filter moves that would leave king in check
                        const legalMoves = moves.filter(([toRow, toCol]) => {
                            // Simulate the move
                            const originalBoard = JSON.parse(JSON.stringify(gameState.board));
                            const originalKingPos = [...gameState.kingPositions[currentPlayer]];
                            const originalEnPassant = gameState.enPassantTarget; // Save en passant state
                            
                            // Make the move on a copy of the board
                            const movingPiece = gameState.board[row][col];
                            let capturedPawn = null;
                            
                            // Handle potential en passant capture during simulation
                            if (movingPiece.type === 'pawn' && col !== toCol && !gameState.board[toRow][toCol]) {
                                const capturedPawnRow = row; 
                                capturedPawn = gameState.board[capturedPawnRow][toCol];
                                gameState.board[capturedPawnRow][toCol] = null;
                            }
                            
                            gameState.board[toRow][toCol] = movingPiece;
                            gameState.board[row][col] = null;
                            
                            // Update king position if moving king
                            if (movingPiece.type === 'king') {
                                gameState.kingPositions[currentPlayer] = [toRow, toCol];
                            }
                            
                            // Check if king is still in check after move
                            const newKingPos = movingPiece.type === 'king' ? 
                                [toRow, toCol] : gameState.kingPositions[currentPlayer];
                            const stillInCheck = isSquareUnderAttack(newKingPos[0], newKingPos[1], currentPlayer);
                            
                            // Restore original state
                            gameState.board = originalBoard;
                            gameState.kingPositions[currentPlayer] = originalKingPos;
                            gameState.enPassantTarget = originalEnPassant; // Restore en passant state
                            
                            return !stillInCheck;
                        });
                        
                        if (legalMoves.length > 0) {
                            hasLegalMoves = true;
                        }
                    }
                }
            }
            
            if (!hasLegalMoves) {
                gameState.gameStatus = 'checkmate';
                showGameMessage(`Checkmate! ${currentPlayer === 'white' ? 'Black' : 'White'} wins!`); // Winner is opponent
            } else {
                gameState.gameStatus = 'check';
                showGameMessage(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in check!`);
            }
        } else {
            // Check for stalemate (no legal moves but not in check)
            let hasLegalMoves = false;
            
            for (let row = 0; row < 8 && !hasLegalMoves; row++) {
                for (let col = 0; col < 8 && !hasLegalMoves; col++) {
                    const piece = gameState.board[row][col];
                    
                    if (piece && piece.color === currentPlayer) {
                        const moves = calculatePossibleMoves(row, col);
                        
                         // Filter moves that would leave king in check (important for stalemate too)
                        const legalMoves = moves.filter(([toRow, toCol]) => {
                            // Simulate the move
                            const originalBoard = JSON.parse(JSON.stringify(gameState.board));
                            const originalKingPos = [...gameState.kingPositions[currentPlayer]];
                            const originalEnPassant = gameState.enPassantTarget;
                            
                            const movingPiece = gameState.board[row][col];
                            let capturedPawn = null;
                            if (movingPiece.type === 'pawn' && col !== toCol && !gameState.board[toRow][toCol]) {
                                const capturedPawnRow = row; 
                                capturedPawn = gameState.board[capturedPawnRow][toCol];
                                gameState.board[capturedPawnRow][toCol] = null;
                            }
                            gameState.board[toRow][toCol] = movingPiece;
                            gameState.board[row][col] = null;
                            if (movingPiece.type === 'king') {
                                gameState.kingPositions[currentPlayer] = [toRow, toCol];
                            }
                            const newKingPos = movingPiece.type === 'king' ? 
                                [toRow, toCol] : gameState.kingPositions[currentPlayer];
                            const stillInCheck = isSquareUnderAttack(newKingPos[0], newKingPos[1], currentPlayer);
                            gameState.board = originalBoard;
                            gameState.kingPositions[currentPlayer] = originalKingPos;
                            gameState.enPassantTarget = originalEnPassant;
                            return !stillInCheck;
                        });

                        if (legalMoves.length > 0) {
                            hasLegalMoves = true;
                        }
                    }
                }
            }
            
            if (!hasLegalMoves) {
                gameState.gameStatus = 'stalemate';
                showGameMessage("Stalemate! The game is a draw.");
            } else {
                 gameState.gameStatus = 'normal'; // Reset to normal if not check and has legal moves
            }
        }
    }
    
    // Update king positions on the board
    function updateKingPositions() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.type === 'king') {
                    gameState.kingPositions[piece.color] = [row, col];
                }
            }
        }
    }
    
    // Get symbol for piece notation
    function getPieceSymbol(piece) {
        switch (piece.type) {
            case 'king': return 'K';
            case 'queen': return 'Q';
            case 'rook': return 'R';
            case 'bishop': return piece.isDragon ? 'D' : 'B';
            case 'knight': return 'N';
            case 'pawn': return '';
            default: return '';
        }
    }
    
    // Add a move to the history
    function addToMoveHistory(move) {
        gameState.moveHistory.push(move);
        
        // Update display
        if (gameState.moveHistory.length === 0) {
            moveHistoryContainer.innerHTML = '<div class="text-center text-gray-500 py-4">No moves yet</div>';
        } else {
            moveHistoryContainer.innerHTML = '';
            
            // Group moves into pairs (white + black)
            for (let i = 0; i < gameState.moveHistory.length; i += 2) {
                const moveDiv = document.createElement('div');
                moveDiv.className = 'flex justify-between py-1 px-2 hover:bg-gray-700';
                
                const moveNumber = document.createElement('span');
                moveNumber.className = 'text-gray-400';
                moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;
                
                const whiteMove = document.createElement('span');
                whiteMove.textContent = gameState.moveHistory[i];
                
                moveDiv.appendChild(moveNumber);
                moveDiv.appendChild(whiteMove);
                
                if (i + 1 < gameState.moveHistory.length) {
                    const blackMove = document.createElement('span');
                    blackMove.textContent = gameState.moveHistory[i + 1];
                    moveDiv.appendChild(blackMove);
                }
                
                moveHistoryContainer.appendChild(moveDiv);
            }
        }
        
        // Scroll to bottom
        moveHistoryContainer.scrollTop = moveHistoryContainer.scrollHeight;
    }
    
    // Update game status display
    function updateGameStatus() {
        currentTurnDisplay.textContent = gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1);
        currentTurnDisplay.className = gameState.currentTurn === 'white' ? 'font-bold text-white' : 'font-bold text-gray-400';
        
        if (gameState.gamePhase === 'place-duck') {
            gamePhaseDisplay.textContent = 'Place Duck';
            gamePhaseDisplay.className = 'font-bold text-yellow-400';
        } else {
            gamePhaseDisplay.textContent = 'Move Piece';
            gamePhaseDisplay.className = 'font-bold';
        }
        
        // Update game state display
        switch (gameState.gameStatus) {
            case 'check':
                gameStateDisplay.textContent = 'Check';
                gameStateDisplay.className = 'font-bold text-red-500';
                break;
            case 'checkmate':
                gameStateDisplay.textContent = 'Checkmate';
                gameStateDisplay.className = 'font-bold text-red-600';
                break;
            case 'stalemate':
                gameStateDisplay.textContent = 'Stalemate';
                gameStateDisplay.className = 'font-bold text-yellow-400';
                break;
            default:
                gameStateDisplay.textContent = 'Normal';
                gameStateDisplay.className = 'font-bold';
        }
        
        // Update variant display
        const activeVariants = [];
        if (gameState.variants.fischer) activeVariants.push('Fischer');
        if (gameState.variants.dragon) activeVariants.push('Dragon');
        if (gameState.variants.duck) activeVariants.push('Duck');
        
        if (activeVariants.length > 0) {
            gameVariantDisplay.textContent = activeVariants.join(' + ');
        } else {
            gameVariantDisplay.textContent = 'Standard';
        }
        
        // Update variant instructions visibility
        document.querySelectorAll('#variant-instructions p').forEach(p => {
            p.classList.add('hidden');
        });
        
        if (gameState.variants.fischer) {
            document.querySelector('#variant-instructions p[data-variant="fischer"]').classList.remove('hidden');
        }
        if (gameState.variants.dragon) {
            document.querySelector('#variant-instructions p[data-variant="dragon"]').classList.remove('hidden');
        }
        if (gameState.variants.duck) {
            document.querySelector('#variant-instructions p[data-variant="duck"]').classList.remove('hidden');
        }
        
        if (!gameState.variants.fischer && !gameState.variants.dragon && !gameState.variants.duck) {
            document.querySelector('#variant-instructions p:first-child').classList.remove('hidden');
        }
    }
    
    // Show game message
    function showGameMessage(message) {
        const messageElement = gameMessage.querySelector('p');
        messageElement.textContent = message;
        gameMessage.classList.remove('hidden');
        
        setTimeout(() => {
            gameMessage.classList.add('hidden');
        }, 3000);
    }
    
    // Undo the last move
    function undoMove() {
        if (gameState.moveStack.length === 0) {
            showGameMessage('No moves to undo!');
            return;
        }
        
        const lastState = gameState.moveStack.pop();
        
        gameState.board = lastState.board;
        gameState.currentTurn = lastState.currentTurn;
        gameState.gamePhase = lastState.gamePhase;
        gameState.duckPosition = lastState.duckPosition;
        gameState.enPassantTarget = lastState.enPassantTarget;
        gameState.kingPositions = lastState.kingPositions;
        gameState.gameStatus = lastState.gameStatus;
        gameState.moveHistory = lastState.moveHistory;
        
        updateGameStatus();
        updateBoardDisplay();
        showGameMessage('Move undone!');
    }
    
    // Event listeners for toggles
    fischerToggle.addEventListener('change', function() {
        gameState.variants.fischer = this.checked;
        if (this.checked) {
            showGameMessage('Fischer Random mode activated!');
        }
        initializeBoard();
    });
    
    dragonToggle.addEventListener('change', function() {
        gameState.variants.dragon = this.checked;
        if (this.checked) {
            showGameMessage('Dragon Bishop mode activated!');
        }
        initializeBoard();
    });
    
    duckToggle.addEventListener('change', function() {
        gameState.variants.duck = this.checked;
        if (this.checked) {
            showGameMessage('Duck Chess mode activated!');
            gameState.gamePhase = 'move';
            gameState.duckPosition = null;
        }
        initializeBoard();
    });
    
    // Event listeners for buttons
    newGameBtn.addEventListener('click', function() {
        initializeBoard();
        showGameMessage('New game started!');
    });
    
    undoBtn.addEventListener('click', function() {
        undoMove();
    });
    
    flipBoardBtn.addEventListener('click', function() {
        gameState.boardFlipped = !gameState.boardFlipped;
        updateBoardDisplay();
    });
    
    settingsBtn.addEventListener('click', function() {
        showGameMessage('Settings panel coming soon!');
    });
    
    // Initialize the game
    initializeBoard();
}); 