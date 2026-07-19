/* M52 丁A：功能图标单色线形 SVG——替换彩色 emoji 物件（📤👣⚖️🧳🖨…）。
   stroke="currentColor" 让图标自动吃所在处的文字色 token，全皮肤共享同一套结构（奶油下也比
   彩色 emoji 更精致，属结构升级不是山水专属）；语义文案里的 emoji（toast「👣 已打卡」类）
   不属视觉层，不经此处、原样保留。index.html 静态按钮（📤/🎨/dock 标签）为避免首帧闪空
   直接内联同款 SVG（见该处注释），改这里的图形时两处同步。 */

const svg = (inner: string) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  /* 双足印：足迹胶囊 / 足迹地图统计 / 详情「打卡去过」 */
  footprints: svg('<ellipse cx="8.2" cy="8.6" rx="2.9" ry="4.1" transform="rotate(-14 8.2 8.6)"/><path d="M6.6 13.9c.7 1.2 2.4 1.4 3.4.5"/><ellipse cx="15.8" cy="14.6" rx="2.9" ry="4.1" transform="rotate(14 15.8 14.6)"/><path d="M14 19.6c1 .9 2.7.7 3.4-.5"/>'),
  /* 天平：对比 */
  scale: svg('<path d="M12 4.5v15"/><path d="M8.5 20h7"/><path d="M5 7.5h14"/><path d="M6.5 7.5 4 13a2.9 2.9 0 0 0 5.4 0L6.9 7.5"/><path d="M17.5 7.5 15 13a2.9 2.9 0 0 0 5.4 0l-2.5-5.5"/>'),
  /* 行李箱：行程 */
  suitcase: svg('<rect x="4.5" y="8" width="15" height="11.5" rx="2.2"/><path d="M9.3 8V6.3A1.8 1.8 0 0 1 11.1 4.5h1.8a1.8 1.8 0 0 1 1.8 1.8V8"/><path d="M9.3 11.5v4.5M14.7 11.5v4.5"/>'),
  /* 托盘出箭头：分享/备份 */
  share: svg('<path d="M4.5 14.5v3.7A1.8 1.8 0 0 0 6.3 20h11.4a1.8 1.8 0 0 0 1.8-1.8v-3.7"/><path d="M12 4.5V15"/><path d="m8 8.3 4-3.8 4 3.8"/>'),
  /* 调色盘：换皮肤 */
  palette: svg('<path d="M12 4a8 8 0 1 0 .1 16c1.3 0 1.9-.8 1.9-1.7 0-.9-.7-1.3-.7-2.1 0-1 .8-1.7 1.8-1.7h1.6a4 4 0 0 0 4-4C20.7 6.7 16.8 4 12 4Z"/><circle cx="8.2" cy="10.2" r=".9"/><circle cx="12" cy="7.9" r=".9"/><circle cx="15.8" cy="10.2" r=".9"/>'),
  /* 打印机：路书打印 */
  printer: svg('<path d="M7.5 8.5V4.5h9v4"/><path d="M7.5 16.5h-2a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><rect x="7.5" y="13.5" width="9" height="6"/>'),
};
