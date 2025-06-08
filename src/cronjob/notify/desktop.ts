import notifier from 'node-notifier'
import path from 'path'
import fs from 'fs'

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

    notifier.notify(
      {
        ...data,
        // 显式指定二进制路径
        notifuPath: path.join(vendorPath, 'notifu.exe'),
        snoreToastPath: path.join(vendorPath, 'snoretoast.exe')
      },
      (err: any, response: any) => {
        if (err) console.error('桌面通知失败:', err)
        else console.log('桌面通知发送成功')
      }
    )
  } else {
    // 开发环境正常使用
    notifier.notify(data, (err: any, response: any) => {
      if (err) console.error('桌面通知失败:', err)
      else console.log('桌面通知发送成功')
    })
  }
}
