// ==KonMikExtension==
// @ID         komikav
// @NAME       KomikAV
// @TYPE       comic
// @VERSION    1.0.0
// @COLOR      #e50914
// @ICON       https://komikav.net/favicon.ico
// @REFERER    https://komikav.net/
// ==/KonMikExtension==

const KonmikExtension = {
    baseUrl: "https://komikav.net",

    async getList(page, query, filters) {
        let url = `${this.baseUrl}/`;
        let params = [];

        if (query) {
            params.push(`s=${encodeURIComponent(query)}`);
        }
        if (page && page > 1) {
            params.push(`page=${page}`);
        }

        if (params.length > 0) {
            url += `?${params.join("&")}`;
        }

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": this.baseUrl
            }
        });

        const html = await response.text();
        const list = [];

        // Regex untuk mencocokkan item komik pada halaman daftar/pencarian
        // Biasanya struktur umum menggunakan tag <article> atau blok grid/list dengan tag <a> dan <img>
        const itemRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
        let match;

        while ((match = itemRegex.exec(html)) !== null) {
            const block = match[1];

            const linkMatch = block.match(/href="([^"]+)"/i);
            const titleMatch = block.match(/title="([^"]+)"/i) || block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
            const imgMatch = block.match(/src="([^"]+)"/i) || block.match(/data-src="([^"]+)"/i);
            const latestMatch = block.match(/class="[^"]*chapter[^"]*"[^>]*>([\s\S]*?)<\/[A-Za-z0-9]+>/i);

            if (linkMatch) {
                let title = titleMatch ? titleMatch[1].replace(/<[^>]*>?/gm, '').trim() : "No Title";
                let urlPath = linkMatch[1];
                if (!urlPath.startsWith("http")) {
                    urlPath = this.baseUrl + (urlPath.startsWith("/") ? "" : "/") + urlPath;
                }

                let cover = imgMatch ? imgMatch[1] : "";
                let latest = latestMatch ? latestMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";

                list.push({
                    title: title,
                    url: urlPath,
                    coverUrl: cover,
                    latestChapter: latest
                });
            }
        }

        // Fallback jika markup tidak menggunakan tag <article>
        if (list.length === 0) {
            const fallbackLinkRegex = /<a[^>]*href="([^"]*\/manga\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            while ((match = fallbackLinkRegex.exec(html)) !== null) {
                let urlPath = match[1];
                let inner = match[2];
                let titleMatch = inner.match(/alt="([^"]+)"/i) || inner.match(/<img[^>]*alt="([^"]+)"/i);
                let imgMatch = inner.match(/src="([^"]+)"/i) || inner.match(/data-src="([^"]+)"/i);

                if (titleMatch) {
                    list.push({
                        title: titleMatch[1].trim(),
                        url: urlPath.startsWith("http") ? urlPath : this.baseUrl + urlPath,
                        coverUrl: imgMatch ? imgMatch[1] : "",
                        latestChapter: ""
                    });
                }
            }
        }

        return {
            list: list,
            hasNextPage: html.includes("next page") || html.includes("pagination") && html.includes("next")
        };
    },

    async getDetail(url) {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": this.baseUrl
            }
        });

        const html = await response.text();

        // Ekstraksi Detail Utama
        const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const coverMatch = html.match(/class="[^"]*thumb[^"]*"[^>]*>[\s\S]*?src="([^"]+)"/i) || html.match(/property="og:image"\s+content="([^"]+)"/i);
        const descMatch = html.match(/class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || html.match(/class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        
        let title = titleMatch ? titleMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";
        let cover = coverMatch ? coverMatch[1] : "";
        let description = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";

        // Ekstraksi Genre
        let genres = [];
        const genreRegex = /href="[^"]*\/genres?\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        let gMatch;
        while ((gMatch = genreRegex.exec(html)) !== null) {
            genres.push(gMatch[1].replace(/<[^>]*>?/gm, '').trim());
        }

        // Ekstraksi Daftar Chapter
        let chapters = [];
        const chapterRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        const chapLinkRegex = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
        let cMatch;

        while ((cMatch = chapterRegex.exec(html)) !== null) {
            let itemHtml = cMatch[1];
            let linkMatch = itemHtml.match(chapLinkRegex);
            if (linkMatch) {
                let chapUrl = linkMatch[1];
                if (!chapUrl.startsWith("http")) {
                    chapUrl = this.baseUrl + (chapUrl.startsWith("/") ? "" : "/") + chapUrl;
                }
                let chapTitle = linkMatch[2].replace(/<[^>]*>?/gm, '').trim();
                let dateMatch = itemHtml.match(/class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

                chapters.push({
                    name: chapTitle,
                    url: chapUrl,
                    date: dateMatch ? dateMatch[1].replace(/<[^>]*>?/gm, '').trim() : ""
                });
            }
        }

        // Fallback pencarian link chapter jika struktur list berbeda
        if (chapters.length === 0) {
            let genericLinkRegex = /<a[^>]*href="([^"]*chapter[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
            let glMatch;
            while ((glMatch = genericLinkRegex.exec(html)) !== null) {
                let chapUrl = glMatch[1];
                if (!chapUrl.startsWith("http")) {
                    chapUrl = this.baseUrl + (chapUrl.startsWith("/") ? "" : "/") + chapUrl;
                }
                chapters.push({
                    name: glMatch[2].replace(/<[^>]*>?/gm, '').trim(),
                    url: chapUrl,
                    date: ""
                });
            }
        }

        return {
            title: title,
            coverUrl: cover,
            description: description,
            genres: genres,
            chapters: chapters
        };
    },

    async getChapterImages(url) {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": this.baseUrl
            }
        });

        const html = await response.text();
        let images = [];

        // Mencari container gambar pembaca chapter
        const readerContainerMatch = html.match(/class="[^"]*(reading-content|chapter-content|viewer)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const searchHtml = readerContainerMatch ? readerContainerMatch[2] : html;

        // Mencari tag <img> atau atribut sumber gambar
        const imgRegex = /<img[^>]+(?:src|data-src)="([^"]+)"[^>]*>/gi;
        let match;

        while ((match = imgRegex.exec(searchHtml)) !== null) {
            let imgUrl = match[1].trim();
            // Lewati gambar kecil/ikon jika ada
            if (imgUrl && !imgUrl.includes("logo") && !imgUrl.includes("icon") && !images.includes(imgUrl)) {
                if (!imgUrl.startsWith("http")) {
                    imgUrl = this.baseUrl + (imgUrl.startsWith("/") ? "" : "/") + imgUrl;
                }
                images.push(imgUrl);
            }
        }

        return images;
    }
};
