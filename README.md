# 工单关闭追踪看板

打开 index.html，导入原始工单 Excel，即可生成看板。点击大区、选择子区域、搜索工单，点击工单编号查看详情；“导出筛选结果”导出当前查询范围。

支持七大区：DAP、SEA、EUB、EMG、RCIS、ISC、LATAM。Korea 自动匹配 KOR，RCIS 子区域自动匹配 CIS。

统计以 Work Order Status 判断是否关闭；流程状态 Completed 不当成工单关闭。服务完成后未超过 72 小时（含恰好 72 小时）的工单暂不计入。未填完成时间单独统计并包含在待关闭中；未来或无效时间、空工单状态单列为待核实。默认时间按北京时间解释，可以在网页里切换。重复工单号按行保留并提示。

## GitHub Pages

把本目录中的所有文件和 xlsx.full.min.js 和 SHEETJS-LICENSE 文件上传到 GitHub 仓库根目录。进入 Settings → Pages，选择 Deploy from a branch，分支 main，目录 / (root)，保存后等待发布。

网页无需构建、无需服务器后端。请保留 xlsx.full.min.js 和 SHEETJS-LICENSE 文件，否则无法解析 Excel。不要把业务 Excel 上传到 GitHub；每次访问网页后在本地导入即可。

Excel 数据不上传、不持久保存；刷新网页后需重新导入。页面每分钟自动更新统计时点，也可点击刷新统计。

Excel 解析依赖 SheetJS CE 0.20.3，Apache 2.0 授权见 SHEETJS-LICENSE。官方说明：https://docs.sheetjs.com/docs/getting-started/installation/standalone/
