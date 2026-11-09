# Play Stockfish

A browser chess app for playing Stockfish across eleven game modes, with an Elo slider you can change mid-game.

## Run it

```
npm install
npm run dev
```

Then open the URL Vite prints. Other commands: `npm test` runs the unit tests and `npm run build` makes a production build.

## Features

- A main menu of game modes, grouped as Classic, Powerups and Challenges
- Click or drag to move, with legal move dots and highlights for the last move and check
- Elo from 400 to 2800, adjustable mid-game, applied from the bot's next move
- Play as White, Black or random, with optional clocks
- Hint, takeback, flip, resign, move review (arrow keys) and PGN copy
- Optional eval bar, captured pieces and synthesised sounds

## Game modes

Modes are listed in `src/lib/modes.ts`, and each needs a thumbnail in `src/components/Menu.tsx`. Where a mode has a difficulty or level, you set it before the game and it can't change during the game.

### Classic

**Normal Chess** is standard chess.

### Powerups

**Sniper Bishops:** double-click any enemy piece your bishops attack diagonally to shoot it without moving. Firing uses your turn, and targets show a crosshair. Rules in `src/lib/sniper.ts`:

- Only your bishops are snipers, including promoted ones. Yours carry a rifle, which is purely cosmetic.
- The king can't be shot.
- A shot counts as a capture: it resets the 50-move count, and as it uses your turn, any en passant chance lapses.
- If you're in check, a shot must end the check. A pinned bishop can still fire.
- A shot can win by discovering checkmate, or draw by stalemate.

**Pawn Spawner:** you start with only a king and one pawn against a full army. The AND / OR button can be switched at any point, except halfway through a turn:

- **AND:** move, then click an empty square to spawn a pawn.
- **OR:** move, or click an empty square to spawn a pawn.

Rules in `src/lib/spawner.ts`:

- **Hard:** pawns spawn on ranks 2 to 7 only, because a pawn on the first or last rank is an invalid position for chess.js and Stockfish.
- **Easy:** pawns can spawn on any empty square. On either back rank the pawn promotes as it lands, and you choose the piece.
- If you're in check, a spawn must block it. You only lose to checkmate if no spawn can save you.
- With no legal move, you can spawn even in AND mode.
- Spawning can give check, checkmate or stalemate.

**Portals:** double left-click an empty square for a blue portal, double right-click for orange. Placing is free and doesn't use your turn, and only you can place them. Any piece from either side that lands on a portal comes out of the other colour. Rules in `src/lib/portals.ts`:

- **Easy:** placing a portal closes the previous one of that colour at once.
- **Hard:** the previous portal stays open for the next 2 moves, counting both sides. Either blue leads to the newest orange, and the reverse.
- A portal does nothing until both colours are on the board.
- An enemy on the exit square is captured, and the move list marks it, like `Bg4→xa3`.
- A piece that can't go through simply stops on the portal square as a normal move. That happens when its own side holds the exit, when an enemy king does, when the exit would leave its own king in check, and when castling.
- Portals carry pieces only, so nothing attacks or gives check through them.
- A pawn that comes out on a back rank promotes.

**Queen Bomb:** your queen moves and captures normally, but explodes when captured. She's drawn as a grenade, bomb or nuke to match the level. Rules in `src/lib/bomb.ts`:

- **Level 1, Grenade:** a plus shape around the capture square.
- **Level 2, Bomb:** a 3x3 area.
- **Level 3, Nuke:** a 5x5 area.
- The blast kills every piece in the area from both sides, including the capturing piece. It never harms a king, so a king that takes your queen survives.
- Only your queens are bombs, including promoted ones.
- It's your turn after the blast. If the blast opens a line from one of your pieces to Stockfish's king, that king could be captured, which isn't a legal position, so you win on the spot.

**Midas Touch:** a normal game, but you can double-click any enemy piece your pieces attack to turn it into a permanent gold blocker. It's free, doesn't use your turn, and has no limit. Rules in `src/lib/midas.ts`:

- "Attacked" means one of your pieces could capture it, pinned pieces included. Kings can't be gilded.
- Gold blockers stay for the rest of the game. Nothing can land on one or pass through it, except that knights jump over as usual, and they attack nothing.
- Pieces you can gild glow gold.
- You only lose to checkmate if no gild could get you out, such as gilding the piece giving check.

**Magnets:** a normal game, but your knights, bishops, rooks and queens carry magnets. Double-click one to pull every enemy piece it attacks right beside it. It's free and doesn't use your turn, once per turn, recharging when you move. Your knights, bishops, rooks and queens carry a little magnet. While it's charged, pieces you can double-click are outlined red with a **2×** tag, enemies they would pull are outlined blue, and hovering a red piece draws arrows to where each pull lands. Rules in `src/lib/magnet.ts`:

- Bishops, rooks and queens pull along their lines to the square next to them, so a fork pulls both pieces.
- Knights pull to their diagonal square on the target's side, and only if it's empty. If two targets share that square, one is chosen at random and the other stays.
- Kings are never pulled. A pull is skipped if it would put your own king in check, or leave the enemy king open to capture on your turn.
- You only lose to checkmate if an unused magnet couldn't get you out.

**Horse Breeding:** a normal game, but when you move a knight next to another of your knights, in any of the 8 surrounding squares, a new knight appears on a random empty square beside that herd. A herd is every knight of yours connected through neighbouring squares. Rules in `src/lib/horses.ts`:

- It happens as part of your move, one foal per move, and the move list marks it, like `Nf3 🐴g4`.
- Only your knights breed, including a pawn that promotes to a knight next to one. Captures count too.
- A foal can give check or checkmate, but it never appears where it would make a third check at once, which Stockfish can't handle.
- The API refuses more than 16 pieces a side, so past that, Stockfish gets a copy with your furthest extras removed. Its reply is still checked against the real board.

### Challenges

**Stockfish vs SCP-096:** SCP-096 starts on a random square in the two middle ranks and stays put until something can see it. After each Black move, if any piece from either side could attack its square, it moves there and eats that piece. Rules in `src/lib/scp.ts`:

- It can't be captured, and it blocks movement and attacks for both sides.
- If several pieces see it, it picks one at random, however far away. It eats one piece per round.
- A king that sees it can be eaten, and that side loses.
- It skips a meal that would leave Black's king capturable, because that position would be illegal.
- **Easy:** you can see the whole board. **Hard:** fog of war (below).

**Stockfish vs SCP-173:** the opposite of 096. It starts on a random square in the two middle ranks. After each Black move, if no piece from either side can attack its square, it makes one knight jump towards the nearest king. Rules in `pickJump` in `src/lib/scp.ts`:

- "Nearest" means fewest knight moves, jumping over anything in the way, so a king right beside it can be further than one across the board. If both kings are equally near, it picks one at random.
- While any piece except a king can attack its square, it stays frozen. Kings don't count, or it could never reach one.
- It doesn't avoid pieces, and kills whatever it lands on.
- If it reaches a king, that side loses, whichever side that is.
- It can't be captured and blocks lines, like 096.
- **Easy:** you can see the whole board. **Hard:** fog of war (below). This difficulty is saved separately from 096's.

**Fog of war** (Hard in both SCP modes), in `src/lib/fog.ts`: you only see your own pieces and the squares they can move to or attack. Sliders see up to and including the first piece. Pawns see straight ahead only as far as they can move, so whatever blocks them stays hidden, and they always see their diagonals. The SCP is hidden too unless one of your pieces sees it. The bot's moves show as `???`, and the eval bar, hints, captured pieces and Copy PGN are off until the game ends, when the fog lifts. Normal check rules still apply, so a refused move can hint at a hidden piece. Stockfish sees the whole board.

**Boss Fight:** you start with a king and one pawn against a full army, with three powers. Each works once before you move, and all three recharge when you move. They're free, so you still make your move. Rules in `src/lib/boss.ts`:

- **Snatch:** double left-click an enemy piece and an astronaut runs in from the right and takes it. It can't take the king, or a piece that's the only thing shielding the king from your own attack, as that would leave an illegal position on your turn.
- **Hole:** double left-click an empty square to remove it for good. Nothing can land on it or pass through it, except that knights can jump over it.
- **Summon:** double right-click your first or second row for a new pawn on your second row, in that file. A pawn can't legally stand on the first row.
- You only lose to checkmate if no single power can get you out.

### Controls in the special modes

- Powers that use a double-click give way to a selected piece, so click away from it first.
- Right-clicks need a mouse, so orange portals and Summon can't be used on a touchscreen.
- En passant works in every mode, for both sides.

## How Stockfish handles the custom rules

The API only accepts a normal chess position, so Stockfish never knows about any mode's rules. It plays normal chess, and the app works around that:

- **Hidden board features:** SCP creatures, holes and gold blockers are held on the board as hidden pieces, so chess.js blocks lines and squares correctly. Stockfish is sent a position without the SCP creatures. Holes and gold reach it as stand-in pieces of the side to move, so it sees them as blocked. When that side already has 16 pieces, the API limit, the stand-in is the other colour instead, and Stockfish may think it can capture it.
- **Pawn and piece limits:** the API returns no move for a side with more than 8 pawns or 16 pieces. In Pawn Spawner, past that, Stockfish gets a simplified copy where your extra pawns become bishops or are removed.
- **Checking every reply:** every reply is checked against the real board. If it doesn't fit, such as a move through an SCP or onto a hole, gold or stand-in, the bot plays a local move instead, and the panel labels it as a backup.
- **Side effects:** stand-ins count as extra material, so in Midas Touch and Boss Fight the eval bar leans a little towards the side to move. Hints ignore each mode's special rules.

## How the Elo works

The bot uses the free [stockfish.online](https://stockfish.online) REST API. That API has no Elo setting and only accepts depths 5 to 15, so strength is emulated in `src/lib/strength.ts`:

- Higher Elo sends a deeper search to Stockfish.
- Lower Elo replaces a share of Stockfish's moves with imperfect moves from a small local picker (`src/lib/weakMove.ts`). At 400 that is about 75% of moves. At 2800 it is none.

The numbers are hand-tuned and not calibrated against rated play, so treat the Elo as a difficulty scale. The panel shows where each bot move came from.

## API limits

The API blocks bursts of about 6 quick requests. `src/lib/stockfishApi.ts` sends everything through one queue, at most one request every 3 seconds, and retries with backoff. If the API stays down, the app pauses the bot's clock and offers a retry or a clearly labelled local backup move.
