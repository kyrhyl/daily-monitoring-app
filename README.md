# Daily Monitoring Web Application

A comprehensive full-stack daily monitoring and task management web application built with React, Node.js, Express, and MongoDB.

## 🚀 Features

### User Management
- **Role-based Access Control**: Admin, Team Leader, and Member roles
- **User Authentication**: JWT-based authentication system
- **Admin Controls**: Promote/demote users, manage user accounts
- **Default Admin**: Auto-created admin account (admin@dailymonitoring.com / admin123)

### Team Management
- **Team Creation**: Admins can create teams and assign leaders
- **Member Management**: Add/remove team members
- **Team Leadership**: Team leaders can manage their teams

### Project Management
- **Project Creation**: Team leaders can create projects for their teams
- **Project Assignment**: Assign team members to projects
- **Project Tracking**: Monitor project progress and status
- **Budget Management**: Track allocated and spent budgets

### Task Management
- **Task Assignment**: Team leaders can assign tasks to team members
- **Progress Tracking**: Real-time task status updates
- **Priority Management**: Set task priorities (low, medium, high, critical)
- **Due Date Tracking**: Monitor overdue and upcoming tasks
- **Comments System**: Task-level communication
- **Dependencies**: Define task dependencies

### Dashboard & Analytics
- **Role-based Dashboards**: Customized views for each user role
- **Statistics**: Overview of tasks, projects, and team performance
- **Progress Charts**: Visual representation of progress
- **Recent Activity**: Track recent tasks and updates

## 🏗️ Architecture

### Backend (Node.js/Express)
- **RESTful API**: Clean API endpoints for all operations
- **MongoDB**: Document-based database with Mongoose ODM
- **Authentication**: JWT token-based authentication
- **Authorization**: Role-based middleware protection
- **Validation**: Request validation using Joi
- **Security**: Helmet, CORS, rate limiting

### Frontend (React)
- **Modern React**: Hooks, Context API, functional components
- **Routing**: React Router v6 with protected routes
- **State Management**: React Context + useReducer
- **UI Components**: Responsive design with Tailwind CSS
- **API Integration**: Axios with interceptors
- **Form Handling**: React Hook Form for form management

### Database Schema
- **Users**: Authentication, roles, profiles
- **Teams**: Team structure and membership
- **Projects**: Project details, assignments, budgets
- **Tasks**: Task management, dependencies, comments

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16+
- MongoDB (local or MongoDB Atlas)
- Git

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone <your-repo-url>
   cd DailyMonitoring
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Create environment file
   cp .env.example .env
   # Edit .env with your configuration
   
   # Start development server
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   
   # Start React development server
   npm start
   ```

4. **Environment Variables**
   
   Backend (.env):
   ```
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/daily-monitoring
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRE=30d
   FRONTEND_URL=http://localhost:3000
   ```

### Railway Deployment

This application is configured for easy deployment on Railway.

1. **Prepare for Deployment**
   - Ensure all environment variables are set
   - MongoDB connection string (Railway MongoDB add-on)
   - JWT secret for production

2. **Deploy Backend**
   ```bash
   # From the backend directory
   railway login
   railway init
   railway add mongodb
   railway deploy
   ```

3. **Deploy Frontend**
   ```bash
   # From the frontend directory
   # Update REACT_APP_API_URL in production
   railway deploy
   ```

4. **Environment Variables for Railway**
   ```
   NODE_ENV=production
   MONGODB_URI=[Railway MongoDB Connection String]
   JWT_SECRET=[Production JWT Secret]
   FRONTEND_URL=[Your Frontend URL]
   ```

## 📊 User Roles & Permissions

### Admin
- ✅ Manage all users (create, update, delete, promote/demote)
- ✅ Create and manage teams
- ✅ View all projects and tasks
- ✅ Access system-wide statistics
- ✅ Full system access

### Team Leader
- ✅ Manage assigned teams
- ✅ Create and manage projects for their teams
- ✅ Assign tasks to team members
- ✅ View team-specific analytics
- ✅ Promote team collaboration

### Member
- ✅ View assigned tasks
- ✅ Update task progress and status
- ✅ Add comments to tasks
- ✅ View team and project information
- ✅ Access personal dashboard

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration (admin only)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout
- `PUT /api/auth/change-password` - Change password

### User Management
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/promote` - Promote user (admin only)
- `PUT /api/users/:id/demote` - Demote user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Team Management
- `GET /api/teams` - Get teams
- `GET /api/teams/:id` - Get team by ID
- `POST /api/teams` - Create team (admin only)
- `PUT /api/teams/:id` - Update team
- `POST /api/teams/:id/members` - Add team member
- `DELETE /api/teams/:id/members/:userId` - Remove team member

### Project Management
- `GET /api/projects` - Get projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create project (team leader+)
- `PUT /api/projects/:id` - Update project
- `POST /api/projects/:id/members` - Add project member
- `DELETE /api/projects/:id/members/:userId` - Remove project member

### Task Management
- `GET /api/tasks` - Get tasks
- `GET /api/tasks/my-tasks` - Get my assigned tasks
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create task (team leader+)
- `PUT /api/tasks/:id` - Update task
- `PUT /api/tasks/:id/progress` - Update task progress
- `POST /api/tasks/:id/comments` - Add task comment

## 🎨 Frontend Pages

- **Dashboard**: Role-based overview with statistics
- **Login**: User authentication
- **Users** (Admin only): User management interface
- **Teams**: Team overview and management
- **Projects** (Team Leader+): Project management interface
- **Tasks**: Task management and tracking
- **Profile**: User profile management

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Middleware for permission checking
- **Input Validation**: Server-side validation using Joi
- **Password Hashing**: bcryptjs for secure password storage
- **CORS Protection**: Cross-origin request protection
- **Rate Limiting**: API rate limiting for security
- **Helmet**: Security headers protection

## 🚀 Technology Stack

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **MongoDB**: NoSQL database
- **Mongoose**: MongoDB ODM
- **JWT**: Authentication tokens
- **bcryptjs**: Password hashing
- **Joi**: Input validation
- **Helmet**: Security middleware
- **CORS**: Cross-origin resource sharing
- **Express Rate Limit**: API rate limiting

### Frontend
- **React 18**: Frontend framework
- **React Router v6**: Client-side routing
- **Axios**: HTTP client
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hook Form**: Form handling
- **React Query**: Data fetching and caching
- **React Toastify**: Notifications
- **date-fns**: Date manipulation
- **Recharts**: Data visualization

## 📱 Responsive Design

The application is fully responsive and works on:
- ✅ Desktop computers
- ✅ Tablets
- ✅ Mobile phones
- ✅ Various screen sizes

## 🔧 Development Scripts

### Backend
```bash
npm start        # Start production server
npm run dev      # Start development server with nodemon
npm test         # Run tests
```

### Frontend
```bash
npm start        # Start development server
npm run build    # Build for production
npm test         # Run tests
npm run eject    # Eject from Create React App
```

## 📈 Future Enhancements

- **Email Notifications**: Task assignments and due date reminders
- **File Attachments**: Upload and manage task-related files
- **Time Tracking**: Detailed time logging for tasks
- **Reports**: Advanced analytics and reporting
- **Calendar Integration**: Task scheduling and calendar views
- **Mobile App**: Native mobile applications
- **Real-time Updates**: WebSocket integration for live updates
- **Advanced Permissions**: Granular permission system
- **Audit Logs**: Track all system changes
- **API Rate Limiting**: Enhanced rate limiting and throttling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation
- Review the API endpoints

## 🙏 Acknowledgments

- React team for the amazing framework
- Express.js community
- MongoDB for the flexible database
- Railway for easy deployment
- Tailwind CSS for the utility-first approach
- All the open-source contributors

---

**Happy Monitoring! 🚀**