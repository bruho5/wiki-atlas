# 无限百科 · Wiki Atlas

[English](README.md)

**把维基百科逛成一张地图。** 维基词条的链接变成可以拖动、缩放的探索路线。本站不是维基百科镜像，与 Wikimedia 无隶属关系。

## 试用

**[打开公开演示](https://wiki-atlas-demo.punky-pp.chatgpt.site/#en/Hades)** · 无需登录。

默认从神话人物 Hades 出发。任何部署的首页地址加上 `#en/Hades` 即可直达。试试 **Hades → Zagreus → 返回**，原来的地图视角会恢复。

- **维基 / Wiki** 选择要搜索的中文或英文维基；**界面 / UI** 独立切换界面语言。
- 拖动平移、滚轮或按钮缩放。点圆形词条看摘要，走到边缘时可展开新的分支。
- 每批最多展示当前词条实际链接的六个邻居，上一批和下一批使用同一圈位置。
- 悬停或聚焦节点可直接加入阅读清单，不用打开词条；触屏可点节点边的小加号。打开清单可以跳回收藏的词条。
- 返回和前进恢复上次的词条、地图位置、缩放和批次，不撤销收藏。

## 本地运行

不用打包、登录或提供 API Key。装有 Python 3 时，在仓库目录运行：

```sh
python -m http.server 8000
```

浏览器打开 [localhost:8000](http://localhost:8000)。不建议直接双击 `index.html`，因为浏览器可能限制本地文件加载脚本模块。

可部署到静态托管。使用 GitHub Pages 时选择默认分支的根目录，`.nojekyll` 已就绪，无需额外构建。

## 实现和限制

原生 HTML、CSS、JavaScript 模块，SVG 绘制连线，HTML 按钮绘制词条节点。[MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page) 提供搜索、摘要、链接和图片资料，优先选取正文里的直接链接，不用 AI 推测关联。搜索会直接向 Wikimedia 发请求；不设应用后端。清单和界面偏好只存在本机浏览器，刷新页面会重置浏览历史。无法联网时有明确标记的 Hades 示例；没有合适的自由许可缩略图时用文字徽标。

## 来源与致谢

词条节选来自维基百科，作者见原词条历史，可按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 使用。节选可能截短。缩略图仅请求自由许可图像，按文件资料提供作者、许可和来源页；圆形是显示时的裁切。维基资料不随仓库发布，也不通过本项目重新授权。参见 [Wikimedia 使用条款](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)与 [Commons 再利用指南](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)。

拖动地图探索的体验受 [Floor796](https://floor796.com/) 启发。本项目不使用 Floor796 的代码、图像或素材。
