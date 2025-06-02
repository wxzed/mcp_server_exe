import notifier from 'node-notifier'

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

  notifier.notify(data, (err, response) => {
    if (err) console.error('桌面通知失败:', err)
    else console.log('桌面通知发送成功')
  })
}
