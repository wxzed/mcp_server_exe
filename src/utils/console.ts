const log = async (sendNotification: any, level: string, data: string) => {
  await sendNotification({
    method: 'notifications/message',
    params: {
      level,
      data,
      timestamp: new Date().getTime()
    }
  })
}

export const formatLog = async (
  level: 'INFO' | 'ERROR' | 'DEBUG',
  message: string,
  sendNotification: any = null
): Promise<string> => {
  const timestamp = new Date().toISOString()
  let logMessage = `[${timestamp}] [${level}] [McpServerComposer] ${message}`
  if (level === 'ERROR') {
    console.error(logMessage)
  } else if (level === 'DEBUG') {
    console.debug(logMessage)
  } else {
    console.log(logMessage)
  }

  if (sendNotification) {
    await log(sendNotification, level, message)
  }

  return logMessage
}
