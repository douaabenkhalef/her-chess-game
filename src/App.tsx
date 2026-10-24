import { useEffect, useMemo, useState } from "react";

type Color = "white" | "black";
type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
type Piece = { color: Color; type: PieceType };
type Board = Array<Piece | null>;
type GameMode = "computer" | "local";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const pieces: Record<Color, Record<PieceType, string>> = {
  white: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  black: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" },
};
const pieceValues: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

function createBoard(): Board {
  const board: Board = Array(64).fill(null);
  const backRank: PieceType[] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  backRank.forEach((type, column) => {
    board[column] = { color: "black", type };
    board[8 + column] = { color: "black", type: "pawn" };
    board[48 + column] = { color: "white", type: "pawn" };
    board[56 + column] = { color: "white", type };
  });
  return board;
}

function rowOf(index: number) {
  return Math.floor(index / 8);
}

function colOf(index: number) {
  return index % 8;
}

function isClearPath(board: Board, from: number, to: number, rowStep: number, colStep: number) {
  let row = rowOf(from) + rowStep;
  let col = colOf(from) + colStep;
  const targetRow = rowOf(to);
  const targetCol = colOf(to);

  while (row !== targetRow || col !== targetCol) {
    if (board[row * 8 + col]) return false;
    row += rowStep;
    col += colStep;
  }
  return true;
}

function canMove(board: Board, from: number, to: number) {
  const piece = board[from];
  const target = board[to];
  if (!piece || from === to || target?.color === piece.color) return false;

  const rowDelta = rowOf(to) - rowOf(from);
  const colDelta = colOf(to) - colOf(from);
  const absRow = Math.abs(rowDelta);
  const absCol = Math.abs(colDelta);

  if (piece.type === "pawn") {
    const direction = piece.color === "white" ? -1 : 1;
    const startRow = piece.color === "white" ? 6 : 1;
    if (colDelta === 0 && !target && rowDelta === direction) return true;
    if (
      colDelta === 0 &&
      !target &&
      rowOf(from) === startRow &&
      rowDelta === direction * 2 &&
      !board[from + direction * 8]
    )
      return true;
    return absCol === 1 && rowDelta === direction && Boolean(target);
  }

  if (piece.type === "knight") return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
  if (piece.type === "king") return absRow <= 1 && absCol <= 1;

  if (piece.type === "rook" && (rowDelta === 0 || colDelta === 0)) {
    return isClearPath(board, from, to, Math.sign(rowDelta), Math.sign(colDelta));
  }
  if (piece.type === "bishop" && absRow === absCol) {
    return isClearPath(board, from, to, Math.sign(rowDelta), Math.sign(colDelta));
  }
  if (piece.type === "queen" && (rowDelta === 0 || colDelta === 0 || absRow === absCol)) {
    return isClearPath(board, from, to, Math.sign(rowDelta), Math.sign(colDelta));
  }
  return false;
}

function possibleMoves(board: Board, from: number) {
  return board.map((_, index) => index).filter((index) => canMove(board, from, index));
}

function playerName(color: Color) {
  return color === "white" ? "White" : "Black";
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function App() {
  const [board, setBoard] = useState<Board>(createBoard);
  const [turn, setTurn] = useState<Color>("white");
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ board: Board; turn: Color; captured: Piece[] }>>([]);
  const [captured, setCaptured] = useState<Piece[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState("Your move, darling");
  const [mode, setMode] = useState<GameMode>("computer");
  const [winner, setWinner] = useState<Color | null>(null);
  const [paused, setPaused] = useState(false);
  const [clocks, setClocks] = useState<Record<Color, number>>({ white: 600, black: 600 });

  const legalMoves = useMemo(
    () => (selected === null ? [] : possibleMoves(board, selected)),
    [board, selected],
  );
  const displayOrder = useMemo(() => {
    const order = Array.from({ length: 64 }, (_, index) => index);
    return flipped ? order.reverse() : order;
  }, [flipped]);
  const scores = useMemo(
    () => ({
      white: captured
        .filter((piece) => piece.color === "black")
        .reduce((total, piece) => total + pieceValues[piece.type], 0),
      black: captured
        .filter((piece) => piece.color === "white")
        .reduce((total, piece) => total + pieceValues[piece.type], 0),
    }),
    [captured],
  );
  const undoSteps = mode === "computer" && winner !== "white" ? 2 : 1;

  useEffect(() => {
    if (mode !== "computer" || turn !== "black" || winner || paused) return;

    setSelected(null);
    setMessage("The computer is planning its move…");
    const timer = window.setTimeout(() => {
      const moves: Array<{ from: number; to: number; value: number }> = [];
      board.forEach((piece, from) => {
        if (piece?.color !== "black") return;
        possibleMoves(board, from).forEach((to) => {
          const target = board[to];
          const row = rowOf(to);
          const col = colOf(to);
          const centerBonus = row >= 2 && row <= 5 && col >= 2 && col <= 5 ? 0.35 : 0;
          moves.push({
            from,
            to,
            value: (target ? pieceValues[target.type] * 10 : 0) + centerBonus + Math.random(),
          });
        });
      });

      const move = moves.sort((a, b) => b.value - a.value)[0];
      if (!move) {
        setWinner("white");
        setMessage("White wins — beautifully played.");
        return;
      }

      const next = [...board];
      const movingPiece = next[move.from];
      const taken = next[move.to];
      if (!movingPiece) return;
      next[move.to] = { ...movingPiece };
      next[move.from] = null;
      if (movingPiece.type === "pawn" && rowOf(move.to) === 7) {
        next[move.to] = { ...movingPiece, type: "queen" };
      }

      setHistory((items) => [...items, { board: [...board], turn, captured: [...captured] }]);
      if (taken) setCaptured((items) => [...items, taken]);
      setBoard(next);
      setTurn("white");
      if (taken?.type === "king") {
        setWinner("black");
        setMessage("The computer wins this round.");
      } else {
        setMessage(taken ? "The computer captured a piece. Your turn." : "Your turn to take back the advantage");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [board, captured, mode, paused, turn, winner]);

  useEffect(() => {
    if (paused || winner) return;
    const timer = window.setInterval(() => {
      setClocks((current) => {
        const nextTime = Math.max(0, current[turn] - 1);
        if (nextTime === 0) {
          const winningColor = turn === "white" ? "black" : "white";
          setWinner(winningColor);
          setMessage(`${playerName(winningColor)} wins on time.`);
        }
        return { ...current, [turn]: nextTime };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, turn, winner]);

  function chooseSquare(index: number) {
    if (winner || paused || (mode === "computer" && turn === "black")) return;
    const clicked = board[index];

    if (selected !== null && legalMoves.includes(index)) {
      const movingPiece = board[selected];
      if (!movingPiece) return;
      const next = [...board];
      const taken = next[index];
      next[index] = { ...movingPiece };
      next[selected] = null;

      const destinationRow = rowOf(index);
      if (movingPiece.type === "pawn" && (destinationRow === 0 || destinationRow === 7)) {
        next[index] = { ...movingPiece, type: "queen" };
      }

      setHistory((items) => [...items, { board: [...board], turn, captured: [...captured] }]);
      if (taken) setCaptured((items) => [...items, taken]);
      setBoard(next);
      setTurn(turn === "white" ? "black" : "white");
      setSelected(null);
      if (taken?.type === "king") {
        setWinner(turn);
        setMessage(`${playerName(turn)} wins — the crown is yours.`);
      } else {
        setMessage(taken ? "One piece down. Lovely move." : "The other queen is up");
      }
      return;
    }

    if (clicked?.color === turn) {
      setSelected(index);
      setMessage(`${files[colOf(index)]}${8 - rowOf(index)} selected`);
    } else {
      setSelected(null);
      setMessage(`It is ${playerName(turn)}’s turn`);
    }
  }

  function resetGame() {
    setBoard(createBoard());
    setTurn("white");
    setSelected(null);
    setHistory([]);
    setCaptured([]);
    setWinner(null);
    setPaused(false);
    setClocks({ white: 600, black: 600 });
    setMessage("New game, new crown");
  }

  function undoMove() {
    const previous = history.at(-undoSteps);
    if (!previous) return;
    setBoard(previous.board);
    setTurn(previous.turn);
    setHistory((items) => items.slice(0, -undoSteps));
    setCaptured(previous.captured);
    setSelected(null);
    setWinner(null);
    setMessage("Move undone, no one needs to know");
  }

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    setBoard(createBoard());
    setTurn("white");
    setSelected(null);
    setHistory([]);
    setCaptured([]);
    setWinner(null);
    setPaused(false);
    setClocks({ white: 600, black: 600 });
    setMessage(nextMode === "computer" ? "Your turn to challenge the computer" : "Share the board with a friend");
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Checkmate Club">
          <span className="brand-mark">♛</span>
          <span>Her-Chess</span>
        </a>
        <div className="turn-pill">
          <span className={`status-dot ${turn}`} />
          {winner ? `${playerName(winner)} wins` : paused ? "Game paused" : `${playerName(turn)} to move`}
        </div>
        <button className="text-button" onClick={resetGame}>
          New game
        </button>
      </header>

      <section className="game-layout">
        <div className="intro">
          <p className="eyebrow">Private games salon</p>
          <h1>
            Checkmate
            <br />
            <em>darling.</em>
          </h1>
          <p className="intro-copy">
            Sharp strategy, flawless manicure. Make your queen dance and always stay one move ahead.
          </p>

          <div className="mode-switch" aria-label="Game mode">
            <button
              className={mode === "computer" ? "active" : ""}
              onClick={() => changeMode("computer")}
            >
              Play computer
            </button>
            <button className={mode === "local" ? "active" : ""} onClick={() => changeMode("local")}>
              Two players
            </button>
          </div>

          <div className="mini-card">
            <p>Game note</p>
            <strong>{message}</strong>
            <span>Choose a piece, then choose where it should go.</span>
          </div>
        </div>

        <div className="board-column">
          <div className="player-row opponent">
            <div className="avatar dark">N</div>
            <div>
              <strong>{mode === "computer" ? "Computer" : "Velvet Black"}</strong>
              <span>{turn === "black" && !winner ? (paused ? "Paused" : mode === "computer" ? "Thinking…" : "Your move") : "Waiting"}</span>
            </div>
            <time className={`chess-clock ${turn === "black" && !paused && !winner ? "active" : ""}`}>
              {formatTime(clocks.black)}
            </time>
            <span className="score-badge">{scores.black} pts</span>
            <div className="captured-pieces" aria-label="Captured white pieces">
              {captured
                .filter((piece) => piece.color === "white")
                .map((piece, index) => <span key={`${piece.type}-${index}`}>{pieces.white[piece.type]}</span>)}
            </div>
          </div>

          <div className="board-frame">
            <div className="corner-flower top-left" />
            <div className="chess-board" role="grid" aria-label="Chessboard">
              {displayOrder.map((index) => {
                const piece = board[index];
                const row = rowOf(index);
                const col = colOf(index);
                const isSelected = selected === index;
                const isLegal = legalMoves.includes(index);
                return (
                  <button
                    key={index}
                    className={`square ${(row + col) % 2 ? "rose" : "cream"} ${isSelected ? "selected" : ""} ${isLegal ? "legal" : ""}`}
                    onClick={() => chooseSquare(index)}
                    disabled={Boolean(winner) || paused || (mode === "computer" && turn === "black")}
                    aria-label={`${files[col]}${8 - row}${piece ? `, ${piece.type} ${piece.color}` : ""}`}
                    role="gridcell"
                  >
                    {col === (flipped ? 7 : 0) && <span className="rank-label">{8 - row}</span>}
                    {row === (flipped ? 0 : 7) && <span className="file-label">{files[col]}</span>}
                    {isLegal && !piece && <span className="move-dot" />}
                    {piece && (
                      <span className={`piece ${piece.color} ${isLegal ? "capturable" : ""}`}>
                        {pieces[piece.color][piece.type]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="player-row">
            <div className="avatar light">B</div>
            <div>
              <strong>Pearl White</strong>
              <span>{turn === "white" && !winner ? (paused ? "Paused" : "Your move") : "Waiting"}</span>
            </div>
            <time className={`chess-clock ${turn === "white" && !paused && !winner ? "active" : ""}`}>
              {formatTime(clocks.white)}
            </time>
            <span className="score-badge">{scores.white} pts</span>
            <div className="captured-pieces" aria-label="Captured black pieces">
              {captured
                .filter((piece) => piece.color === "black")
                .map((piece, index) => <span key={`${piece.type}-${index}`}>{pieces.black[piece.type]}</span>)}
            </div>
          </div>

          <div className="board-actions">
            <button
              onClick={undoMove}
              disabled={history.length < undoSteps || (mode === "computer" && turn === "black" && !winner)}
            >
              <span aria-hidden="true">↶</span> Undo
            </button>
            <button className="pause-button" onClick={() => setPaused((value) => !value)} disabled={Boolean(winner)}>
              <span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span> {paused ? "Resume" : "Pause"}
            </button>
            <button onClick={() => setFlipped((value) => !value)}>
              <span aria-hidden="true">↻</span> Flip board
            </button>
          </div>
        </div>

        <aside className="side-note">
          <div className="score-card">
            <p>SCOREBOARD</p>
            <div>
              <span>You</span>
              <strong>{scores.white}</strong>
            </div>
            <div>
              <span>{mode === "computer" ? "Computer" : "Opponent"}</span>
              <strong>{scores.black}</strong>
            </div>
            <small>Pawn = 1 · knight/bishop = 3 · rook = 5 · queen = 9</small>
          </div>
          <span className="quote-mark">“</span>
          <blockquote>She remembered who she was and the game changed.</blockquote>
          <div className="divider" />
          <p>SALON RULE NO. 01</p>
          <strong>Protect your peace like you protect your queen.</strong>
        </aside>
      </section>
      <footer>© {new Date().getFullYear()} Douaa Benkhalef. All rights reserved.</footer>
    </main>
  );
}
