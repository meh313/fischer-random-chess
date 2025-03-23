# Fischer Random Chess (Chess960)

A web-based implementation of Fischer Random Chess (Chess960) that allows players to enjoy this exciting chess variant online with friends.

## About Chess960

Chess960 (also known as Fischer Random Chess) is a variant of chess designed by the legendary chess champion Bobby Fischer. The main difference from standard chess is that the initial position of the pieces on the back rank is randomized according to specific rules:

- Pawns remain in their traditional positions
- The king must be placed between the two rooks
- Bishops must be placed on opposite-colored squares
- The remaining pieces are randomly arranged

This randomization creates 960 different possible starting positions, hence the name "Chess960".

## Features

- Random piece placement generator following Fischer Chess rules
- Interactive chessboard with drag-and-drop piece movement
- Multiplayer functionality for playing with friends
- Game state management (moves, turns, game status)
- Move history with algebraic notation
- Support for game actions (resign, offer draw)

## How to Play

1. Open the game in your web browser
2. Click "New Game" to start a new single-player game with a random Chess960 position
3. To play with a friend, click "Invite Friend" and share the generated link
4. Make moves by clicking a piece and then clicking its destination, or by dragging and dropping

## Development

This project is built with vanilla JavaScript, HTML, and CSS, with no external dependencies.

### Project Structure

- `index.html` - Main HTML file
- `styles.css` - CSS styles
- `js/` - JavaScript files
  - `chess.js` - Core chess logic and rules
  - `board.js` - Chessboard UI and interaction
  - `game.js` - Game management
  - `socket.js` - Multiplayer functionality
  - `main.js` - Application initialization
- `img/pieces/` - SVG chess piece images

## Local Development

To run the game locally:

1. Clone the repository
2. Open `index.html` in your web browser

No build process or server is required for basic functionality.

## Future Improvements

- Full implementation of multiplayer with a proper backend server
- User accounts and game history
- Time controls
- AI opponent
- Mobile-friendly touch support
- Sound effects

## License

This project is released under the MIT License. 