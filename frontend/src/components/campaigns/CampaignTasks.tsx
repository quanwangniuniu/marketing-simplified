'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { CampaignTaskLink } from '@/types/campaign';
import { TaskData } from '@/types/task';
import { TaskAPI } from '@/lib/api/taskApi';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ListTodo } from 'lucide-react';

interface CampaignTasksProps {
  campaignId: string;
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800';
    case 'UNDER_REVIEW':
      return 'bg-yellow-100 text-yellow-800';
    case 'SUBMITTED':
      return 'bg-[#3CCED7]/10 text-[#0E8A96]';
    case 'REJECTED':
      return 'bg-red-100 text-red-800';
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

export default function CampaignTasks({ campaignId }: CampaignTasksProps) {
  const router = useRouter();
  const [taskLinks, setTaskLinks] = useState<CampaignTaskLink[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch task links
        const linksResponse = await CampaignAPI.getTaskLinks(campaignId);
        const linksData = linksResponse.data.results || linksResponse.data || [];
        setTaskLinks(linksData);

        // Fetch task details for each linked task
        const taskPromises = linksData.map(async (link: CampaignTaskLink) => {
          try {
            const taskResponse = await TaskAPI.getTask(link.task);
            return taskResponse.data;
          } catch (err) {
            console.error(`Failed to fetch task ${link.task}:`, err);
            return null;
          }
        });

        const taskResults = await Promise.all(taskPromises);
        const validTasks = taskResults.filter((task): task is TaskData => task !== null);
        setTasks(validTasks);
      } catch (err: any) {
        console.error('Failed to fetch campaign tasks:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      fetchTasks();
    }
  }, [campaignId]);

  const handleTaskClick = (task: TaskData) => {
    if (task.id) {
      router.push(`/tasks/${task.id}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          Related Tasks
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CCED7]"></div>
          <span className="ml-3 text-gray-600">Loading tasks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          Related Tasks
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ListTodo className="h-5 w-5" />
        Related Tasks
      </h2>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No tasks linked to this campaign yet.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleTaskClick(task)}
                >
                  <TableCell className="font-medium">
                    {task.summary || `Task #${task.id}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {task.type || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {task.status || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.owner?.username || task.owner?.email || 'Unassigned'}
                  </TableCell>
                  <TableCell>{formatDate(task.due_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

