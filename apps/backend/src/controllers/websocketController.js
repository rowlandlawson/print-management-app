import { getConnectedUsers, getConnectedAdmins } from '../websocket/notificationServer.js';

export const getWebSocketStatus = async (req, res) => {
  try {
    const connectedUsers = getConnectedUsers();
    const connectedAdmins = getConnectedAdmins();
    
    res.json({
      status: 'active',
      connected_users: connectedUsers.length,
      connected_admins: connectedAdmins.length,
      users: connectedUsers,
      admins: connectedAdmins,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get WebSocket status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};