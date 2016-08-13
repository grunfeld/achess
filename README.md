# achess.js
Chess tournament (Arena format) organizer using Node.js, Mongodb and Express.
In this design the server acts as a "middleman" thereby simplfying state-restoration when
the player disconnects --> reconnects.

## Build instructions

### Windows

1. Install MongoDB
2. Install node.js and npm
3. Make sure that the "Path" environment variable has the entries for MongoDB and npm
(Mine has C:\Program Files\MongoDB\Server\3.2\bin\;C:\Users\avaidya\AppData\Roaming\npm)
4. Install bower through npm

```sh
Start mongod.exe from the command line prompt (or Powershell)
```
And then from a different command prompt, go inside the achess folder and...

```sh
$ npm install
$ bower install
$ node achess.js
```

### Ubuntu

1. Install MongoDB
2. Install node
3. Install npm
4. Install bower

## How to play?
1. Server starts at http://localhost:3333/
2. First create an account by the name "admin". Logout. Only admin can start the tournament.
3. The next time when you log-on as an admin, you will see a button to start the tournament. Click on that and logout.
4. Create a bunch of player accounts. These players can now participate in the tournament.

## Thanks!
1. [chess.js](http://github.com)
2. [chessboard.js](http://chessboardjs.com/)
3. [gamehub.io](https://github.com/benas/gamehub.io)
4. [realchess](https://github.com/dwcares/realchess)

The project was inspired by [lichess.org](https://en.lichess.org/)'s tournament format. Great website, I am big fan, you will love it too. Do become their patron!