import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Priority } from '@interfaces/agent.interface';
import { OrchestratorService } from '@core/orchestrator/orchestrator.service';
import { TaskDispatcherService } from '@core/tasks/task-dispatcher.service';

interface CreateTaskDto {
  title: string;
  description: string;
  priority: Priority;
  assignedTo?: string;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
}

@Controller('api/tasks')
export class TasksController {
  constructor(
    private orchestratorService: OrchestratorService,
    private taskDispatcher: TaskDispatcherService,
  ) {}

  @Post()
  async createTask(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      title: createTaskDto.title,
      description: createTaskDto.description,
      priority: createTaskDto.priority,
      assignedTo: createTaskDto.assignedTo as any || 'tech_lead',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      dependencies: createTaskDto.dependencies,
      artifacts: [],
    };

    try {
      if (!createTaskDto.assignedTo) {
        const assignedAgent = await this.orchestratorService.assignTask(task);
        task.assignedTo = assignedAgent;
      } else {
        await this.taskDispatcher.dispatchTask(task);
      }

      return task;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bulk')
  async createBulkTasks(@Body() tasks: CreateTaskDto[]): Promise<any> {
    const createdTasks: Task[] = [];
    const errors: any[] = [];

    for (const taskDto of tasks) {
      try {
        const task = await this.createTask(taskDto);
        createdTasks.push(task);
      } catch (error: any) {
        errors.push({
          task: taskDto,
          error: error.message,
        });
      }
    }

    return {
      created: createdTasks.length,
      failed: errors.length,
      tasks: createdTasks,
      errors,
    };
  }

  @Get()
  async listTasks(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('priority') priority?: Priority,
  ): Promise<TaskListResponse> {
    let tasks = this.orchestratorService.taskQueue;

    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    if (assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === assignedTo);
    }
    if (priority) {
      tasks = tasks.filter(t => t.priority === priority);
    }

    const startIndex = (page - 1) * limit;
    const paginatedTasks = tasks.slice(startIndex, startIndex + limit);

    return {
      tasks: paginatedTasks,
      total: tasks.length,
      page,
      limit,
    };
  }

  @Get(':taskId')
  async getTask(
    @Param('taskId') taskId: string,
    @Query('agent') agent?: string,
  ): Promise<any> {
    try {
      if (agent) {
        const status = await this.taskDispatcher.getTaskStatus(taskId, agent as any);
        return status;
      }

      const task = this.orchestratorService.taskQueue.find(t => t.id === taskId);
      if (!task) {
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
      }

      return task;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':taskId')
  async updateTask(
    @Param('taskId') taskId: string,
    @Body() updates: Partial<Task>,
  ): Promise<Task> {
    const taskIndex = this.orchestratorService.taskQueue.findIndex(
      t => t.id === taskId,
    );

    if (taskIndex === -1) {
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    }

    const updatedTask = {
      ...this.orchestratorService.taskQueue[taskIndex],
      ...updates,
      updatedAt: new Date(),
    };

    this.orchestratorService.taskQueue[taskIndex] = updatedTask;

    return updatedTask;
  }

  @Delete(':taskId')
  async cancelTask(
    @Param('taskId') taskId: string,
    @Query('agent') agent: string,
  ): Promise<any> {
    try {
      await this.taskDispatcher.cancelTask(taskId, agent as any);
      
      return {
        success: true,
        message: 'Task cancelled successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to cancel task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':taskId/retry')
  async retryTask(@Param('taskId') taskId: string): Promise<any> {
    const task = this.orchestratorService.taskQueue.find(t => t.id === taskId);
    
    if (!task) {
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    }

    task.status = 'pending';
    task.updatedAt = new Date();
    
    await this.taskDispatcher.dispatchTask(task);
    
    return {
      success: true,
      message: 'Task requeued for processing',
      task,
    };
  }

  @Get('metrics/overview')
  async getTaskMetrics(): Promise<any> {
    const metrics = await this.taskDispatcher.getQueueMetrics();
    
    return {
      overview: {
        totalTasks: this.orchestratorService.taskQueue.length,
        byStatus: this.groupTasksByStatus(),
        byPriority: this.groupTasksByPriority(),
        byAgent: this.groupTasksByAgent(),
      },
      queues: metrics,
    };
  }

  private groupTasksByStatus(): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const task of this.orchestratorService.taskQueue) {
      grouped[task.status] = (grouped[task.status] || 0) + 1;
    }
    
    return grouped;
  }

  private groupTasksByPriority(): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const task of this.orchestratorService.taskQueue) {
      grouped[task.priority] = (grouped[task.priority] || 0) + 1;
    }
    
    return grouped;
  }

  private groupTasksByAgent(): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const task of this.orchestratorService.taskQueue) {
      grouped[task.assignedTo] = (grouped[task.assignedTo] || 0) + 1;
    }
    
    return grouped;
  }
}