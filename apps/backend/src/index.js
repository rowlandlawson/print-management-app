import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import jobRoutes from './routes/jobs.js';
import notificationRoutes from './routes/notifications.js';
import websocketRoutes from './routes/websocket.js';
import paymentRoutes from './routes/payments.js';
import inventoryRoutes from './routes/inventory.js';
import operationalExpensesRoutes from './routes/operationalExpenses.js';
import customerRoutes from './routes/customers.js';
import reportRoutes from './routes/reports.js';

// Import WebSocket
import { setupNotificationWebSocket } from './websocket/notificationServer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/operational-expenses', operationalExpensesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`��� Server running on port ${PORT}`);
  console.log(`��� Environment: ${process.env.NODE_ENV}`);
  console.log(`��� Health check: http://localhost:${PORT}/api/health`);
  console.log(`��� User management: http://localhost:${PORT}/api/users`);
  console.log(`��� Job management: http://localhost:${PORT}/api/jobs`);
  console.log(`�� Notifications: http://localhost:${PORT}/api/notifications`);
  console.log(`��� WebSocket: ws://localhost:${PORT}/ws/notifications`);
  console.log(`��� Payments: http://localhost:${PORT}/api/payments`);
  console.log(`��� Inventory: http://localhost:${PORT}/api/inventory`);
  console.log(`��� Expenses: http://localhost:${PORT}/api/operational-expenses`);
});

// Setup WebSocket for real-time notifications
setupNotificationWebSocket(server);
