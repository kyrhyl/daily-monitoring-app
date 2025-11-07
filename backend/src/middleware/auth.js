const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token required',
          status: 401
        }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid token - user not found',
          status: 401
        }
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: {
          message: 'User account is deactivated',
          status: 401
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Token has expired',
          status: 401
        }
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: {
          message: 'Invalid token',
          status: 401
        }
      });
    } else {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        error: {
          message: 'Internal server error',
          status: 500
        }
      });
    }
  }
};

// Middleware to check if user has admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: {
        message: 'Admin access required',
        status: 403
      }
    });
  }
  next();
};

// Middleware to check if user has team leader or admin role
const requireTeamLeaderOrAdmin = (req, res, next) => {
  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({
      error: {
        message: 'Team leader or admin access required',
        status: 403
      }
    });
  }
  next();
};

// Middleware to check if user is team leader of specific team or admin
const requireTeamLeaderOfTeamOrAdmin = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }

    const Team = require('../models/Team');
    const teamId = req.params.teamId || req.body.teamId;
    
    if (!teamId) {
      return res.status(400).json({
        error: {
          message: 'Team ID required',
          status: 400
        }
      });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        error: {
          message: 'Team not found',
          status: 404
        }
      });
    }

    if (!team.isTeamLeader(req.user._id)) {
      return res.status(403).json({
        error: {
          message: 'Team leader access required for this team',
          status: 403
        }
      });
    }

    req.team = team;
    next();
  } catch (error) {
    console.error('Team leader middleware error:', error);
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
};

// Middleware to check if user can access project
const requireProjectAccess = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }

    const Project = require('../models/Project');
    const projectId = req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({
        error: {
          message: 'Project ID required',
          status: 400
        }
      });
    }

    const project = await Project.findById(projectId).populate('team');
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Check if user is project manager
    if (project.isProjectManager(req.user._id)) {
      req.project = project;
      return next();
    }

    // Check if user is team leader of the project's team
    if (project.team.isTeamLeader(req.user._id)) {
      req.project = project;
      return next();
    }

    // Check if user is member of the project
    if (project.isAssignedMember(req.user._id)) {
      req.project = project;
      return next();
    }

    return res.status(403).json({
      error: {
        message: 'Access denied to this project',
        status: 403
      }
    });
  } catch (error) {
    console.error('Project access middleware error:', error);
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
};

// Middleware to check if user can manage project (project manager, team leader, or admin)
const requireProjectManagement = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }

    const Project = require('../models/Project');
    const projectId = req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({
        error: {
          message: 'Project ID required',
          status: 400
        }
      });
    }

    const project = await Project.findById(projectId).populate('team');
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Check if user is project manager or team leader
    if (project.isProjectManager(req.user._id) || project.team.isTeamLeader(req.user._id)) {
      req.project = project;
      return next();
    }

    return res.status(403).json({
      error: {
        message: 'Project management access required',
        status: 403
      }
    });
  } catch (error) {
    console.error('Project management middleware error:', error);
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireTeamLeaderOrAdmin,
  requireTeamLeaderOfTeamOrAdmin,
  requireProjectAccess,
  requireProjectManagement
};