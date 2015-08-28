var controller = (function(){
  var fallSpeed = 0.7;
  var lastDirection = [0,0];
  var currentTime = new Date().getTime();
  var previousTime = currentTime;
  var gameStart = true;

  var keys = {
    37 : moveLeft,
    38 : rotate,
    39 : moveRight,
    40 : moveDown,
  }
  function isStarted(){
    return gameStart;
  }

  function initControls(){
    $(document).keydown('keyDown', function(e) {
      if (keys[e.keyCode]) {
        keys[e.keyCode]();
      }
    })
  }

  function rotate(){
    board.rotate();
  }

  function moveLeft(){
    console.log("Go left!")
    lastDirection = [-1,0];
  }

  function moveRight(){
    lastDirection = [1, 0];
  }

  function moveDown(){
    lastDirection = [0, 1];
  }

  function play(){
    initControls();
    renderer.initCanvas();

    board.restartGame();

    function frame(){
      currentTime = new Date().getTime();
      board.update(Math.min(1, (currentTime - previousTime) / 1000.0));
      lastDirection = [0,0];
      renderer.draw(board.currentPiece(), board.gameBoard());
      previousTime = currentTime;
    }
    setInterval(frame, 100);

  }

  function lastDir(){
    return lastDirection;
  }

  return {
    play: play,
    gameStart: isStarted,
    lastDirection: lastDir,
  };
})();

var board = (function(){
  var gameBoard = [],
      currentPiece = [],
      nextPiece = [],
      width = 10,
      height = 20,
      maxRot = 3,
      step = .6
      dt = 0;

  // Blocks are defined in 16 bits to simplify states of rotation
  var allBlocks = {
    i: { size: 4, blocks: [0x0F00, 0x2222, 0x00F0, 0x4444], color: 'cyan'},
    j: { size: 3, blocks: [0x44C0, 0x8E00, 0x6440, 0x0E20], color: 'blue'   },
    l: { size: 3, blocks: [0x4460, 0x0E80, 0xC440, 0x2E00], color: 'orange' },
    o: { size: 2, blocks: [0xCC00, 0xCC00, 0xCC00, 0xCC00], color: 'yellow' },
    s: { size: 3, blocks: [0x06C0, 0x8C40, 0x6C00, 0x4620], color: 'green'  },
    t: { size: 3, blocks: [0x0E40, 0x4C40, 0x4E00, 0x4640], color: 'purple' },
    z: { size: 3, blocks: [0x0C60, 0x4C80, 0xC600, 0x2640], color: 'red'    },
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
    setCurrentPiece();
    setNextPiece();
  }

  function setCurrentPiece(newPiece) {
    currentPiece = newPiece || randomPiece();
  }

  function setNextPiece(newPiece){
    nextPiece = newPiece || randomPiece();
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


  // Moves the piece when an input is pressed, applies gravity.
  function update(idt){
    if (controller.gameStart){
      move(controller.lastDirection());
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
      console.log("Droppin");
      currentPiece.x += direction[0];
      currentPiece.y += direction[1];
      return true;
    } else {
      return false;
    }
  }

  function rotate(){
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
    }
  }

  function dropNewPiece(){
    dropPiece();
    clearLines();
    setCurrentPiece();
    setNextPiece(randomPiece());
    clearActions();
    checkGameOver();
  }

  function checkGameOver(){
    if (occupied(currentPiece.type, currentPiece.x, currentPiece.y, currentPiece.dir)){
      gameOver();
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
      // Increase the cleared lines count, and adjust the step speed accordingly.
      addRows(lineCount);
    }
  }

  // Clears the lines and returns how maheight were cleared.
  function clearIndividualLines(){
    var lineCount = 0;
    var fullLine;
    for (var y = height; y > 0; y--){
      fullLine = true;
      for(x = 0; x < width; ++x){
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



  return {
    gameBoard: getBoard,
    restartGame: restartGame,
    drop: drop,
    move: move,
    update: update,
    rotate: rotate,
    currentPiece: getCurrentPiece,
  };
})();


var renderer = (function(){
  var canvas;
  function initCanvas(){
    console.log("SettingCanvas");
    canvas = $('canvas');
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

  function draw(current, board){
    canvas.clearCanvas();
    drawCurrentPiece(current)
    drawBoard(board);
  }

  function drawCurrentPiece(current){
    if (controller.gameStart){
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

  function drawBlock(x, y, color){
    canvas.drawRect({
      fillStyle: color,
      x: (x * canvas.width()/10),
      y: (y * canvas.height()/20),
      width: (canvas.width()/10),
      height: (canvas.height()/20),
      fromCenter: false
    });
  }

  return {
    draw: draw,
    drawBlock: drawBlock,
    initCanvas: initCanvas,
  };
})();

$(document).ready(function(){
  controller.play();
})


    // $("canvas").drawRect({
      // fillStyle: "#000",
      // x: 100,
      // y: 100,
      // width: 100,
      // height: 100,
    //   fromCenter: false
    // });
