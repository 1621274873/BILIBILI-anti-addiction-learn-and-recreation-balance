# 发布前最终 checklist

## A. 权限与网络（manifest 层面）

- [x] 权限仅 storage，站点仅 https://www.bilibili.com/*，内容脚本范围一致；已通过，保持现状。（manifest.json / permissions、host_permissions、content_scripts[0].matches）
- [x] 页面加载时自动运行需要持续站点访问；activeTab 点击后临时授权不能覆盖当前行为。（README.md / 权限、数据与平台边界）
- [x] 无平台接口、外部资源、网络拦截或 storage.sync；静态扫描通过，扩展页面 CSP 设置 connect-src 'none'。（src/ / 网络调用；manifest.json / content_security_policy）
- [x] 后台仅接受主站顶层页面的计时，拒绝非活动标签页。（src/background/service-worker.js / isBilibiliSender、isActiveSender）

## B. DOM 操作边界（代码层面）

- [x] 平台节点只读；创建、文本和样式写入仅针对扩展自建 Shadow DOM，不注入 HTML 字符串。（src/content/content.js / 元数据读取；src/content/floating-panel.js / createFloatingPanel）
- [x] 没有广告、推广、青少年模式或信息流隐藏规则；已通过，保持现状。（src/content/ / 选择器和页面操作）
- [x] 拖动、方向键移动、折叠及全屏隐藏的行为测试通过。（src/content/floating-panel.js / move、collapse、fullscreenchange）
- [x] 前台计时、后台暂停、倍速、进度跳转、分类切换与跨日分配的行为测试通过。（src/content/playback-clock.js / sample；src/content/content.js / 播放事件；src/background/service-worker.js / handleVideoTick）
- [x] 连续娱乐在 1500 秒触发一次，独立于每日限额；跨视频/标签页/服务重启保持，学习、暂停计时、清理记录或 60 秒无上报后清零，行为测试通过。（src/shared/recreation-session.js / 计时快照；src/background/service-worker.js / handleVideoTick；src/content/floating-panel.js / render）
- [ ] 在 Chrome 重载扩展并刷新 B站页面，实测真实视频计时和悬浮窗；本轮 Chrome 自动连接不可用，尚未实机确认。（Chrome / chrome://extensions 扩展卡片与 B站视频页）

## C. 用户数据与隐私政策（商店层面）

- [x] 仅保存日期、两类时长、限额、开关、提醒状态和一份连续娱乐快照（秒数及最近播放上报时间），不保存标题、标签、视频标识或分类覆盖。（src/shared/storage.js / normalizeState；PRIVACY.md / 本地数据）
- [x] 按自然日期保留最近 30 天，启动时清理并写回旧 schema；测试通过。（src/shared/storage.js / pruneState；src/background/service-worker.js / 启动、安装事件）
- [x] 提供暂停和二次确认清理，隐私说明披露行为数据属性、范围、用途、保留及删除方式。（src/content/floating-panel.js、src/popup/popup.js / 暂停、清理；PRIVACY.md）
- [ ] 自用可跳过；公开发布前提交隐私政策 URL 与真实的数据用途表单，目前未提交商店审核。（Chrome Web Store Developer Dashboard / Privacy practices；PRIVACY.md）

## D. 残余风险声明

- [x] 自用仍可能受 B站协议与风控约束；当前无主动平台请求、自动账号操作或公开商店发布，但不能保证不封号。（README.md / 权限、数据与平台边界；docs/legal-risk-self-check.md）
