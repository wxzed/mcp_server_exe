/**
 * Custom MCP configuration example file
 * Usage: mcp_server --mcp-js ./custom-mcp-config.js
 */

function configureMcp(server, ResourceTemplate, z) {

    // Configure custom tool
    server.tool(
        "load_product_hunt_js_code",
        'load product hunt js code', {},
        async() => {

            const code = encodeURIComponent(`
function extractProductInfo(doc) {

    // 3. 提取所有产品部分
    const productSections = doc.querySelectorAll('section[data-test^="post-item-"]');

    const products = [];

    productSections.forEach((section, index) => {

        // 提取产品名称
        const nameLink = section.querySelector('a[data-test^="post-name-"]');
        const name = nameLink ? nameLink.textContent.trim() : '';

        // 提取产品描述
        const descriptionLink = section.querySelector('a.text-secondary');
        const description = descriptionLink ? descriptionLink.textContent.trim() : '';

        // 提取产品URL
        const url = nameLink ? nameLink.getAttribute('href') : '';
        const fullUrl = url ? "https://www.producthunt.com" + url : '';

        // 提取产品图片
        let imageUrl = '';
        const img = section.querySelector('img');
        if (img) {
            imageUrl = img.getAttribute('src') || '';
            // 检查srcset是否包含更高清的图片
            const srcset = img.getAttribute('srcset');
            if (srcset) {
                const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
                if (urls.length > 0) {
                    imageUrl = urls[0]; // 取第一个URL
                }
            }
        } else {
            const video = section.querySelector('video');
            if (video) {
                imageUrl = video.getAttribute('poster') || '';
            }
        }

        // 提取投票数
        const votesElement = section.querySelector('[data-sentry-component="Title"]');
        const votesText = votesElement ? votesElement.textContent.trim() : '0';
        const votes = parseInt(votesText.replace(/,/g, '')) || 0;

        // 提取排名
        const rankMatch = name.match(/^(\d+)\./);
        const rank = rankMatch ? parseInt(rankMatch[1]) : 0;

        // 清理产品名称
        const cleanName = name.replace(/^\d+\.\s*/, '').trim();

        products.push({
            rank,
            name: cleanName,
            description,
            url: fullUrl,
            imageUrl,
            votes
        });
    });

    return products;
}
const doc = document.querySelector("#root-container > div.pt-header");
const productInfo = extractProductInfo(doc);
// console.log(productInfo);
return productInfo;`)

            return {
                content: [{ type: "text", text: code }]
            }
        }
    );

    server.tool(
        "get_product_hunt_url",
        'get product hunt url', {},
        async() => {
            const url = 'https://www.producthunt.com';
            return {
                content: [{ type: "text", text: url }]
            }
        }
    );
}

module.exports = { configureMcp };