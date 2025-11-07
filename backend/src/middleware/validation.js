const Joi = require('joi');

// Helper function to handle validation errors
const handleValidationError = (error, res) => {
  const errorMessages = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message
  }));

  return res.status(400).json({
    error: {
      message: 'Validation failed',
      status: 400,
      details: errorMessages
    }
  });
};

// User validation schemas
const userValidationSchemas = {
  register: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(6).max(128).required(),
    role: Joi.string().valid('admin', 'team_leader', 'member').default('member')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateUser: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    email: Joi.string().email().lowercase(),
    role: Joi.string().valid('admin', 'team_leader', 'member'),
    isActive: Joi.boolean(),
    profile: Joi.object({
      phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).allow(''),
      department: Joi.string().max(100).allow(''),
      position: Joi.string().max(100).allow(''),
      avatar: Joi.string().uri().allow('')
    })
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(128).required()
  })
};

// Team validation schemas
const teamValidationSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().max(500).allow(''),
    teamLeader: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    members: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).default([]),
    settings: Joi.object({
      allowMemberInvite: Joi.boolean().default(false),
      publicVisibility: Joi.boolean().default(false)
    })
  }),

  update: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    description: Joi.string().max(500).allow(''),
    teamLeader: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    isActive: Joi.boolean(),
    settings: Joi.object({
      allowMemberInvite: Joi.boolean(),
      publicVisibility: Joi.boolean()
    })
  }),

  addMember: Joi.object({
    userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    role: Joi.string().valid('team_leader', 'member').default('member')
  })
};

// Project validation schemas
const projectValidationSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().min(10).max(1000).required(),
    team: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    projectManager: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    assignedMembers: Joi.array().items(
      Joi.object({
        user: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        role: Joi.string().valid('project_manager', 'developer', 'tester', 'designer', 'other').default('developer')
      })
    ).default([]),
    status: Joi.string().valid('planning', 'active', 'on_hold', 'completed', 'cancelled').default('planning'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    startDate: Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref('startDate')).required(),
    budget: Joi.object({
      allocated: Joi.number().min(0).default(0)
    }),
    tags: Joi.array().items(Joi.string().max(50))
  }),

  update: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    description: Joi.string().min(10).max(1000),
    projectManager: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    status: Joi.string().valid('planning', 'active', 'on_hold', 'completed', 'cancelled'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
    startDate: Joi.date(),
    endDate: Joi.date(),
    actualEndDate: Joi.date(),
    budget: Joi.object({
      allocated: Joi.number().min(0),
      spent: Joi.number().min(0)
    }),
    tags: Joi.array().items(Joi.string().max(50))
  }).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate <= value.startDate) {
      return helpers.error('custom.dateOrder');
    }
    return value;
  }, 'Date validation').messages({
    'custom.dateOrder': 'End date must be after start date'
  })
};

// Task validation schemas
const taskValidationSchemas = {
  create: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    project: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    type: Joi.string().valid('feature', 'bug', 'improvement', 'research', 'testing', 'documentation', 'other').default('feature'),
    estimatedHours: Joi.number().min(0).default(0),
    startDate: Joi.date().required(),
    dueDate: Joi.date().greater(Joi.ref('startDate')).required(),
    tags: Joi.array().items(Joi.string().max(50)),
    dependencies: Joi.array().items(
      Joi.object({
        task: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        type: Joi.string().valid('blocks', 'depends_on').default('depends_on')
      })
    )
  }),

  update: Joi.object({
    title: Joi.string().trim().min(3).max(200),
    description: Joi.string().min(10).max(2000),
    assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    status: Joi.string().valid('todo', 'in_progress', 'review', 'completed', 'cancelled'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
    type: Joi.string().valid('feature', 'bug', 'improvement', 'research', 'testing', 'documentation', 'other'),
    estimatedHours: Joi.number().min(0),
    actualHours: Joi.number().min(0),
    startDate: Joi.date(),
    dueDate: Joi.date(),
    completedDate: Joi.date(),
    tags: Joi.array().items(Joi.string().max(50))
  }).custom((value, helpers) => {
    if (value.startDate && value.dueDate && value.dueDate <= value.startDate) {
      return helpers.error('custom.dateOrder');
    }
    return value;
  }, 'Date validation').messages({
    'custom.dateOrder': 'Due date must be after start date'
  }),

  updateProgress: Joi.object({
    status: Joi.string().valid('todo', 'in_progress', 'review', 'completed', 'cancelled').required(),
    comment: Joi.string().max(1000).allow(''),
    hoursWorked: Joi.number().min(0).default(0)
  }),

  addComment: Joi.object({
    comment: Joi.string().min(1).max(1000).required()
  })
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return handleValidationError(error, res);
    }

    req.body = value;
    next();
  };
};

// Parameter validation middleware
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: {
          message: `Invalid ${paramName} format`,
          status: 400
        }
      });
    }
    next();
  };
};

// Query validation for pagination and filtering
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return handleValidationError(error, res);
    }

    req.query = value;
    next();
  };
};

// Common query schema for pagination
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(100).allow('')
});

module.exports = {
  validate,
  validateObjectId,
  validateQuery,
  userValidationSchemas,
  teamValidationSchemas,
  projectValidationSchemas,
  taskValidationSchemas,
  paginationSchema
};