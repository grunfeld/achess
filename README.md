# achess.js
Chess tournament (Arena format) organizer using Node.js, Mongodb and Express.
In this design the server acts as a "middleman" thereby simplfying state-restoration when
the player disconnects --> reconnects.

## Live demo
Project was deployed directly from github with Heroku [here](https://peaceful-taiga-36791.herokuapp.com).

## Build instructions

### Windows

1. Install MongoDB
2. Install node.js and npm
3. Make sure that the "Path" environment variable has the entries for MongoDB and npm
(Mine has C:\Program Files\MongoDB\Server\3.2\bin\;C:\Users\avaidya\AppData\Roaming\npm)
4. Install bower through npm

```sh
$ cd "C:\Program Files\MongoDB\Server\3.2\bin"  (the path will change depending upon your installation folder and version)
$ mongod.exe
```
You may also want to install git for easy checkout. And then from a different command-prompt checkout, build and run the project in a following way,

```sh
$ git clone https://github.com/grunfeld/achess.git  # or download and extract the achess folder from github
$ cd achess
$ npm install
$ bower install
$ node achess.js
```

### Ubuntu

1. [Install MongoDB](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)
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

The project was inspired by [lichess.org](https://en.lichess.org/)'s tournament format.
