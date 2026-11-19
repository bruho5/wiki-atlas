# Wiki Atlas

[简体中文](README.zh-CN.md)

**Explore Wikipedia as a map.** Wiki Atlas turns links between articles into an interactive map you can pan, zoom, and follow. It is a browser-based portfolio project, not a mirror of Wikipedia or an official Wikimedia project.

## Try it

**[Open the live demo](https://wiki-atlas-demo.punky-pp.chatgpt.site/#en/Hades)** · No sign-in required.

The default starting point is Hades, the mythological figure. To link directly to this example on any deployment, append `#en/Hades` to the home URL. Try **Hades → Zagreus → Back** to see browsing history restore your previous view.

- Search English or Chinese Wikipedia for an article. The control labeled **Wiki** selects the content source; **UI** changes the language of the interface separately.
- Drag the map to move, scroll or use the buttons to zoom, and select a circular node to read its summary. Moving near a frontier can reveal another branch.
- The selected article shows up to six outgoing links per batch. **Previous batch** and **Next batch** swap the six positions without moving the map.
- Hover or focus a node to add it to the **Reading list** without opening it. On touch screens, use the small plus by a node. Open the list to jump back to a saved article.
- **Back** and **Forward** restore the previous article, map position, zoom, and batch. They do not undo bookmarks.

## Run locally

No dependencies, build, account, or API key are required. With Python 3 installed:

```sh
python -m http.server 8000
```

Open [localhost:8000](http://localhost:8000) from the repository directory. Serve the files over HTTP rather than double-clicking `index.html`; browsers restrict script-module loading from local files.

The repository can also be hosted as a static site. For GitHub Pages, publish the root of the default branch; the bundled `.nojekyll` file disables Jekyll processing. No build workflow is required.

## How it works

- HTML, CSS, and JavaScript modules; SVG draws connections, and HTML buttons represent articles.
- The [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page) supplies searches, article excerpts, links, and media metadata directly to the browser. Body links are preferred over links from shared templates. This follows real links; it does not generate recommendations with AI.
- Static hosting has no backend; Wikimedia receives the search and article queries. Bookmarks and interface preference are stored in this browser, not synced. Navigation history lasts until the current page is reloaded.
- Without a connection to Wikimedia, a small, explicitly labeled Hades sample lets you try navigation. Some articles have no freely licensed thumbnail with usable metadata; those appear as lettered nodes.

## Credits and third-party material

Article excerpts are attributed to Wikipedia contributors via the linked article. Excerpts can be shortened, and the UI links to the applicable [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) text license. The app requests freely licensed thumbnails only, fetches creator and license details via the file metadata, and links to the file page. Cropping to circles is a visual change; file pages show original sources and licenses. Wikimedia material is not bundled in the repo or relicensed by this project. See [Wikimedia terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use) and [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).

[Floor796](https://floor796.com/) inspired the feeling of panning into new territory. Wiki Atlas does not use its code, artwork, or assets.
