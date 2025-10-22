import notificationService from '../services/notificationService.js';

export const getUserNotifications = async (req, res) => {
  try {
    const { limit, unreadOnly } = req.query;
    
    const notifications = await notificationService.getUserNotifications(
      req.user.userId, 
      { 
        limit: limit ? parseInt(limit) : undefined, 
        unreadOnly: unreadOnly === 'true' 
      }
    );
    
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.userId);
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id, req.user.userId);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};