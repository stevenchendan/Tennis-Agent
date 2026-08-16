"""职业巡回赛资料库（ATP / WTA / ITF）。

数据管线：GitHub 开放归档（源自官方记分系统的 Sackmann 格式）→ SQLite
→ 高阶指标引擎 → 球探报告。ATP/WTA 官网有 Cloudflare/Incapsula 防爬，
无法直接抓取；本模块使用的归档数据覆盖 1968 至今的全部巡回赛比赛
（含逐项发球统计）、挑战赛/ITF、球员资料与周级排名。
"""
