// getElementById 简写。页面骨架为 index.html 静态标记，id 缺失即 M37 曾出过的迁移事故（confettiCanvas/toast 漏抄），
// 断言非空与旧版「裸取直用」行为一致——缺元素时同样在调用点抛错，不静默。
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
