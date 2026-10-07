const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('file://C:/final bas/BAS_YASH_2_ZIP/BAS/frontend/test_echarts.html');
    
    // Evaluate the new click logic inside the page
    await page.evaluate(() => {
        chart.off('click');
        chart.getZr().off('click');
        chart.getZr().on('click', function (params) {
            const pointInPixel = [params.offsetX, params.offsetY];
            if (chart.containPixel('grid', pointInPixel)) {
                const xIndex = chart.convertFromPixel({ seriesIndex: 0 }, pointInPixel)[0];
                const option = chart.getOption();
                const mode = option.xAxis[0].data[xIndex];
                document.getElementById('output').innerText = 'Clicked using ZRender: ' + mode;
            }
        });
    });

    // CHEQUE is the second item (index 1). It's located horizontally in the middle.
    // The chart width is 600. The grid usually has some padding.
    // Let's just click at x=300 (middle), y=100 (way above the bar, in the empty space)
    await page.mouse.click(300, 100);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 500));
    
    const output = await page.$eval('#output', el => el.innerText);
    console.log('Output from click at (300, 100):', output);

    await browser.close();
})();
