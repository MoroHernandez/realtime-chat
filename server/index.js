import express from 'express'
import logger from 'morgan'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()

const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
    connectionStateRecovery: {}
})

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
}

const connection = await mysql.createConnection(config)


try {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content TEXT,
        user TEXT

        ) 
    `)
} catch (e) {
    console.error('Error creating table: ', e);
}

io.on('connection', async (socket) => {
    console.log('a user has connected!');

    let username = socket.handshake.auth.username ?? 'anonymous'

    socket.on('disconnect', () => {
        console.log('a user has disconnected');
    })

    socket.on('chat message', async (msg) => {
        try {

            const [result] = await connection.execute(
                'INSERT INTO messages (content, user) VALUES (?, ?)',
                [msg, username]
            );
    
            io.emit('chat message', msg, result.insertId.toString(), username);
        } catch (e) {
            console.error(e);
            return
        }
    })

    if (!socket.recovered) {
        try {
            const [results] = await connection.execute(`
                SELECT id, content, user FROM messages WHERE id > ?`,
                [socket.handshake.auth.serverOffset ?? 0]
            );
    
            results.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user);
            });
        } catch (e) {
            console.error(e);
        }
    }
})

app.use(logger('dev'))

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
    console.log(`server running on port http://localhost:${port}`);
})

