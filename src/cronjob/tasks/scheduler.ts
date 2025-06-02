import * as cron from 'node-cron';
import { TaskConfig } from '../config';
import { createAndConnectClient } from '../core/client';
import { executeOperation } from '../core/operations';
import { sendNotification } from '../notify';

export function scheduleTask(task: TaskConfig) {
  cron.schedule(task.schedule, async () => {
    console.log(`执行任务: ${task.transport.command} ${task.transport.args.join(' ')}`);
    
    try {
      // 创建并连接客户端
      const { client, transport } = await createAndConnectClient(task.transport);
      
      // 执行操作并收集结果
      const results = [];
      for (const operation of task.operations) {
        try {
          const result = await executeOperation(client, operation);
          results.push({ operation, result });
        } catch (opErr) {
          results.push({ operation, error: opErr.message });
        }
      }
      
      // 断开连接
      await transport.close();
      
      // 发送通知
      await sendNotification(task.notify, results);
    } catch (err) {
      console.error('任务执行失败:', err);
      // 发送错误通知
      await sendNotification(task.notify, { error: err.message });
    }
  });
} 