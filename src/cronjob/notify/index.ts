import { sendDesktopNotification } from './desktop'
import { sendEmailNotification } from './email'

// 发送通知的函数
// notifyConfigs:
// [{type:string,title:string,icon:string}]
// data:
// [{operation:{name:string},result:{content:[{type:string,text:string}]}}]
export async function sendNotify (notifyConfigs, data) {
  // console.log(JSON.stringify(data, null, 2))
  try {
    for (const notifyConfig of notifyConfigs) {
      if (notifyConfig?.type === 'desktop') {
        let text = ''

        if (Array.isArray(data)) {
          for (const d of data) {
            if (d.operation.name) text += `${d.operation.name}\n`
            if (d.result?.content?.[0]?.text) {
              text += `${d.result?.content?.[0]?.text}\n`
            } else if (d.result) {
              text += `${JSON.stringify(d.result, null, 2)}\n`
            }
            text += '\n------\n'
          }
        }

        sendDesktopNotification(notifyConfig.title, text, notifyConfig.icon)
      } else if (notifyConfig?.type === 'email') {
        await sendEmailNotification(
          notifyConfig.to,
          notifyConfig.subject,
          JSON.stringify(data, null, 2)
        )
      } else {
        await fetch(notifyConfig.url || notifyConfig, {
          method: 'POST',
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  } catch (error) {
    console.error(error)
  }
}
