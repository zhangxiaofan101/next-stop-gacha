/* 皮肤选择器（M45：目前只有奶油一套，机制先行——选项随 SKINS 增长自动多出来，不用改本文件） */
import { applySkinChoice, normalizeSkinChoice, RANDOM_CHOICE, SKINS } from "../skins/registry";
import { getSkinChoice } from "../store";
import { $ } from "./dom";
import { toast } from "./toast";

const OPTIONS = [...SKINS.map(s => ({ id: s.id, label: s.label })), { id: RANDOM_CHOICE, label: "🎲 随机" }];

export function openSkin() {
  renderSkin();
  $("skinOverlay").classList.add("show");
}

function renderSkin() {
  // 归一化后再算高亮：localStorage 里的脏值实际生效的是默认皮肤，高亮必须指同一个（F56）
  const current = normalizeSkinChoice(getSkinChoice());
  $("skinBody").innerHTML = `
    <h2 style="font-family:var(--round); margin:0 0 4px">🎨 选皮肤</h2>
    <p style="font-size:13px;color:var(--ink-soft);margin:0 0 10px">点一下立即切换，不用刷新；「随机」每次进站重新抽一套，弹层不关方便对比着看。</p>
    <div class="skin-opts">
      ${OPTIONS.map(o => `<button class="btn ${o.id === current ? "on" : ""}" data-skin="${o.id}">${o.label}</button>`).join("")}
    </div>`;
}

// 事件走 events.ts 的文档级委托（data-skin），同 data-fav/data-cmp 等既有习语；
// 每次切换后原地刷新高亮，弹层保持打开——这是「留着对比」的机制保证。
export function selectSkin(id: string) {
  applySkinChoice(id);
  const label = OPTIONS.find(o => o.id === id)?.label || id;
  toast(`已切换皮肤：${label}`);
  renderSkin();
}
