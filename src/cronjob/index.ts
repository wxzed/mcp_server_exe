import { scheduleTask } from './tasks/scheduler'
import { loadConfig } from './config'

export const cronjob = (configPathOrStr: string,client:any) => {
  const config = loadConfig(configPathOrStr)
  // 遍历任务并设置定时器
  config.tasks.forEach(task => scheduleTask(task,client))
  // 提示程序已启动
  // console.log('定时任务已设置')
}
