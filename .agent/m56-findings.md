# M56 数据体检段 · 发现清单（工单，消费即归档）

> **拍板结果（2026-07-20 用户）**：全按 fable 建议——①本体粒度三档口径成立（本体或 <30km 同名近场=通达；同市异名门户 ≤1h 且 ≥4班/日=rail 通达 air 按本体；远端门户=双标）；四判例：wutaishan 按品牌门户**不标 noair**、chaozhou/shantou **不标 noair**、chongwu **不标**（随 M48 改「可接」处理）、近郊门户未列项**不追认**；②停航/在建/刚复航不硬置 noair，高时效复卡清单 18 项挂 state 定期回查；③92 组字段（含 3 例翻案剔除与上述判例调整）+29 条 transit 修复+12 城习惯区改法**全部批准落库**。→ 实施批可开工；机制段（transport/budget/schema 守卫）另按 design M56 排期。

> 2026-07-20 [cc] fable 编排产出，交用户过目——**noair/norail 清单过目后才落库，本工单零数据改动**。267 城 15 片并行网查（西部习惯区 6 片 opus·high、东中部 9 片 sonnet·medium），全部 noair/norail 候选走反方复核（西部批 opus 换视角 35 条、东部批 opus 跨档 41 条、E1/E2 补核 16 组），非候选存疑事实另派补查 15 项全定案（1 项旺季细节存疑）。fable 抽查：37/37 文案摘录与 data 原文核对为真。

## 复核战绩（先看这个）

- **三条 noair 翻案剔除**（同一失败模式：被忽略的既有低频支线机场）：
  - **anyang**：安阳红旗渠机场 2023-11-29 通航，6 城定期客运——不标 noair
  - **wutaishan**：忻州五台山机场 2015 年通航、以五台山命名、距台怀镇 50km、直飞上海——归拍板项（品牌门户 50km 算不算）
  - **pulan**：阿里普兰机场 2023-12-27 通航、西藏航空拉萨—普兰定期航线（2024 吞吐仅 80 人次极低频）——noair 剔除、norail 保留
- 其余全部维持或口径挂起；「在建转通航」零翻车。教训已入 checklist：**凡「偏远=无机场」直觉判定必须逐城搜「<县名>机场」**。

## 一、noair/norail 标记清单（复核后，建议按档落库）

### A 档·双标 noair:true + norail:true（31 城，复核维持）
tekes-kalajun（特克斯无机场无站；昭苏机场 50km/伊宁站为门户）、guide-yellow-river（贵德无机场不通火车）、chaka-salt-lake（无机场；茶卡站运盐支线仅季节 Y961/2 专列）、ruoergai（红原机场在红原县 48km；川青北段在建 2028）、siguniangshan-danba（成都陆路）、zanda（昆莎 330km 他县；阿里无铁路）、dongchuan-hongtudi（东川支线客运停运）、nuodeng、ruili（大瑞瑞丽段未通）、shaxi（丽香不经剑川）、yuanyang-terrace（机场在建多次延期⚑）、wulanbutong（赤峰玉龙 300km/经棚站 150km 均远门户）、hengshan-xuankongsi、hukou-waterfall、qikou（临县站普速日一班距碛口 50km，注「临县有限普速」）、dengfeng-songshan（郑登洛城际未通）、guoliang-wanxianshan、luanchuan-laojunshan（仅「高铁无轨站」虚拟联程）、langshan-danxia（邵永高铁 2027 前无）、jingpohu、xuexiang、chishui、wuzhishan、dongji-island、dongtou-island、gouqi-island（仅直升机短途，不计民航）、putuoshan（机场在朱家尖岛）、chongming（军用机场；22 号线在建⚑年内通车将翻转 norail）、dongshandao（通勤机场规划中；东山岛站在建）、shipu-xiangshan（甬石铁路 2027；无民航仅值机点）、yixian-qingxiling（noair 确；norail 依据句收紧为「易县站 2012 停用，紫荆关站京原线普速仅办乘降且偏远非清西陵门户」）

### B 档·单标 norail:true（12 城，有民航无铁路客运）
altay（喀纳斯机场现役）、bayanbulak（巴音布鲁克机场 2024 通航）、tashkurgan-pamir（红其拉甫机场 2022）、gannan（夏河机场现役；兰合在建 2027）、qilian-zhuoershan（祁连机场现役）、chuanxi-loop（康定机场现役；川藏雅林段 2032）、daocheng-yading（亚丁机场现役）、luguhu（泸沽湖机场**停航中**——air 记存疑态不置 noair，实际走丽江）、**pulan（翻案改单标）**、mangshi、tengchong-heshun、taohuadao-zhujiajian（朱家尖有机场；舟山无铁路）

### C 档·单标 noair:true（约 60 城，有铁路客运无民航）
西部 11：pingliang-kongtong（机场 2027 投运前）、wuwei（⚠单源存疑倾向维持：民用机场未投运、苏武系通用）、daqaidam-emerald-lake、menyuan-rapeseed、dujiangyan-qingcheng、langzhong、leshan-emeishan、zigong（凤鸣通用机场不计）、jianshui-mengzi（蒙自机场在建⚑目标 2026 通航、6 月试飞——落库须挂复核提醒）、luoping、weishan
东部/中部：hongtong-guangshengsi、pianguan-laoniuwan（noair 确；norail 半无一手源存疑倾向维持，落库先只标 noair）、pingyao、wangjia-dayuan、zhangbi-mianshan、jiaozuo-yuntaishan、kaifeng、shanzhou-dikengyuan、longhushan、wugongshan、wuyuan、changting（⚑冠豸山 2024-08 停航态成立、复航需回写）、fujian-tulou、meizhou-island、pingtan、taining-dajinhu、xiapu、hunchun、jian、xingcheng（军用不计）、panjin-honghaitan、qufu（济宁曲阜机场 2023-12 关闭；大安机场 40km 兖州区）、taierzhuang（⚑翼云 2026-04 校飞随时通航需回写）、taishan、zibo、kaiping、shunde、yangjiang-hailing、zhaoqing、huangyao、jingxi、chongzuo-detian（「大新通用机场已通航」说已证伪）、海南西线 changjiang-qizi-bay/danzhou-dongpo/dongfang-yulinzhou/ledong-jianfengling/wanning
E1 浙江县域 14：anji、hengdian-dongyang、moganshan、nanxijiang、nanxun、qiandaohu、shaoxing、shitang、songyang、tiantaishan、tonglu、wuzhen-xitang、xiandu、xinye-jiande（抽验 3 条通过：均仅通用机场/值机点）
E2 江苏 3：changshu-yushan（苏州通用机场非客运）、gaoyou（仅 A1 通用）、liyang-tianmuhu

### D 档·镇/景区级 norail（5 城，随「本体粒度」拍板定档）
qinhu-wetland（溱潼镇无站，泰州/姜堰 40min）、tiaozini（东台站 1.5h）、xinghua（兴化站仅货运，须泰州转）、zhouzhuang-jinxi（昆山南 20-40min）、jiabang-terrace（从江站班车日 2 班 3h——密度阈值边缘样本）

### 剔除/挂起
- **剔除**：anyang（红旗渠机场）
- **挂起待拍板**：wutaishan（品牌门户 50km + 京原普速五台山站）、chaozhou/shantou（潮汕机场为三市共享设计——建议不标 noair 或立「共享门户」注记）、chongwu-ancient-city（泉州域内 1h，本体粒度）
- **近郊门户未列项**（worker 判文案合规未列，是否追认随粒度拍板）：本溪关门山/水洞、鞍山千山、扎龙、雾凇岛、齐云山等

## 二、transit 文案矛盾清单（55 城卡侧，按严重度）

**硬伤（6）**：
1. wudalianchi「转飞/高铁到黑河或北安」——黑河/北安均普速站仅 K 字头（黑河高铁在建），改「普速列车/夜车或转飞」
2. liyang-tianmuhu「天目湖站下车」——天目湖站是 73 路公交站名，高铁站为溧阳站
3. chaka-salt-lake「西宁至茶卡也有动车可达」——仅季节 Y 字头旅游专列（M48 W1 同源，两单合并处置）
4. zhenyuan「高铁1.5h」——镇远站沪昆普速三等站；高铁走三穗站+专线 30min
5. yuxian-nuanquan / yixian-qingxiling「转车」——本体无客运铁路，改「转长途汽车/包车」
6. xinghua difficulty「直达」——须泰州转车，改「一次中转」（连带 huaian「直达」仅 2 对/日注记，并入 M48 difficulty 拍板）

**过时（15）**：jiuzhaigou-huanglong（「旺季直飞九黄」对上海不成立+漏 2024 川青铁路黄龙九寨站）、shigatse（漏 2025-05 上海直飞+拉日动车化）、yanmenguan/yingxian-muta（漏 2024-12 集大原/大西新站）、songyang（漏 2020 衢宁松阳站，仍写丽水中转）、linhai（临海站本身是杭台高铁站）、yixing-shanjuandong（沪苏湖 2024-12 后已 6 趟/日直达，文案+difficulty 双改）、nanxijiang（永嘉站已更名温州北站）、bayanbulak/tashkurgan-pamir（漏 2024/2022 新通航机场）、hulunbuir（直飞低估，M48 W2 同源）、wuwei（兰张高铁可明确写）、shennongjia（神农架站 2022 已通、在林区新华镇距核心景区约 100km——补查裁定：**无「神农架南站」**，M48 分片10 该说法有误）、xichang（上海直飞每日 1 班非「若有」）、tianzhushan（「天柱山站」系普速站，高铁站为潜山站，距景区 28km/45min 有专线）

**用词（8）**：langzhong/enshi/xiapu/qinhu-wetland/suifenhe（「高铁」→「动车」；绥芬河补查确认 2024-06 起已有 D 字头，改词即可）、ejina-huyanglin（「经兰州转机」泛化极小支线机场，主推自驾/包车+点名西安唯一航线）、huhehaote（「机场地铁 40min」为白塔时代信息，盛乐转场后地铁未通、公路约 40km）、dali-lijiang 等低优先项见各片留档

**可更新提示（非矛盾）**：yan-an（西延高铁 2025-12）、xingyi-wanfenglin（盘兴高铁 2025-11）、yixian 黟县（黟县东站 2024-04）、weishan（补大临动车选项）、mangshi（18 条常态直飞含上海，「季节性直飞」偏保守）、fanghong 略。**解除（复查后无需改）**：义乌（2026-01 已恢复杭长高铁）、抚远（K7065/7066 夜车实存）、岳阳三荷/郴州/永州/衡阳机场（均正常客运）、luguhu（文案本就走丽江，正面样本）

## 三、习惯区组合标签表意修正建议（12 城，W 片汇总）

按「包车/自驾主选项+确有航线并列飞机」口径逐城改法（原文见 m48/m56 会话留档，落库时按此执行）：
- tekes-kalajun：并列「飞伊宁或昭苏天马机场（50km）后包车」
- bayanbulak：「自驾/包车（独库串线）为主，并列飞巴音布鲁克机场（库尔勒线）」
- tashkurgan-pamir：「包车/飞机」组合，并列喀什—塔县每周三班（高高原受天气影响）
- altay：进出段并列「飞喀纳斯/阿勒泰机场+包车/自驾」
- gannan：主选包车/自驾，并列「经西安/成都中转直飞夏河机场」
- qilian-zhuoershan：并列「祁连机场（西宁线）」，「无直达高铁」保留
- pulan/zanda：并列「包车/飞机（阿里昆莎中转，普兰另有拉萨—普兰极低频航线）」，**保留高反提示与拉萨陆路适应叙事**
- ejina-huyanglin：主推自驾/包车，飞机稀缺并列
- aershan：并列「飞伊尔施机场（京线为主班次少）」
- chuanxi-loop：可选并列「康定机场旺季飞行段+落地包车」
- ruoergai：点名「红原机场落地接驳」具体化

## 四、拍板项（交用户）

**A. 本体粒度三档口径**（四个分片独立扳出、判法互斥，统一后 D 档与挂起项才能定）：
拟议：①本体或 <30km 同名/唯一近场站/机场（含快艇 20min）→ 通达；②同市异名门户、公共交通 ≤1h 且班次密（≥4 班/日）→ rail 视为通达（文案写明转乘）、air 仍按本体标 noair；③远端门户（跨市/>1h/班次稀）→ 双按本体标。附裁定对照样本：普陀山（门户快艇 20min）vs 朱家尖（机场在本体）；肇兴（从江站 5km）vs 加榜（3h 日 2 班）；五台山机场（品牌门户 50km）；潮汕机场（三市共享设计）。fable 倾向：五台山按品牌门户不标 noair；潮汕/汕头不标 noair；崇武随泉州域内 1h 不标、改「可接」处理（与 M48 W4 同源）。
**B. 「状态不稳定」独立态**：停航（泸沽湖/冠豸山/牡丹江）、在建校飞（翼云/蒙自/元阳）、刚复航（天水/丹东）——拟议不硬置 noair、挂「复核提醒」清单（清单见五）。
**C. 落库形式**：noair/norail 为挡编造档的字段（transport 引擎守卫），不改变 transit 文案门户衔接写法——两层各管各；A/B 拍定后 cc 出落库批（含五、复核提醒清单挂 state）。

## 五、高时效复卡清单（落库时一并挂 state 定期复查）
上海轨交 22 号线（2026 年内通车→崇明 norail 翻转）、枣庄翼云（已校飞）、红河蒙自（2026 目标）、元阳（延期中）、丽水机场（2025-04 试飞→丽水片区松阳/缙云文案）、冠豸山复航、牡丹江海浪复航（或至 2028）、雄忻高铁五台山站（2027-03）、甬石铁路（2027）、郑登洛城际、延榆高铁（2028）、兰合铁路（2027）、黑河高铁、漳汕高铁东山岛站、大瑞保山以西、川青黄胜关以北（2028）、川藏雅林段（2032）、邵永高铁（2027-12）

## 六、方法与覆盖（留痕）
- 267/267 城全覆盖；West 6 片 opus·high 加厚（61 城）、East 9 片 sonnet·medium 扫盲（206 城）。首轮期间会话 WebSearch 配额（200）耗尽，后续复核/补查改道 WebFetch 维基/聚合与 tavily（后者亦 403），全部结论以一手/权威来源闭合，查不到的如实标存疑（现存疑仅：武威 noair 单源、偏关 norail 单源、额济纳旺季加密——三项均「倾向维持、不硬拍」）。
- 复核链：候选 92 组→反方复核 92 组（维持 84、翻案 3、口径挂起 5）；补查 15 项定案 14；fable 摘录抽查 37/37 命中。
- worker/复核原文：会话 scratchpad m56-results/（W1-W6、E1-E9、R1-R3 共 18 份），工单归档前可追溯。
