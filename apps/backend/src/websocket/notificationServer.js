import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const connectedAdmins = new Set();
const connectedUsers = new Map();

export function setupNotificationWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws/notifications' });

  wss.on('connection', (ws, request) => {
    console.log('🔌 New WebSocket connection attempt');
    
    // Extract token from query string
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'Authentication token required');
      return;
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = decoded;
      
      console.log(`🔌 WebSocket connected for user: ${user.name} (${user.role})`);
      
      // Store connection with user info
      connectedUsers.set(ws, user);
      
      // If user is admin, add to admin set
      if (user.role === 'admin') {
        connectedAdmins.add(ws);
      }

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('Received message:', data);
          
          // Handle different message types
          switch (data.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
              break;
            case 'subscribe':
              ws.send(JSON.stringify({ 
                type: 'subscribed', 
                channels: data.channels,
                timestamp: new Date().toISOString() 
              }));
              break;
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      });

      ws.on('close', () => {
        const user = connectedUsers.get(ws);
        console.log(`🔌 WebSocket connection closed for user: ${user?.name}`);
        
        connectedUsers.delete(ws);
        if (user?.role === 'admin') {
          connectedAdmins.delete(ws);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Successfully connected to notification server',
        user: {
          id: user.userId,
          name: user.name,
          role: user.role
        },
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      ws.close(1008, 'Invalid authentication token');
    }
  });

  console.log('🔌 WebSocket notification server started with authentication');
  return wss;
}

export function broadcastToAdmins(message) {
  const messageString = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });
  
  let sentCount = 0;
  connectedAdmins.forEach(admin => {
    if (admin.readyState === 1) { // 1 = OPEN
      admin.send(messageString);
      sentCount++;
    }
  });
  
  console.log(`📢 Broadcasted to ${sentCount} admin(s): ${message.notification?.title}`);
}

export function broadcastToUser(userId, message) {
  const messageString = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });
  
  let sent = false;
  connectedUsers.forEach((user, ws) => {
    if (user.userId === userId && ws.readyState === 1) {
      ws.send(messageString);
      sent = true;
    }
  });
  
  return sent;
}

export function getConnectedUsers() {
  const users = [];
  connectedUsers.forEach((user, ws) => {
    if (ws.readyState === 1) {
      users.push({
        id: user.userId,
        name: user.name,
        role: user.role,
        connectionTime: new Date().toISOString()
      });
    }
  });
  return users;
}

export function getConnectedAdmins() {
  const admins = [];
  connectedAdmins.forEach(ws => {
    const user = connectedUsers.get(ws);
    if (user && ws.readyState === 1) {
      admins.push({
        id: user.userId,
        name: user.name,
        connectionTime: new Date().toISOString()
      });
    }
  });
  return admins;
}