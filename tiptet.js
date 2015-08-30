var controller = (function(){
  var fallSpeed = 0.7;
  var lastDirection = [0,0];
  var currentTime = new Date().getTime();
  var previousTime = currentTime;

  var keys = {
    16 : holdPiece,
    32 : quickDrop,
    37 : moveLeft,
    39 : moveRight,
    38 : rotateRight,
    40 : moveDown,
    88 : rotateRight,
    90 : rotateLeft,
  }

  function holdPiece(){
    board.holdPiece();
  }

  function initControls(){
    $(document).keydown('keyDown', function(e) {
      if (keys[e.keyCode]) {
        keys[e.keyCode]();
      }
    })
  }

  function quickDrop(){
    board.quickDrop();
  }

  function rotateLeft(){
    board.rotateLeft();
    if (board.score() > 6){ renderer.spinCanvas(90) };
  }

  function rotateRight(){
    board.rotateRight();
    if (board.score() > 6){ renderer.spinCanvas(-90) };
  }

  function moveLeft(){
    lastDirection = [-1,0];
    if (board.score() > 1){ renderer.spinCanvas(-2) };
  }

  function moveRight(){
    lastDirection = [1, 0];
    if (board.score() > 1){ renderer.spinCanvas(2) };
  }

  function moveDown(){
    lastDirection = [0, 1];
  }

  function play(){
    initControls();
    renderer.init();

    board.restartGame();

    function frame(){
      currentTime = new Date().getTime();
      board.update(Math.min(1, (currentTime - previousTime) / 1000.0), lastDirection);
      lastDirection = [0,0];
      redraw();
      previousTime = currentTime;
      gameOver(board.gameStart());
    }
    setInterval(function(e){
      frame();
    }, 15);

    setInterval(function(e){
      if (board.score() > 10){
        renderer.spinCanvas();
        renderer.recolorBackground();
      }
    }, 2000);
  }

  function redraw(){
    renderer.drawScore(board.score());
    renderer.draw(board.currentPiece(), board.gameBoard(), board.gameStart());
    renderer.drawSidePieces(board.nextPiece(), board.heldPiece());
  }

  function gameOver(gameStart){
    if (!gameStart) renderer.gameOver();
  }

  return {
    play: play,
  };
})();

var board = (function(){
  var gameBoard = [],
      currentPiece,
      nextPiece,
      heldPiece,
      alreadyHeld,
      width = 10,
      height = 20,
      maxRot = 3,
      step = .01,
      gameStart = false,
      score = 0,
      dt = 0;

  // Blocks are defined in 16 bits to simplify states of rotation
  var allBlocks = {
    i: { size: 4, blocks: [0x2222, 0x0F00, 0x4444, 0x00F0], color: 'cyan'  , offset: {x:0, y: 0 } },
    j: { size: 3, blocks: [0x44C0, 0x8E00, 0x6440, 0x0E20], color: 'blue'  , offset: {x:3, y: -1 } },
    l: { size: 3, blocks: [0x4460, 0x0E80, 0xC440, 0x2E00], color: 'orange', offset: {x:1, y: -1 } },
    o: { size: 2, blocks: [0xCC00, 0xCC00, 0xCC00, 0xCC00], color: 'yellow', offset: {x:3, y: -2 } },
    s: { size: 3, blocks: [0x06C0, 0x8C40, 0x6C00, 0x4620], color: 'green' , offset: {x:2, y: 0 } },
    t: { size: 3, blocks: [0x0E40, 0x4C40, 0x4E00, 0x4640], color: 'purple', offset: {x:2, y: 0 } },
    z: { size: 3, blocks: [0x0C60, 0x4C80, 0xC600, 0x2640], color: 'red'   , offset: {x:2, y: 0 } },
  }

  // Takes a given block type, an x and y position, a direction, and applies a function.
  function eachblock(type, x, y, dir, fn) {
    var bit, result, row = 0, col = 0, blocks = type.blocks[dir];
    for(bit = 0x8000 ; bit > 0 ; bit = bit >> 1) {
      if (blocks & bit) {
        fn(x + col, y + row);
      }
      if (++col === 4) {
        col = 0;
        ++row;
      }
    }
  }

  function restartGame(){
    dt = 0;
    clearBoard();
    setCurrentPiece();
    setNextPiece();
    alreadyHeld = false;
    score = 0;
    step = .5;
    gameStart = true;
  }

  function getScore(){
    return score;
  }

  function clearBoard(){
    gameBoard = [];
  }

  function setCurrentPiece(newPiece) {
    currentPiece = newPiece || nextPiece || randomPiece();
  }

  function setNextPiece(newPiece){
    nextPiece = newPiece || randomPiece();
  }

  function holdPiece(){
    if (!alreadyHeld){
      alreadyHeld = true;
      heldPiece ? swapCurrentPiece() : yankCurrentPiece();
    }
  }

  function swapCurrentPiece(){
    heldPiece.y = 0;
    tmp = currentPiece;
    currentPiece = heldPiece;
    heldPiece = tmp;
  }

  function yankCurrentPiece(){
    heldPiece = currentPiece;
    heldPiece.y = 0;
    setCurrentPiece();
    setNextPiece();
  }

  function getBoard(){
    return gameBoard;
  }

  function occupied(type, x, y, dir) {
    var result = false
    eachblock(type, x, y, dir, function(x, y) {
      if ((x < 0) || (x >= width) || (y < 0) || (y >= height) || getBlock(x,y))
        result = true;
    });
    return result;
  }

  function setBlock(x,y,type) {
    gameBoard[x] = gameBoard[x] || [];
    gameBoard[x][y] = type;
  }

  function unoccupied(type, x, y, dir){
    return !occupied(type, x, y, dir);
  }

  function randomPiece() {
    randomType = ["i","j","l","o","s","t","z"];
    var type = allBlocks[randomType[Math.floor(Math.random() * randomType.length)]];
    return { type: type, dir: 0, x: Math.round(0 + (Math.random() * (width - type.size))), y: 0 };
  }

  function inGame(){
    return gameStart;
  }


  // Moves the piece when an input is pressed, applies gravity.
  function update(idt, dir){
    if (gameStart){
      move(dir);
      applyGravity(idt);
    }
  }

  // Make the piece drop if enough time has elapsed
  function applyGravity(idt){
    dt = dt + idt;
    if (dt > step){
      dt = dt - step
      drop();
    }
  }

  // Attempts to move the piece with given direction and returns true/false.
  function move(direction){
    if (direction === null) return false;

    var x = currentPiece.x;
    var y = currentPiece.y;

    if (unoccupied(currentPiece.type, x + direction[0], y + direction[1], currentPiece.dir)){
      currentPiece.x += direction[0];
      currentPiece.y += direction[1];
      return true;
    } else {
      return false;
    }
  }

  function rotateLeft(){
    // Cycle to the next rotation type and loop back to 0 if on last.
    var newdir = (currentPiece.dir == 0? maxRot : currentPiece.dir - 1);
    if (unoccupied(currentPiece.type, currentPiece.x, currentPiece.y, newdir)){
      currentPiece.dir = newdir;
    }
  }

  function rotateRight(){
    // Cycle to the next rotation type and loop back to 0 if on last.
    var newdir = (currentPiece.dir == maxRot? 0 : currentPiece.dir + 1);
    if (unoccupied(currentPiece.type, currentPiece.x, currentPiece.y, newdir)){
      currentPiece.dir = newdir;
    }
  }

  function drop(){
    // Recall that move will return true if the piece can be moved.
    // If the piece cannot move down, fix it in place and do what
    // needs to be done to set up a new piece.
    if (!move([0, 1])){
      dropNewPiece();
      alreadyHeld = false;
      return true;
    }
    return false;
  }

  function quickDrop(){
    if (gameStart){
      while(!drop());
    }
  }

  function dropNewPiece(){
    dropPiece();
    clearLines();
    setCurrentPiece();
    setNextPiece(randomPiece());
    checkGameOver();
  }

  function checkGameOver(){
    if (occupied(currentPiece.type, currentPiece.x, currentPiece.y, currentPiece.dir)){
      dropPiece();
      gameStart = false;
    }
  }

  function dropPiece(){
    eachblock(currentPiece.type, currentPiece.x, currentPiece.y, currentPiece.dir, function(x, y) {
      setBlock(x, y, currentPiece.type);
    });
  }

  function getBlock(x,y) {
    return (gameBoard && gameBoard[x] ? gameBoard[x][y] : null);
  }

  function clearLines(){
    var lineCount = clearIndividualLines();

    if (lineCount > 0){
      score += lineCount;
      step = .5 - score/90;
      if (step < .1) step = .1;
    }
  }

  // Clears the lines and returns how maheight were cleared.
  function clearIndividualLines(){
    var lineCount = 0;
    var fullLine;
    for (var y = height; y > 0; y--){
      fullLine = true;
      for(x = 0; x < width; x++){
        // If there is aheight square that is empty in the given line,
        // We'll be done calling clearLine().
        if (!getBlock(x, y)) fullLine = false;
      }
      if (fullLine){
        clearLine(y);
        y = y + 1
        lineCount++;
      }
    }
    return lineCount;
  }

  function clearLine(ypos){
    for(var y = ypos; y >= 0; --y){
      for(var x = 0; x < width; ++x){
        setBlock(x, y, (y==0) ? null : getBlock(x, y-1));
      }
    }
  }

  function getCurrentPiece(){
    return currentPiece;
  }

  function getNextPiece(){
    return nextPiece;
  }

  function getHeldPiece(){
    return heldPiece;
  }


  return {
    gameBoard: getBoard,
    restartGame: restartGame,
    drop: drop,
    move: move,
    score: getScore,
    update: update,
    rotateLeft: rotateLeft,
    rotateRight: rotateRight,
    quickDrop: quickDrop,
    currentPiece: getCurrentPiece,
    nextPiece: getNextPiece,
    holdPiece: holdPiece,
    heldPiece: getHeldPiece,
    gameStart: inGame,
  };
})();


var renderer = (function(){
  var canvas;
  var currentSpin = 0;
  var transitioning = false;
  var lines, background, preview, hold;
  function init(){
    initCanvas();
    cacheElements();
    initOverlay();
  }

  function initCanvas(){
    setInterval(function(){
      transitioning = false;
    }, 6000);
    canvas = $("#canvas");
    canvas.on("transitionend MSTransitionEnd webkitTransitionEnd oTransitionEnd",
      function() {
        transitioning = false;  // Transition has ended.
      }
    );
  }

  function cacheElements(){
    background = $('html');
    lines = $("#lines");
    preview = $("#preview");
    hold = $("#hold");
  }

  function initOverlay(){
    gameOverOverlay = $('#game-over');
    gameOverOverlay.click(function(e){
      gameOverOverlay.hide(0);
      canvas.css("transform", "rotate(0deg)");
      currentSpin = 0;
      board.restartGame();
    })
  }

  function eachblock(type, x, y, dir, fn) {
    var bit, result, row = 0, col = 0, blocks = type.blocks[dir];
    for(bit = 0x8000 ; bit > 0 ; bit = bit >> 1) {
      if (blocks & bit) {
        fn(x + col, y + row);
      }
      if (++col === 4) {
        col = 0;
        ++row;
      }
    }
  }

  function draw(current, board, gameStart){
    canvas.clearCanvas();
    drawCurrentPiece(current, gameStart)
    drawBoard(board);
  }

  function drawCurrentPiece(current, gameStart){
    if (gameStart){
      drawPiece(current.type, current.x, current.y, current.dir);
    }
  }

  function drawPiece(type, x, y, dir) {
    eachblock(type, x, y, dir, function(x, y) {
      drawBlock(x, y, type.color);
    });
  }

  function drawBoard(board){
    var block;
    for (var y = 0; y < 20; y++){
      for(var x = 0; x < 10; x++){
        block = (board[x] ? board[x][y] : null);
        if(block){
          drawBlock(x, y, block.color);
        }
      }
    }
  }

  function drawSidePieces(next, held){
    preview.clearCanvas();
    hold.clearCanvas();
    if (preview) drawNextPiece(next);
    if (held) drawHoldPiece(held);
  }

  function drawNextPiece(type){
    eachblock(type.type, 0, 0, 0, function(x, y){
      drawSideBlock(x, y, type.type.color, preview, type.type.offset);
    });
  }

  function drawHoldPiece(type){
    eachblock(type.type, 0, 0, 0, function(x, y){
      drawSideBlock(x, y, type.type.color, hold, type.type.offset);
    });
  }

  function drawSideBlock(x, y, color, target, offset){
    target.drawRect({
      strokeStyle: 'black',
      strokeWidth: 2,
      fillStyle: color,
      x: 10 + (offset.x * 10) + x * 20,
      y: 20 - (offset.y * 10) + y * 20,
      width: 20,
      height: 20,
      //fronCenter: false,
    })
  }

  function drawBlock(x, y, color){
    canvas.drawRect({
      strokeStyle: 'black',
      strokeWidth: 2,
      fillStyle: color,
      x: (x * canvas.width()/10),
      y: (y * canvas.height()/20),
      width: (canvas.width()/10),
      height: (canvas.height()/20),
      fromCenter: false
    });
  }

  function drawScore(score){
    lines.text(score);
  }

  function spinCanvas(deg){
    if (!deg){
      currentSpin += Math.ceil(Math.random() * 360) - 180;
      currentSpin = Math.abs(currentSpin);
    } else {
      currentSpin += deg;
    }
    if (currentSpin > 360) {currentSpin = currentSpin % 360};

    if (!transitioning){
      canvas.css("transform", "rotate(" + currentSpin + "deg)");
      canvas.css("box-shadow", "" + Math.cos(currentSpin) * 60 + "px " + Math.sin(currentSpin) * 60 + "px 60px #222");
      transitioning = true;
    }
  }

  function recolorBackground(){
    var randomColor = '#'+Math.floor(Math.random()*16777215).toString(16);
    background.css("background-color", randomColor);
  }

  function gameOver(){
    if (!gameOverOverlay.is(':visible')) {
      gameOverOverlay.fadeTo(0, .7);
    }

  }

  return {
    draw: draw,
    drawBlock: drawBlock,
    drawSidePieces: drawSidePieces,
    drawScore: drawScore,
    init: init,
    spinCanvas: spinCanvas,
    recolorBackground: recolorBackground,
    gameOver: gameOver,
  };
})();

$(document).ready(function(){
  controller.play();
})
