const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const { authenticateToken, requireProjectAccess, requireProjectManagement } = require('../middleware/auth');
const { validate, validateObjectId, validateQuery, taskValidationSchemas, paginationSchema } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/tasks
// @desc    Get all tasks (filtered by user access)
// @access  Private
router.get('/', authenticateToken, validateQuery(paginationSchema.keys({
  status: require('joi').string().valid('todo', 'in_progress', 'review', 'completed', 'cancelled'),
  priority: require('joi').string().valid('low', 'medium', 'high', 'critical'),
  type: require('joi').string().valid('feature', 'bug', 'improvement', 'research', 'testing', 'documentation', 'other'),
  projectId: require('joi').string().pattern(/^[0-9a-fA-F]{24}$/),
  assignedTo: require('joi').string().pattern(/^[0-9a-fA-F]{24}$/),
  overdue: require('joi').boolean()
})), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'createdAt', 
      order = 'desc', 
      search, 
      status, 
      priority, 
      type, 
      projectId, 
      assignedTo, 
      overdue 
    } = req.query;
    
    // Build query based on user role and access
    let query = {};
    
    if (req.user.role === 'admin') {
      // Admin can see all tasks
    } else if (req.user.role === 'team_leader') {
      // Team leaders can see tasks from projects in their teams
      const userProjects = await Project.find({
        $or: [
          { projectManager: req.user._id },
          { 'assignedMembers.user': req.user._id }
        ]
      }).select('_id');
      
      const projectIds = userProjects.map(project => project._id);
      query.project = { $in: projectIds };
    } else {
      // Members can see tasks assigned to them
      query.assignedTo = req.user._id;
    }
    
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      });
    }
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    if (projectId) query.project = projectId;
    if (assignedTo) query.assignedTo = assignedTo;
    
    // Handle overdue filter
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $nin: ['completed', 'cancelled'] };
    }

    const tasks = await Task.find(query)
      .populate('project', 'name team')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Task.countDocuments(query);

    // Add computed fields
    const tasksWithComputed = tasks.map(task => ({
      ...task,
      duration: task.dueDate && task.startDate ? 
        Math.ceil((new Date(task.dueDate) - new Date(task.startDate)) / (1000 * 60 * 60 * 24)) : 0,
      timeRemaining: (() => {
        if (['completed', 'cancelled'].includes(task.status)) return 0;
        const now = new Date();
        if (task.dueDate) {
          const timeDiff = new Date(task.dueDate).getTime() - now.getTime();
          return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        }
        return 0;
      })(),
      isOverdue: !['completed', 'cancelled'].includes(task.status) && new Date() > new Date(task.dueDate),
      progressPercentage: (() => {
        const statusProgress = {
          'todo': 0,
          'in_progress': 25,
          'review': 75,
          'completed': 100,
          'cancelled': 0
        };
        return statusProgress[task.status] || 0;
      })()
    }));

    res.json({
      message: 'Tasks retrieved successfully',
      data: {
        tasks: tasksWithComputed,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTasks: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/tasks/my-tasks
// @desc    Get tasks assigned to current user
// @access  Private
router.get('/my-tasks', authenticateToken, validateQuery(paginationSchema.keys({
  status: require('joi').string().valid('todo', 'in_progress', 'review', 'completed', 'cancelled')
})), async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'dueDate', order = 'asc', status } = req.query;
    
    let query = { assignedTo: req.user._id };
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate('project', 'name team')
      .populate('assignedBy', 'name email')
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Task.countDocuments(query);

    // Add computed fields
    const tasksWithComputed = tasks.map(task => ({
      ...task,
      isOverdue: !['completed', 'cancelled'].includes(task.status) && new Date() > new Date(task.dueDate),
      timeRemaining: (() => {
        if (['completed', 'cancelled'].includes(task.status)) return 0;
        const now = new Date();
        if (task.dueDate) {
          const timeDiff = new Date(task.dueDate).getTime() - now.getTime();
          return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        }
        return 0;
      })()
    }));

    res.json({
      message: 'My tasks retrieved successfully',
      data: {
        tasks: tasksWithComputed,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTasks: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/tasks/stats
// @desc    Get task statistics
// @access  Private
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    let matchQuery = {};
    
    if (req.user.role === 'member') {
      matchQuery.assignedTo = req.user._id;
    } else if (req.user.role === 'team_leader') {
      const userProjects = await Project.find({
        $or: [
          { projectManager: req.user._id },
          { 'assignedMembers.user': req.user._id }
        ]
      }).select('_id');
      
      const projectIds = userProjects.map(project => project._id);
      matchQuery.project = { $in: projectIds };
    }

    const stats = await Task.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          todoTasks: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
          inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          reviewTasks: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $nin: ['$status', ['completed', 'cancelled']] },
                    { $lt: ['$dueDate', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalEstimatedHours: { $sum: '$estimatedHours' },
          totalActualHours: { $sum: '$actualHours' }
        }
      }
    ]);

    const statusDistribution = await Task.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityDistribution = await Task.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const upcomingTasks = await Task.find({
      ...matchQuery,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { 
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
      }
    })
      .populate('project', 'name')
      .populate('assignedTo', 'name')
      .sort({ dueDate: 1 })
      .limit(10)
      .select('title status priority dueDate project assignedTo')
      .lean();

    res.json({
      message: 'Task statistics retrieved successfully',
      data: {
        overview: stats[0] || {
          totalTasks: 0,
          todoTasks: 0,
          inProgressTasks: 0,
          reviewTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          totalEstimatedHours: 0,
          totalActualHours: 0
        },
        statusDistribution,
        priorityDistribution,
        upcomingTasks
      }
    });

  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get task by ID
// @access  Private (Project access required)
router.get('/:id', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const taskId = req.params.id;
    
    const task = await Task.findById(taskId)
      .populate('project', 'name team')
      .populate('assignedTo', 'name email profile')
      .populate('assignedBy', 'name email profile')
      .populate('comments.user', 'name email')
      .populate('progressUpdates.user', 'name email')
      .populate('dependencies.task', 'title status');

    if (!task) {
      return res.status(404).json({
        error: {
          message: 'Task not found',
          status: 404
        }
      });
    }

    // Check access to the project
    const project = await Project.findById(task.project._id).populate('team');
    
    // Check if user can access this task
    const canAccess = req.user.role === 'admin' ||
                     task.assignedTo._id.toString() === req.user._id.toString() ||
                     task.assignedBy._id.toString() === req.user._id.toString() ||
                     project.isProjectManager(req.user._id) ||
                     project.team.isTeamLeader(req.user._id) ||
                     project.isAssignedMember(req.user._id);

    if (!canAccess) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this task',
          status: 403
        }
      });
    }

    const taskWithComputed = {
      ...task.toObject(),
      duration: task.duration,
      timeRemaining: task.timeRemaining,
      isOverdue: task.isOverdue,
      progressPercentage: task.progressPercentage
    };

    res.json({
      message: 'Task retrieved successfully',
      data: {
        task: taskWithComputed
      }
    });

  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   POST /api/tasks
// @desc    Create new task (Project Manager or Team Leader)
// @access  Private (Project management access required)
router.post('/', authenticateToken, validate(taskValidationSchemas.create), async (req, res) => {
  try {
    const { title, description, project, assignedTo, priority, type, estimatedHours, startDate, dueDate, tags, dependencies } = req.body;

    // Verify project exists and user has management access
    const projectDoc = await Project.findById(project).populate('team');
    if (!projectDoc) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Check if user can create tasks in this project
    const canManage = req.user.role === 'admin' ||
                     projectDoc.isProjectManager(req.user._id) ||
                     projectDoc.team.isTeamLeader(req.user._id);

    if (!canManage) {
      return res.status(403).json({
        error: {
          message: 'Project management access required to create tasks',
          status: 403
        }
      });
    }

    // Verify assigned user exists and is part of the project
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser || !assignedUser.isActive) {
      return res.status(404).json({
        error: {
          message: 'Assigned user not found or inactive',
          status: 404
        }
      });
    }

    if (!projectDoc.isAssignedMember(assignedTo) && !projectDoc.isProjectManager(assignedTo)) {
      return res.status(400).json({
        error: {
          message: 'User must be assigned to the project to receive tasks',
          status: 400
        }
      });
    }

    // Verify dependencies exist and belong to the same project
    if (dependencies && dependencies.length > 0) {
      const dependencyTasks = await Task.find({
        _id: { $in: dependencies.map(dep => dep.task) },
        project: project
      });

      if (dependencyTasks.length !== dependencies.length) {
        return res.status(400).json({
          error: {
            message: 'Some dependency tasks not found or not in the same project',
            status: 400
          }
        });
      }
    }

    // Create task
    const task = new Task({
      title: title.trim(),
      description,
      project,
      assignedTo,
      assignedBy: req.user._id,
      priority: priority || 'medium',
      type: type || 'feature',
      estimatedHours: estimatedHours || 0,
      startDate: new Date(startDate),
      dueDate: new Date(dueDate),
      tags: tags || [],
      dependencies: dependencies || []
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('project', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .populate('dependencies.task', 'title status');

    res.status(201).json({
      message: 'Task created successfully',
      data: {
        task: populatedTask
      }
    });

  } catch (error) {
    console.error('Create task error:', error);
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

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private (Task owner or manager)
router.put('/:id', authenticateToken, validateObjectId('id'), validate(taskValidationSchemas.update), async (req, res) => {
  try {
    const taskId = req.params.id;
    const updateData = req.body;

    const task = await Task.findById(taskId).populate({
      path: 'project',
      populate: { path: 'team' }
    });

    if (!task) {
      return res.status(404).json({
        error: {
          message: 'Task not found',
          status: 404
        }
      });
    }

    // Check if user can modify this task
    const canModify = task.canModify(req.user._id, req.user.role) ||
                     task.project.isProjectManager(req.user._id) ||
                     task.project.team.isTeamLeader(req.user._id);

    if (!canModify) {
      return res.status(403).json({
        error: {
          message: 'Access denied to modify this task',
          status: 403
        }
      });
    }

    // Verify new assigned user if provided
    if (updateData.assignedTo && updateData.assignedTo !== task.assignedTo.toString()) {
      const newAssignedUser = await User.findById(updateData.assignedTo);
      if (!newAssignedUser || !newAssignedUser.isActive) {
        return res.status(404).json({
          error: {
            message: 'New assigned user not found or inactive',
            status: 404
          }
        });
      }

      if (!task.project.isAssignedMember(updateData.assignedTo) && !task.project.isProjectManager(updateData.assignedTo)) {
        return res.status(400).json({
          error: {
            message: 'New assigned user must be part of the project',
            status: 400
          }
        });
      }
    }

    // Set completion date if status changes to completed
    if (updateData.status === 'completed' && task.status !== 'completed') {
      updateData.completedDate = new Date();
    }

    // Update task
    Object.assign(task, updateData);
    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate('project', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .populate('dependencies.task', 'title status');

    res.json({
      message: 'Task updated successfully',
      data: {
        task: updatedTask
      }
    });

  } catch (error) {
    console.error('Update task error:', error);
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

// @route   PUT /api/tasks/:id/progress
// @desc    Update task progress
// @access  Private (Assigned user or manager)
router.put('/:id/progress', authenticateToken, validateObjectId('id'), validate(taskValidationSchemas.updateProgress), async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status, comment, hoursWorked } = req.body;

    const task = await Task.findById(taskId).populate({
      path: 'project',
      populate: { path: 'team' }
    });

    if (!task) {
      return res.status(404).json({
        error: {
          message: 'Task not found',
          status: 404
        }
      });
    }

    // Check if user can update progress
    const canUpdate = task.assignedTo.toString() === req.user._id.toString() ||
                     task.canModify(req.user._id, req.user.role) ||
                     task.project.isProjectManager(req.user._id) ||
                     task.project.team.isTeamLeader(req.user._id);

    if (!canUpdate) {
      return res.status(403).json({
        error: {
          message: 'Access denied to update task progress',
          status: 403
        }
      });
    }

    // Update progress
    task.updateProgress(req.user._id, status, comment, hoursWorked || 0);
    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate('project', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .populate('progressUpdates.user', 'name email');

    res.json({
      message: 'Task progress updated successfully',
      data: {
        task: updatedTask
      }
    });

  } catch (error) {
    console.error('Update task progress error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   POST /api/tasks/:id/comments
// @desc    Add comment to task
// @access  Private (Project access required)
router.post('/:id/comments', authenticateToken, validateObjectId('id'), validate(taskValidationSchemas.addComment), async (req, res) => {
  try {
    const taskId = req.params.id;
    const { comment } = req.body;

    const task = await Task.findById(taskId).populate({
      path: 'project',
      populate: { path: 'team' }
    });

    if (!task) {
      return res.status(404).json({
        error: {
          message: 'Task not found',
          status: 404
        }
      });
    }

    // Check if user can access this task
    const canAccess = req.user.role === 'admin' ||
                     task.assignedTo.toString() === req.user._id.toString() ||
                     task.assignedBy.toString() === req.user._id.toString() ||
                     task.project.isProjectManager(req.user._id) ||
                     task.project.team.isTeamLeader(req.user._id) ||
                     task.project.isAssignedMember(req.user._id);

    if (!canAccess) {
      return res.status(403).json({
        error: {
          message: 'Access denied to comment on this task',
          status: 403
        }
      });
    }

    // Add comment
    task.addComment(req.user._id, comment);
    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate('comments.user', 'name email')
      .select('comments');

    res.status(201).json({
      message: 'Comment added successfully',
      data: {
        comments: updatedTask.comments
      }
    });

  } catch (error) {
    console.error('Add task comment error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private (Task creator or manager)
router.delete('/:id', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const taskId = req.params.id;

    const task = await Task.findById(taskId).populate({
      path: 'project',
      populate: { path: 'team' }
    });

    if (!task) {
      return res.status(404).json({
        error: {
          message: 'Task not found',
          status: 404
        }
      });
    }

    // Check if user can delete this task
    const canDelete = req.user.role === 'admin' ||
                     task.assignedBy.toString() === req.user._id.toString() ||
                     task.project.isProjectManager(req.user._id) ||
                     task.project.team.isTeamLeader(req.user._id);

    if (!canDelete) {
      return res.status(403).json({
        error: {
          message: 'Access denied to delete this task',
          status: 403
        }
      });
    }

    // Check for dependencies
    const dependentTasks = await Task.find({
      'dependencies.task': taskId,
      status: { $nin: ['completed', 'cancelled'] }
    });

    if (dependentTasks.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot delete task with active dependencies',
          status: 400,
          details: {
            dependentTasks: dependentTasks.map(t => ({ id: t._id, title: t.title }))
          }
        }
      });
    }

    await Task.findByIdAndDelete(taskId);

    res.json({
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

module.exports = router;