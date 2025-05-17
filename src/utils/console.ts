export const formatLog = (level: 'INFO' | 'ERROR' | 'DEBUG', message: string): string => {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] [McpServerComposer] ${message}`;
    if(level==='ERROR'){
        console.error(logMessage);
    }else if(level==='DEBUG'){
        console.debug(logMessage);
    }else{
        console.log(logMessage);
    }
    return logMessage;
  }