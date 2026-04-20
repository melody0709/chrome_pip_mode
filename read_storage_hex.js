// 使用十六进制方式读取 Chrome Extension Storage LevelDB 文件
const fs = require('fs');
const path = require('path');

function findDataInBinary(filePath) {
    try {
        const data = fs.readFileSync(filePath);

        console.log(`文件大小: ${data.length} bytes`);
        console.log('搜索 floatingVideoState 数据...\n');

        // 搜索 "floatingVideoState" 字符串的 ASCII 码
        const searchStr = 'floatingVideoState';
        const searchBytes = Buffer.from(searchStr);

        const positions = [];
        for (let i = 0; i <= data.length - searchBytes.length; i++) {
            let found = true;
            for (let j = 0; j < searchBytes.length; j++) {
                if (data[i + j] !== searchBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                positions.push(i);
            }
        }

        console.log(`找到 ${positions.length} 处 "floatingVideoState" 标记\n`);

        const allRecords = [];
        const seen = new Set();

        positions.forEach((pos, idx) => {
            // 读取标记后的数据（通常是JSON）
            const startPos = pos + searchBytes.length;
            const chunk = data.slice(startPos, Math.min(startPos + 2000, data.length));

            // 尝试找到JSON起始位置（{ 字符）
            let jsonStart = 0;
            for (let i = 0; i < chunk.length; i++) {
                if (chunk[i] === 0x7b) { // '{'
                    jsonStart = i;
                    break;
                }
            }

            // 提取JSON字符串
            let jsonStr = '';
            let braceCount = 0;
            let inString = false;
            let stringEnded = false;

            for (let i = jsonStart; i < chunk.length; i++) {
                const byte = chunk[i];
                const char = String.fromCharCode(byte);

                if (byte === 0x22 && chunk[i-1] !== 0x5c) { // '"' not preceded by '\'
                    inString = !inString;
                }

                if (!inString) {
                    if (byte === 0x7b) braceCount++; // '{'
                    else if (byte === 0x7d) { // '}'
                        braceCount--;
                        if (braceCount === 0) {
                            jsonStr += char;
                            break;
                        }
                    }
                }

                // 只添加可打印字符和在字符串中的控制字符
                if (byte >= 0x20 || inString) {
                    jsonStr += char;
                }
            }

            try {
                const obj = JSON.parse(jsonStr);

                // 检查是否是有效的浮窗数据
                if (obj.version === 5 && obj.viewportWidth) {
                    // 去重
                    const key = `${obj.viewportWidth}-${obj.width}-${obj.left}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        allRecords.push(obj);
                    }
                }
            } catch (e) {
                // 解析失败，忽略
            }
        });

        return allRecords;
    } catch (error) {
        console.error('读取文件失败:', error.message);
        return [];
    }
}

// 主程序
const basePath = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Profile 1', 'Local Extension Settings');
const targetExt = 'fkflkkaiaemafmbadbjpehbkpfiigdfk';
const logPath = path.join(basePath, targetExt, '000003.log');

if (fs.existsSync(logPath)) {
    console.log('📁 读取文件:', logPath);
    console.log('');

    const allData = findDataInBinary(logPath);

    console.log(`✅ 解析到 ${allData.length} 条唯一记录\n`);

    if (allData.length === 0) {
        console.log('⚠️ 没有找到有效数据，可能原因：');
        console.log('1. LevelDB 文件格式需要专用库解析');
        console.log('2. 数据已被压缩或编码');
        console.log('3. 数据存储在其他文件中\n');

        // 尝试直接打印原始内容片段
        const raw = fs.readFileSync(logPath);
        const str = raw.toString('utf-8');
        console.log('原始内容片段（前2000字符）：');
        console.log(str.substring(0, 2000));
    } else {
        // 分析档位数据
        const tiers = { max: [], wide: [], medium: [], small: [] };

        allData.forEach((record, index) => {
            const tier = record.activeTier || record.windowSizeCategory || 'UNKNOWN';
            if (tiers[tier]) tiers[tier].push(record);

            // 解析 widthRatios
            let widthRatios = {};
            try {
                if (typeof record.widthRatios === 'string') {
                    widthRatios = JSON.parse(record.widthRatios);
                } else if (typeof record.widthRatios === 'object') {
                    widthRatios = record.widthRatios;
                }
            } catch (e) {}

            console.log(`--- 记录 ${index + 1} ---`);
            console.log(`档位: ${tier}`);
            console.log(`视口: ${record.viewportWidth} x ${record.viewportHeight}`);
            console.log(`浮窗: 宽=${record.width}, 高=${record.height}, 左=${record.left}, 上=${record.top}`);
            console.log(`当前档位比例: ${record.widthRatio ? (record.widthRatio * 100).toFixed(2) + '%' : 'N/A'}`);

            if (Object.keys(widthRatios).length > 0) {
                console.log('已保存的档位比例:');
                Object.entries(widthRatios).forEach(([key, value]) => {
                    console.log(`  ${key}: ${(value * 100).toFixed(2)}%`);
                });
            }
            console.log('');
        });

        // 汇总
        console.log('=== 档位统计 ===');
        const tierNames = { max: 'MAX', wide: 'WIDE', medium: 'MEDIUM', small: 'SMALL' };
        Object.entries(tiers).forEach(([tier, records]) => {
            const tierDisplay = tierNames[tier] || tier;
            if (records.length > 0) {
                console.log(`${tierDisplay}: ${records.length} 条记录`);
                const latest = records[records.length - 1];
                let ratios = {};
                try {
                    ratios = typeof latest.widthRatios === 'string'
                        ? JSON.parse(latest.widthRatios)
                        : latest.widthRatios || {};
                } catch (e) {}

                if (ratios[tier]) {
                    console.log(`  该档位比例: ${(ratios[tier] * 100).toFixed(2)}%`);
                }
            } else {
                console.log(`${tierDisplay}: 无数据`);
            }
        });
    }
} else {
    console.log('❌ 找不到文件:', logPath);
}
