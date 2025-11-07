const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate, validateObjectId, validateQuery, userValidationSchemas, paginationSchema } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/', authenticateToken, requireAdmin, validateQuery(paginationSchema.keys({
  role: require('joi').string().valid('admin', 'team_leader', 'member'),
  isActive: require('joi').boolean(),
  department: require('joi').string()
})), async (req, res) => {
  try {
    const { page, limit, sort, order, search, role, isActive, department } = req.query;
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.department': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) query.role = role;
    if (typeof isActive !== 'undefined') query.isActive = isActive;
    if (department) query['profile.department'] = { $regex: department, $options: 'i' };

    // Execute query with pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sort]: order === 'asc' ? 1 : -1 },
      populate: {
        path: 'teams',
        select: 'name'
      },
      select: '-password'
    };

    const result = await User.paginate(query, options);

    res.json({
      message: 'Users retrieved successfully',
      data: {
        users: result.docs,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalUsers: result.totalDocs,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics (Admin only)
// @access  Private/Admin
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          adminCount: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          teamLeaderCount: { $sum: { $cond: [{ $eq: ['$role', 'team_leader'] }, 1, 0] } },
          memberCount: { $sum: { $cond: [{ $eq: ['$role', 'member'] }, 1, 0] } }
        }
      }
    ]);

    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt')
      .lean();

    res.json({
      message: 'User statistics retrieved successfully',
      data: {
        overview: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          adminCount: 0,
          teamLeaderCount: 0,
          memberCount: 0
        },
        roleDistribution,
        recentUsers
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private/Admin or Self
router.get('/:id', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user can access this profile
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        error: {
          message: 'Access denied',
          status: 403
        }
      });
    }

    const user = await User.findById(userId)
      .populate('teams', 'name description teamLeader')
      .populate('createdBy', 'name email')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    res.json({
      message: 'User retrieved successfully',
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   POST /api/users
// @desc    Create new user (Admin only)
// @access  Private/Admin
router.post('/', authenticateToken, requireAdmin, validate(userValidationSchemas.register), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        error: {
          message: 'User with this email already exists',
          status: 400
        }
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'member',
      createdBy: req.user._id
    });

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'User created successfully',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          status: 400,
          details: Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message
          }))
        }
      });
    }
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private/Admin or Self (limited fields for self)
router.put('/:id', authenticateToken, validateObjectId('id'), validate(userValidationSchemas.updateUser), async (req, res) => {
  try {
    const userId = req.params.id;
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user._id.toString() === userId;

    // Check permissions
    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        error: {
          message: 'Access denied',
          status: 403
        }
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    // Restrict fields for non-admin users
    const allowedFields = isAdmin 
      ? ['name', 'email', 'role', 'isActive', 'profile']
      : ['name', 'profile'];

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    // Prevent users from changing email to existing one
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email.toLowerCase(),
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(400).json({
          error: {
            message: 'Email already in use by another user',
            status: 400
          }
        });
      }
      updateData.email = updateData.email.toLowerCase();
    }

    // Prevent self-deactivation for admins
    if (isAdmin && isSelf && updateData.isActive === false) {
      return res.status(400).json({
        error: {
          message: 'Cannot deactivate your own account',
          status: 400
        }
      });
    }

    // Update user
    Object.assign(user, updateData);
    await user.save();

    const updatedUser = await User.findById(userId)
      .populate('teams', 'name')
      .select('-password');

    res.json({
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          status: 400,
          details: Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message
          }))
        }
      });
    }
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   PUT /api/users/:id/promote
// @desc    Promote user to team leader (Admin only)
// @access  Private/Admin
router.put('/:id/promote', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        error: {
          message: 'Cannot modify admin role',
          status: 400
        }
      });
    }

    if (user.role === 'team_leader') {
      return res.status(400).json({
        error: {
          message: 'User is already a team leader',
          status: 400
        }
      });
    }

    user.role = 'team_leader';
    await user.save();

    const updatedUser = await User.findById(userId).select('-password');

    res.json({
      message: 'User promoted to team leader successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Promote user error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   PUT /api/users/:id/demote
// @desc    Demote team leader to member (Admin only)
// @access  Private/Admin
router.put('/:id/demote', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        error: {
          message: 'Cannot modify admin role',
          status: 400
        }
      });
    }

    if (user.role === 'member') {
      return res.status(400).json({
        error: {
          message: 'User is already a member',
          status: 400
        }
      });
    }

    // Check if user is leading any teams
    const Team = require('../models/Team');
    const teamsLed = await Team.find({ teamLeader: userId, isActive: true });
    
    if (teamsLed.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot demote user who is leading active teams',
          status: 400,
          details: {
            teamsLed: teamsLed.map(team => ({ id: team._id, name: team.name }))
          }
        }
      });
    }

    user.role = 'member';
    await user.save();

    const updatedUser = await User.findById(userId).select('-password');

    res.json({
      message: 'User demoted to member successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Demote user error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (Admin only)
// @access  Private/Admin
router.delete('/:id', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deletion
    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        error: {
          message: 'Cannot delete your own account',
          status: 400
        }
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    // Check if user has dependencies (teams, projects, tasks)
    const Team = require('../models/Team');
    const Project = require('../models/Project');
    const Task = require('../models/Task');

    const [teamsLed, projectsManaged, tasksAssigned] = await Promise.all([
      Team.find({ teamLeader: userId }),
      Project.find({ projectManager: userId }),
      Task.find({ assignedTo: userId, status: { $in: ['todo', 'in_progress', 'review'] } })
    ]);

    const dependencies = [];
    if (teamsLed.length > 0) dependencies.push(`${teamsLed.length} teams as leader`);
    if (projectsManaged.length > 0) dependencies.push(`${projectsManaged.length} projects as manager`);
    if (tasksAssigned.length > 0) dependencies.push(`${tasksAssigned.length} active tasks`);

    if (dependencies.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot delete user with active dependencies',
          status: 400,
          details: {
            dependencies,
            suggestion: 'Please reassign or complete these items before deletion, or deactivate the user instead'
          }
        }
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

module.exports = router;