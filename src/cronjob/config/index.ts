const fs = require('fs')
import { formatLog, LogLevel } from '../../utils/console'
interface TransportConfig {
  command: string
  args: string[]
}

interface Operation {
  type: string
  name?: string
  arguments?: any
  uri?: string
}

interface TaskConfig {
  schedule: string
  transport: TransportConfig
  operations: Operation[]
  notify: any
}

interface Config {
  tasks: TaskConfig[]
}

export function loadConfig (configPathOrStr: string): Config {
  const cronjob = configPathOrStr
  let cronjobJSON = null
  try {
    if (fs.existsSync(cronjob)) {
      cronjobJSON = JSON.parse(fs.readFileSync(cronjob, 'utf8'))
    } else {
      cronjobJSON = JSON.parse(cronjob)
    }
    return cronjobJSON
  } catch (error) {
    formatLog(LogLevel.ERROR, `读取或解析配置文件失败: ${error.message}`)
  }
}

export type { Config, TaskConfig, Operation, TransportConfig }
