import notifier from 'node-notifier';

export function sendDesktopNotification(title, message) {
  notifier.notify({
    title,
    message,
    sound: true,
    wait: false
  }, (err, response) => {
    if (err) console.error('桌面通知失败:', err);
    else console.log('桌面通知发送成功');
  });
}