import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { tasksAPI, projectsAPI, usersAPI } from '../services/api';
import { 
  ClipboardListIcon, 
  UsersIcon, 
  FolderIcon,
  TrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon
} from 'lucide-react';
import { formatDate, isOverdue, isDueSoon, getRelativeTime } from '../utils/dateUtils';
import { getStatusBadge, getPriorityIndicator } from '../utils/helpers';

const Dashboard = () => {
  const { user, isAdmin, isTeamLeader } = useAuth();
  const [stats, setStats] = useState({
    tasks: {},
    projects: {},
    users: {}
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const promises = [
        tasksAPI.getStats(),
        ...(isTeamLeader() || isAdmin() ? [projectsAPI.getStats()] : []),
        ...(isAdmin() ? [usersAPI.getStats()] : []),
        tasksAPI.getMyTasks({ limit: 5, sort: 'dueDate' })
      ];

      const results = await Promise.all(promises);
      
      let taskStats = results[0].data.data;
      let projectStats = null;
      let userStats = null;
      let myTasks = null;

      let index = 1;
      if (isTeamLeader() || isAdmin()) {
        projectStats = results[index].data.data;
        index++;
      }
      
      if (isAdmin()) {
        userStats = results[index].data.data;
        index++;
      }
      
      myTasks = results[index].data.data.tasks;

      setStats({
        tasks: taskStats,
        projects: projectStats,
        users: userStats
      });
      
      setRecentTasks(myTasks);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.error?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color = 'blue', description }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 text-${color}-600`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">{value}</div>
                {description && (
                  <div className="text-sm text-gray-500">{description}</div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  const TaskItem = ({ task }) => {
    const isTaskOverdue = isOverdue(task.dueDate, task.status);
    const isTaskDueSoon = isDueSoon(task.dueDate, task.status);

    return (
      <div className="flex items-center space-x-4 p-4 border-b last:border-b-0">
        <div className={`w-1 h-12 rounded ${getPriorityIndicator(task.priority)}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {task.title}
          </p>
          <div className="flex items-center space-x-2 mt-1">
            <span className={getStatusBadge(task.status)}>
              {task.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-500">
              {task.project?.name}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm ${
            isTaskOverdue ? 'text-red-600 font-medium' :
            isTaskDueSoon ? 'text-yellow-600' : 'text-gray-500'
          }`}>
            {formatDate(task.dueDate)}
          </p>
          <p className="text-xs text-gray-400">
            {getRelativeTime(task.dueDate)}
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your projects and tasks today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* My Tasks Stats */}
          <StatCard
            title="My Active Tasks"
            value={stats.tasks.overview?.totalTasks - (stats.tasks.overview?.completedTasks || 0) || 0}
            icon={ClipboardListIcon}
            color="blue"
            description={`${stats.tasks.overview?.completedTasks || 0} completed`}
          />
          
          <StatCard
            title="Overdue Tasks"
            value={stats.tasks.overview?.overdueTasks || 0}
            icon={ClockIcon}
            color="red"
            description={stats.tasks.overview?.overdueTasks > 0 ? 'Needs attention' : 'All caught up!'}
          />

          {(isTeamLeader() || isAdmin()) && stats.projects && (
            <>
              <StatCard
                title="Active Projects"
                value={stats.projects.overview?.activeProjects || 0}
                icon={FolderIcon}
                color="green"
                description={`${stats.projects.overview?.totalProjects || 0} total`}
              />
              
              <StatCard
                title="Project Progress"
                value={`${Math.round(((stats.projects.overview?.completedProjects || 0) / (stats.projects.overview?.totalProjects || 1)) * 100)}%`}
                icon={TrendingUpIcon}
                color="purple"
                description="Completion rate"
              />
            </>
          )}

          {isAdmin() && stats.users && (
            <>
              <StatCard
                title="Total Users"
                value={stats.users.overview?.totalUsers || 0}
                icon={UsersIcon}
                color="indigo"
                description={`${stats.users.overview?.activeUsers || 0} active`}
              />
              
              <StatCard
                title="Team Leaders"
                value={stats.users.overview?.teamLeaderCount || 0}
                icon={UsersIcon}
                color="yellow"
                description="Managing teams"
              />
            </>
          )}
        </div>

        {/* Recent Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                My Recent Tasks
              </h3>
              {recentTasks.length > 0 ? (
                <div className="space-y-0">
                  {recentTasks.map((task) => (
                    <TaskItem key={task._id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClipboardListIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No tasks assigned to you yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Chart or Recent Activity */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Task Status Overview
              </h3>
              {stats.tasks.statusDistribution?.length > 0 ? (
                <div className="space-y-3">
                  {stats.tasks.statusDistribution.map((status) => (
                    <div key={status._id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={getStatusBadge(status._id)}>
                          {status._id.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {status.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No task data available.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        {stats.tasks.upcomingTasks?.length > 0 && (
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Upcoming Tasks (Next 7 days)
                </h3>
                <div className="space-y-0">
                  {stats.tasks.upcomingTasks.map((task) => (
                    <TaskItem key={task._id} task={task} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;