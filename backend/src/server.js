const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  trustProxy: true
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/daily-monitoring';
console.log('Connecting to MongoDB:', mongoUrl.replace(/\/\/.*@/, '//*****@')); // Hide credentials in logs

mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authSource: 'admin', // Required for Railway MongoDB
  authMechanism: 'SCRAM-SHA-1'
})
.then(() => {
  console.log('Connected to MongoDB');
  
  // Create default admin user if it doesn't exist
  const User = require('./models/User');
  const bcrypt = require('bcryptjs');
  
  User.findOne({ email: 'admin@dailymonitoring.com' })
    .then(adminUser => {
      if (!adminUser) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        const defaultAdmin = new User({
          name: 'System Admin',
          email: 'admin@dailymonitoring.com',
          password: hashedPassword,
          role: 'admin'
        });
        
        defaultAdmin.save()
          .then(() => console.log('Default admin user created'))
          .catch(err => console.error('Error creating default admin:', err));
      }
    })
    .catch(err => console.error('Error checking for admin user:', err));
})
.catch((error) => console.error('MongoDB connection error:', error));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'Daily Monitoring API is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(error.status || 500).json({
    error: {
      message: error.message || 'Internal Server Error',
      status: error.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});