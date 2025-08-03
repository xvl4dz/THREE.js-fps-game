// const http = require('http')
// const fs = require('fs')
// const path = require('path')
// const { Server } = require('socket.io')

import * as http from 'http'
import { Server } from "socket.io"
import * as fs from 'fs'
import * as path from 'path'

//const { spawn } = require('child_process')


var cache= {}

const httpPort = 8080

let appPath
let staticDir
let modulePath

const os = process.platform
if (os === 'win32') {
  appPath    = './server/'
  staticDir  = './src'
  modulePath = './node_modules/'
} else {
  appPath    = '/home/blastbox.io/blastbox/server/'
  staticDir  = '/home/blastbox.io/blastbox/src'
  modulePath = '/home/blastbox.io/blastbox/node_modules/'
}


import mime from 'mime'              

const httpServer = http.createServer( (request,response) => {
  r(request,response)
})

const io = new Server(httpServer)

httpServer.listen(httpPort, () => { 
  console.log("Server running on port " + httpPort)
})

const r = (request,response) =>
{       
  var filePath = false  
  if (request.url === '/')  
  {
    filePath = staticDir + '/index.html'          
  } else {
    filePath = staticDir + request.url
  }
  if (filePath)
  {
    var absPath = filePath
    serveStatic(response, cache, absPath)
  }
}

const send404 = (response) =>
{
  response.writeHead(404, {'Content-Type': 'text/plain'})
  response.write('Error 404: resource not found. Go home, clown . . . what are you even doing here ._.')
  response.end()
}

const sendFile = (response, filePath, fileContents) => 
{
  response.writeHead(
  200,
   {"content-type": mime.getType(path.basename(filePath))}
  )
  response.end(fileContents)
}

const serveStatic = (response, cache, absPath) => 
{
  if (cache[absPath]) {   
    sendFile(response, absPath, cache[absPath])
  } else {
    fs.exists(absPath, (exists) => {
      if (exists) {
        fs.readFile(absPath, (err, data) => {
            if (err) {
              send404(response)
            } else {
              cache[absPath] = data
              sendFile(response, absPath, data)
            }       
        })
      } else {
        send404(response)
      }
    })
  }
}

const players = {}
const rooms = {}


const setup = () => {
  io.on('connection', (socket) => {
    console.log("a user connected")
    
    players[socket.id] = {
      position: [0, 0, 0],
      direction: [0, 0, 0],
      username: null,
      score: 0,
      inGame: false, //flag for leaderboard
      orientation: 10,
      turnDelta: 0
    }

    for (let id in rooms) {
      if (Object.keys(rooms[id]).length < 6) {
        socket.join(id)
        players[socket.id].roomId = id
        rooms[id][socket.id] = players[socket.id]
        break
      }
    }
    if ( !players[socket.id].roomId ) {
      socket.join('#' + socket.id)
      players[socket.id].roomId = '#' + socket.id
      rooms['#' + socket.id] = {}
      rooms['#' + socket.id][socket.id] = players[socket.id]
    }
    
    
    socket.on('username', (username) => {
      players[socket.id].username = username
      
      socket.to(players[socket.id].roomId).emit(
        'playerConnected', 
        socket.id, 
        players[socket.id].username,
        io.engine.clientsCount
        )
      })
      
      console.log(rooms)
      console.log(players)
      
    socket.emit(
      'initPlayer',
      socket.id,
      io.engine.clientsCount,
      Object.keys(rooms[players[socket.id].roomId]),
      rooms[players[socket.id].roomId]
    )

      
    socket.on('disconnect', () => {
      socket.to(players[socket.id].roomId).emit(
        'playerDisconnected',
        socket.id,
        io.engine.clientsCount
      )

        
      if (Object.keys(rooms[players[socket.id].roomId]).length <= 0) {
        delete rooms[players[socket.id].roomId]
      } else {
        delete rooms[players[socket.id].roomId][socket.id] 
      }
      delete players[socket.id]
    })

    socket.on('position', (position, direction, orientation, turnDelta) => {
      if (players[socket.id]) {
        players[socket.id].position = position
        players[socket.id].direction = direction
        players[socket.id].orientation = orientation
        players[socket.id].turnDelta = turnDelta
      }
    })


    socket.on('shoot', (bullet) => {
      socket.to(players[socket.id].roomId).emit('shoot', bullet)
    })

    socket.on('playerHit', (shotID, bullet, point) => {
      socket.to(players[socket.id].roomId).emit(
        'playerHit', 
        socket.id,
        shotID,
        bullet,
        point
      )
    })

    socket.on('playerKilled', (killerID, killedID) => {
      players[killerID].score++
      players[killedID].score = 0
      players[killedID].inGame = false

      socket.to(players[socket.id].roomId).emit(
        'playerKilled', 
        killerID, 
        killedID,
      )
    })

    socket.on('spawn', () => {
      players[socket.id].inGame = true

      socket.to(players[socket.id].roomId).emit(
        'spawn',
        socket.id
      )
    })
  })
}

setup()
setInterval(() => {
  for (let id in rooms) {
    io.sockets.to(id).volatile.emit('positions', rooms[id])
  }
}, 15)





