const express = require('express');
const Project = require('../models/Project');
const Team = require('../models/Team');
const User = require('../models/User');
const { authenticateToken, requireTeamLeaderOrAdmin, requireProjectAccess, requireProjectManagement } = require('../middleware/auth');
const { validate, validateObjectId, validateQuery, projectValidationSchemas, paginationSchema } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/projects
// @desc    Get all projects (filtered by user access)
// @access  Private
router.get('/', authenticateToken, validateQuery(paginationSchema.keys({
  status: require('joi').string().valid('planning', 'active', 'on_hold', 'completed', 'cancelled'),
  priority: require('joi').string().valid('low', 'medium', 'high', 'critical'),
  teamId: require('joi').string().pattern(/^[0-9a-fA-F]{24}$/)
})), async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc', search, status, priority, teamId } = req.query;
    
    // Build query based on user role and access
    let query = {};
    
    if (req.user.role === 'admin') {
      // Admin can see all projects
    } else if (req.user.role === 'team_leader') {
      // Team leaders can see projects from their teams
      const userTeams = await Team.find({ teamLeader: req.user._id });
      const teamIds = userTeams.map(team => team._id);
      query.team = { $in: teamIds };
    } else {
      // Members can see projects they are assigned to
      query.$or = [
        { 'assignedMembers.user': req.user._id },
        { projectManager: req.user._id }
      ];
    }
    
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      });
    }
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (teamId) query.team = teamId;

    const projects = await Project.find(query)
      .populate('team', 'name teamLeader')
      .populate('projectManager', 'name email')
      .populate('assignedMembers.user', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Project.countDocuments(query);

    // Add computed fields
    const projectsWithComputed = projects.map(project => ({
      ...project,
      duration: project.endDate && project.startDate ? 
        Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24)) : 0,
      progressPercentage: (() => {
        const now = new Date();
        if (project.status === 'completed') return 100;
        if (project.status === 'cancelled') return 0;
        if (now < new Date(project.startDate)) return 0;
        if (now > new Date(project.endDate)) return 100;
        
        const totalDuration = new Date(project.endDate).getTime() - new Date(project.startDate).getTime();
        const elapsed = now.getTime() - new Date(project.startDate).getTime();
        return Math.round((elapsed / totalDuration) * 100);
      })()
    }));

    res.json({
      message: 'Projects retrieved successfully',
      data: {
        projects: projectsWithComputed,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProjects: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/projects/stats
// @desc    Get project statistics
// @access  Private (Team Leader or Admin)
router.get('/stats', authenticateToken, requireTeamLeaderOrAdmin, async (req, res) => {
  try {
    // Build query based on user role
    let matchQuery = {};
    
    if (req.user.role === 'team_leader') {
      const userTeams = await Team.find({ teamLeader: req.user._id });
      const teamIds = userTeams.map(team => team._id);
      matchQuery.team = { $in: teamIds };
    }

    const stats = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          activeProjects: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          completedProjects: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'completed'] },
                    { $ne: ['$status', 'cancelled'] },
                    { $lt: ['$endDate', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalBudgetAllocated: { $sum: '$budget.allocated' },
          totalBudgetSpent: { $sum: '$budget.spent' }
        }
      }
    ]);

    const statusDistribution = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityDistribution = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const recentProjects = await Project.find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('team', 'name')
      .populate('projectManager', 'name')
      .select('name status priority startDate endDate team projectManager')
      .lean();

    res.json({
      message: 'Project statistics retrieved successfully',
      data: {
        overview: stats[0] || {
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          overdueTasks: 0,
          totalBudgetAllocated: 0,
          totalBudgetSpent: 0
        },
        statusDistribution,
        priorityDistribution,
        recentProjects
      }
    });

  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/projects/:id
// @desc    Get project by ID
// @access  Private (Project access required)
router.get('/:id', authenticateToken, validateObjectId('id'), requireProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const project = await Project.findById(projectId)
      .populate('team', 'name description teamLeader members')
      .populate('projectManager', 'name email profile')
      .populate('assignedMembers.user', 'name email role profile')
      .populate('createdBy', 'name email');

    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Get project tasks count
    const Task = require('../models/Task');
    const taskStats = await Task.aggregate([
      { $match: { project: project._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: { $sum: '$actualHours' }
        }
      }
    ]);

    const projectWithStats = {
      ...project.toObject(),
      taskStats,
      duration: project.duration,
      progressPercentage: project.progressPercentage,
      budgetUtilization: project.budgetUtilization,
      isOverdue: project.status !== 'completed' && project.status !== 'cancelled' && new Date() > project.endDate
    };

    res.json({
      message: 'Project retrieved successfully',
      data: {
        project: projectWithStats
      }
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   POST /api/projects
// @desc    Create new project (Team Leader or Admin)
// @access  Private (Team Leader or Admin)
router.post('/', authenticateToken, requireTeamLeaderOrAdmin, validate(projectValidationSchemas.create), async (req, res) => {
  try {
    const { name, description, team, projectManager, assignedMembers, status, priority, startDate, endDate, budget, tags } = req.body;

    // Check if project name already exists within the team
    const existingProject = await Project.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      team: team
    });
    if (existingProject) {
      return res.status(400).json({
        error: {
          message: 'Project with this name already exists in the team',
          status: 400
        }
      });
    }

    // Verify team exists and user has access
    const teamDoc = await Team.findById(team);
    if (!teamDoc) {
      return res.status(404).json({
        error: {
          message: 'Team not found',
          status: 404
        }
      });
    }

    // Check if user can create projects in this team
    if (req.user.role !== 'admin' && !teamDoc.isTeamLeader(req.user._id)) {
      return res.status(403).json({
        error: {
          message: 'Only team leaders can create projects for their team',
          status: 403
        }
      });
    }

    // Verify project manager exists and is part of the team
    const manager = await User.findById(projectManager);
    if (!manager) {
      return res.status(404).json({
        error: {
          message: 'Project manager not found',
          status: 404
        }
      });
    }

    if (!teamDoc.isMember(projectManager)) {
      return res.status(400).json({
        error: {
          message: 'Project manager must be a team member',
          status: 400
        }
      });
    }

    // Verify all assigned members are part of the team
    if (assignedMembers && assignedMembers.length > 0) {
      const memberIds = assignedMembers.map(member => member.user);
      for (const memberId of memberIds) {
        if (!teamDoc.isMember(memberId)) {
          return res.status(400).json({
            error: {
              message: 'All assigned members must be team members',
              status: 400
            }
          });
        }
      }
    }

    // Create project
    const project = new Project({
      name: name.trim(),
      description,
      team,
      projectManager,
      assignedMembers: assignedMembers || [],
      status: status || 'planning',
      priority: priority || 'medium',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      budget: budget || { allocated: 0, spent: 0 },
      tags: tags || [],
      createdBy: req.user._id
    });

    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate('team', 'name')
      .populate('projectManager', 'name email')
      .populate('assignedMembers.user', 'name email role')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Project created successfully',
      data: {
        project: populatedProject
      }
    });

  } catch (error) {
    console.error('Create project error:', error);
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

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private (Project management access required)
router.put('/:id', authenticateToken, requireProjectManagement, validateObjectId('id'), validate(projectValidationSchemas.update), async (req, res) => {
  try {
    const projectId = req.params.id;
    const updateData = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Check if new name already exists within the team
    if (updateData.name && updateData.name !== project.name) {
      const existingProject = await Project.findOne({ 
        name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
        team: project.team,
        _id: { $ne: projectId }
      });
      if (existingProject) {
        return res.status(400).json({
          error: {
            message: 'Project with this name already exists in the team',
            status: 400
          }
        });
      }
    }

    // Verify new project manager if provided
    if (updateData.projectManager && updateData.projectManager !== project.projectManager.toString()) {
      const manager = await User.findById(updateData.projectManager);
      if (!manager) {
        return res.status(404).json({
          error: {
            message: 'New project manager not found',
            status: 404
          }
        });
      }

      const team = await Team.findById(project.team);
      if (!team.isMember(updateData.projectManager)) {
        return res.status(400).json({
          error: {
            message: 'New project manager must be a team member',
            status: 400
          }
        });
      }
    }

    // Set completion date if status changes to completed
    if (updateData.status === 'completed' && project.status !== 'completed') {
      updateData.actualEndDate = new Date();
    }

    // Update project
    Object.assign(project, updateData);
    await project.save();

    const updatedProject = await Project.findById(projectId)
      .populate('team', 'name')
      .populate('projectManager', 'name email')
      .populate('assignedMembers.user', 'name email role')
      .populate('createdBy', 'name email');

    res.json({
      message: 'Project updated successfully',
      data: {
        project: updatedProject
      }
    });

  } catch (error) {
    console.error('Update project error:', error);
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

// @route   POST /api/projects/:id/members
// @desc    Add member to project
// @access  Private (Project management access required)
router.post('/:id/members', authenticateToken, requireProjectManagement, validateObjectId('id'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const { userId, role = 'developer' } = req.body;

    const project = await Project.findById(projectId).populate('team');
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Check if user exists and is part of the team
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return res.status(404).json({
        error: {
          message: 'User not found or inactive',
          status: 404
        }
      });
    }

    if (!project.team.isMember(userId)) {
      return res.status(400).json({
        error: {
          message: 'User must be a team member to be assigned to project',
          status: 400
        }
      });
    }

    // Check if user is already assigned
    if (project.isAssignedMember(userId)) {
      return res.status(400).json({
        error: {
          message: 'User is already assigned to this project',
          status: 400
        }
      });
    }

    // Add member
    project.addMember(userId, role);
    await project.save();

    const updatedProject = await Project.findById(projectId)
      .populate('team', 'name')
      .populate('projectManager', 'name email')
      .populate('assignedMembers.user', 'name email role')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Member added to project successfully',
      data: {
        project: updatedProject
      }
    });

  } catch (error) {
    console.error('Add project member error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   DELETE /api/projects/:id/members/:userId
// @desc    Remove member from project
// @access  Private (Project management access required)
router.delete('/:id/members/:userId', authenticateToken, requireProjectManagement, validateObjectId('id'), validateObjectId('userId'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.params.userId;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Prevent removing project manager
    if (project.projectManager.toString() === userId) {
      return res.status(400).json({
        error: {
          message: 'Cannot remove project manager. Assign a new manager first.',
          status: 400
        }
      });
    }

    // Check if user is assigned
    if (!project.isAssignedMember(userId)) {
      return res.status(404).json({
        error: {
          message: 'User is not assigned to this project',
          status: 404
        }
      });
    }

    // Check for active tasks
    const Task = require('../models/Task');
    const activeTasks = await Task.find({
      project: projectId,
      assignedTo: userId,
      status: { $in: ['todo', 'in_progress', 'review'] }
    });

    if (activeTasks.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot remove user with active tasks. Reassign tasks first.',
          status: 400,
          details: {
            activeTasks: activeTasks.map(task => ({ id: task._id, title: task.title, status: task.status }))
          }
        }
      });
    }

    // Remove member
    project.removeMember(userId);
    await project.save();

    const updatedProject = await Project.findById(projectId)
      .populate('team', 'name')
      .populate('projectManager', 'name email')
      .populate('assignedMembers.user', 'name email role')
      .populate('createdBy', 'name email');

    res.json({
      message: 'Member removed from project successfully',
      data: {
        project: updatedProject
      }
    });

  } catch (error) {
    console.error('Remove project member error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project (Admin or Project Manager)
// @access  Private (Admin or Project Manager)
router.delete('/:id', authenticateToken, requireProjectManagement, validateObjectId('id'), async (req, res) => {
  try {
    const projectId = req.params.id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Check if project has active tasks
    const Task = require('../models/Task');
    const activeTasks = await Task.find({
      project: projectId,
      status: { $in: ['todo', 'in_progress', 'review'] }
    });

    if (activeTasks.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot delete project with active tasks',
          status: 400,
          details: {
            activeTasks: activeTasks.map(task => ({ id: task._id, title: task.title, status: task.status }))
          }
        }
      });
    }

    await Project.findByIdAndDelete(projectId);

    res.json({
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

module.exports = router;