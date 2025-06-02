import { sendDesktopNotification } from './desktop'
import { sendEmailNotification } from './email';

// 发送通知的函数
export async function sendNotification (notifyConfigs, data) {
  console.log(JSON.stringify(data, null, 2))

  for (const notifyConfig of notifyConfigs) {
    if (notifyConfig.type === 'desktop') {
      sendDesktopNotification(notifyConfig.title, JSON.stringify(data, null, 2))
    } else if (notifyConfig.type === 'email') {
        await sendEmailNotification(
          notifyConfig.to,
          notifyConfig.subject,
          JSON.stringify(data, null, 2)
        );
    } else {
      await fetch(notifyConfig.url || notifyConfig, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}
