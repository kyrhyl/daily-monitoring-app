# Daily Monitoring Web App

This is a full-stack daily monitoring web application built with React, Node.js, Express, and MongoDB.

## Architecture
- **Frontend**: React with React Router, Axios for API calls
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens
- **Deployment**: Railway with GitHub integration

## User Roles
- **Admin**: Can manage all users, promote members to team leaders, create teams
- **Team Leader**: Can create projects and assign tasks to team members
- **Member**: Can view assigned tasks and update their progress

## Project Structure
- `/frontend` - React application
- `/backend` - Node.js/Express API server
- `/docs` - Documentation and setup guides

## Development Guidelines
- Use ES6+ syntax
- Implement proper error handling
- Follow REST API conventions
- Use environment variables for configuration
- Implement proper validation and sanitization