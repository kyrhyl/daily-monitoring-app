const express = require('express');
const Team = require('../models/Team');
const User = require('../models/User');
const { authenticateToken, requireAdmin, requireTeamLeaderOfTeamOrAdmin } = require('../middleware/auth');
const { validate, validateObjectId, validateQuery, teamValidationSchemas, paginationSchema } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/teams
// @desc    Get all teams
// @access  Private
router.get('/', authenticateToken, validateQuery(paginationSchema.keys({
  isActive: require('joi').boolean()
})), async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc', search, isActive } = req.query;
    
    // Build query based on user role
    let query = {};
    
    // Non-admin users can only see teams they are part of
    if (req.user.role !== 'admin') {
      query['members.user'] = req.user._id;
    }
    
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }
    
    if (typeof isActive !== 'undefined') {
      query.isActive = isActive;
    }

    const teams = await Team.find(query)
      .populate('teamLeader', 'name email')
      .populate('members.user', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Team.countDocuments(query);

    res.json({
      message: 'Teams retrieved successfully',
      data: {
        teams,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTeams: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   GET /api/teams/:id
// @desc    Get team by ID
// @access  Private (Admin or team member)
router.get('/:id', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const teamId = req.params.id;
    
    const team = await Team.findById(teamId)
      .populate('teamLeader', 'name email profile')
      .populate('members.user', 'name email role profile')
      .populate('createdBy', 'name email');

    if (!team) {
      return res.status(404).json({
        error: {
          message: 'Team not found',
          status: 404
        }
      });
    }

    // Check if user can access this team
    if (req.user.role !== 'admin' && !team.isMember(req.user._id)) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this team',
          status: 403
        }
      });
    }

    res.json({
      message: 'Team retrieved successfully',
      data: {
        team
      }
    });

  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   POST /api/teams
// @desc    Create new team (Admin only)
// @access  Private/Admin
router.post('/', authenticateToken, requireAdmin, validate(teamValidationSchemas.create), async (req, res) => {
  try {
    const { name, description, teamLeader, members, settings } = req.body;

    // Check if team name already exists
    const existingTeam = await Team.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    if (existingTeam) {
      return res.status(400).json({
        error: {
          message: 'Team with this name already exists',
          status: 400
        }
      });
    }

    // Verify team leader exists and has appropriate role
    const leader = await User.findById(teamLeader);
    if (!leader) {
      return res.status(404).json({
        error: {
          message: 'Team leader not found',
          status: 404
        }
      });
    }

    if (!['admin', 'team_leader'].includes(leader.role)) {
      return res.status(400).json({
        error: {
          message: 'User must be admin or team leader to lead a team',
          status: 400
        }
      });
    }

    // Verify all members exist
    if (members && members.length > 0) {
      const memberUsers = await User.find({ 
        '_id': { $in: members },
        'isActive': true 
      });
      
      if (memberUsers.length !== members.length) {
        return res.status(400).json({
          error: {
            message: 'One or more members not found or inactive',
            status: 400
          }
        });
      }
    }

    // Create team
    const team = new Team({
      name: name.trim(),
      description: description || '',
      teamLeader,
      members: members.map(memberId => ({
        user: memberId,
        role: memberId.toString() === teamLeader.toString() ? 'team_leader' : 'member'
      })),
      settings: settings || {},
      createdBy: req.user._id
    });

    await team.save();

    // Update users' teams array
    const allMemberIds = [teamLeader, ...members];
    await User.updateMany(
      { _id: { $in: allMemberIds } },
      { $addToSet: { teams: team._id } }
    );

    const populatedTeam = await Team.findById(team._id)
      .populate('teamLeader', 'name email')
      .populate('members.user', 'name email role')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Team created successfully',
      data: {
        team: populatedTeam
      }
    });

  } catch (error) {
    console.error('Create team error:', error);
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

// @route   PUT /api/teams/:id
// @desc    Update team
// @access  Private (Admin or Team Leader)
router.put('/:id', authenticateToken, requireTeamLeaderOfTeamOrAdmin, validateObjectId('id'), validate(teamValidationSchemas.update), async (req, res) => {
  try {
    const teamId = req.params.id;
    const { name, description, teamLeader, isActive, settings } = req.body;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        error: {
          message: 'Team not found',
          status: 404
        }
      });
    }

    // Check if new team name already exists
    if (name && name !== team.name) {
      const existingTeam = await Team.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: teamId }
      });
      if (existingTeam) {
        return res.status(400).json({
          error: {
            message: 'Team with this name already exists',
            status: 400
          }
        });
      }
    }

    // Verify new team leader if provided
    if (teamLeader && teamLeader !== team.teamLeader.toString()) {
      const leader = await User.findById(teamLeader);
      if (!leader) {
        return res.status(404).json({
          error: {
            message: 'New team leader not found',
            status: 404
          }
        });
      }

      if (!['admin', 'team_leader'].includes(leader.role)) {
        return res.status(400).json({
          error: {
            message: 'User must be admin or team leader to lead a team',
            status: 400
          }
        });
      }

      // Update old leader role in members array
      const oldLeaderMember = team.members.find(m => 
        m.user.toString() === team.teamLeader.toString()
      );
      if (oldLeaderMember) {
        oldLeaderMember.role = 'member';
      }

      // Update new leader role in members array or add them
      const newLeaderMember = team.members.find(m => 
        m.user.toString() === teamLeader.toString()
      );
      if (newLeaderMember) {
        newLeaderMember.role = 'team_leader';
      } else {
        team.members.push({
          user: teamLeader,
          role: 'team_leader',
          joinedAt: new Date()
        });
      }

      team.teamLeader = teamLeader;
    }

    // Update other fields
    if (name) team.name = name.trim();
    if (description !== undefined) team.description = description;
    if (typeof isActive !== 'undefined') team.isActive = isActive;
    if (settings) team.settings = { ...team.settings, ...settings };

    await team.save();

    const updatedTeam = await Team.findById(teamId)
      .populate('teamLeader', 'name email')
      .populate('members.user', 'name email role')
      .populate('createdBy', 'name email');

    res.json({
      message: 'Team updated successfully',
      data: {
        team: updatedTeam
      }
    });

  } catch (error) {
    console.error('Update team error:', error);
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

// @route   POST /api/teams/:id/members
// @desc    Add member to team
// @access  Private (Admin or Team Leader)
router.post('/:id/members', authenticateToken, requireTeamLeaderOfTeamOrAdmin, validateObjectId('id'), validate(teamValidationSchemas.addMember), async (req, res) => {
  try {
    const teamId = req.params.id;
    const { userId, role } = req.body;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        error: {
          message: 'Team not found',
          status: 404
        }
      });
    }

    // Check if user exists and is active
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return res.status(404).json({
        error: {
          message: 'User not found or inactive',
          status: 404
        }
      });
    }

    // Check if user is already a member
    if (team.isMember(userId)) {
      return res.status(400).json({
        error: {
          message: 'User is already a team member',
          status: 400
        }
      });
    }

    // Add member
    team.addMember(userId, role);
    await team.save();

    // Update user's teams array
    await User.findByIdAndUpdate(userId, {
      $addToSet: { teams: teamId }
    });

    const updatedTeam = await Team.findById(teamId)
      .populate('teamLeader', 'name email')
      .populate('members.user', 'name email role')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Member added to team successfully',
      data: {
        team: updatedTeam
      }
    });

  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   DELETE /api/teams/:id/members/:userId
// @desc    Remove member from team
// @access  Private (Admin or Team Leader)
router.delete('/:id/members/:userId', authenticateToken, requireTeamLeaderOfTeamOrAdmin, validateObjectId('id'), validateObjectId('userId'), async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.params.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        error: {
          message: 'Team not found',
          status: 404
        }
      });
    }

    // Prevent removing team leader
    if (team.teamLeader.toString() === userId) {
      return res.status(400).json({
        error: {
          message: 'Cannot remove team leader. Assign a new leader first.',
          status: 400
        }
      });
    }

    // Check if user is a member
    if (!team.isMember(userId)) {
      return res.status(404).json({
        error: {
          message: 'User is not a team member',
          status: 404
        }
      });
    }

    // Remove member
    team.removeMember(userId);
    await team.save();

    // Update user's teams array
    await User.findByIdAndUpdate(userId, {
      $pull: { teams: teamId }
    });

    const updatedTeam = await Team.findById(teamId)
      .populate('teamLeader', 'name email')
      .populate('members.user', 'name email role')
      .populate('createdBy', 'name email');

    res.json({
      message: 'Member removed from team successfully',
      data: {
        team: updatedTeam
      }
    });

  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team (Admin only)
// @access  Private/Admin
router.delete('/:id', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const teamId = req.params.id;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        error: {
          message: 'Team not found',
          status: 404
        }
      });
    }

    // Check if team has active projects
    const Project = require('../models/Project');
    const activeProjects = await Project.find({ 
      team: teamId,
      status: { $in: ['planning', 'active', 'on_hold'] }
    });

    if (activeProjects.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot delete team with active projects',
          status: 400,
          details: {
            activeProjects: activeProjects.map(p => ({ id: p._id, name: p.name, status: p.status }))
          }
        }
      });
    }

    // Remove team reference from all members
    await User.updateMany(
      { teams: teamId },
      { $pull: { teams: teamId } }
    );

    await Team.findByIdAndDelete(teamId);

    res.json({
      message: 'Team deleted successfully'
    });

  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

module.exports = router;