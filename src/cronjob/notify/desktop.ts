import notifier from 'node-notifier'
import path from 'path'
import fs from 'fs'
import os from 'os'

export function sendDesktopNotification (title, message, icon) {
  let data: any = {
    title,
    message,
    sound: true,
    wait: false
  }

  if (icon) {
    data.icon = icon
  }

  // 修正二进制路径（打包后）
  // @ts-ignore
  if (process.pkg) {
    let vendorPath = path.join(path.dirname(process.execPath), 'notifier')

    if (!fs.existsSync(vendorPath)) {
      vendorPath = path.join(path.dirname(process.cwd()), 'notifier')
    }

    if (!fs.existsSync(vendorPath)) {
      vendorPath = path.dirname(process.execPath)
    }

    const platform = os.platform()
    let customPath

    if (platform === 'win32') {
      customPath = path.join(vendorPath, 'snoretoast.exe')
    } else if (platform === 'darwin') {
      customPath = path.join(vendorPath, 'terminal-notifier')
    }

    notifier.notify(
      {
        ...data,
        customPath
      },
      (err: any, response: any) => {
        if (err) console.error('桌面通知失败:', err)
        else console.log('桌面通知发送成功',response)
      }
    )
  } else {
    // 开发环境正常使用
    notifier.notify(data, (err: any, response: any) => {
      if (err) console.error('桌面通知失败:', err)
      else console.log('桌面通知发送成功',response)
    })
  }
}
