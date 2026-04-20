// 检查屏幕尺寸检测
const fs = require('fs');
const path = require('path');

const basePath = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Profile 1', 'Local Extension Settings');
const targetExt = 'fkflkkaiaemafmbadbjpehbkpfiigdfk';
const logPath = path.join(basePath, targetExt, '000003.log');

if (fs.existsSync(logPath)) {
    const data = fs.readFileSync(logPath);
    const content = data.toString('utf-8');

    // 提取最新的记录
    const records = [];
    const searchStr = 'floatingVideoState';
    const searchBytes = Buffer.from(searchStr);

    for (let i = 0; i <= data.length - searchBytes.length; i++) {
        let found = true;
        for (let j = 0; j < searchBytes.length; j++) {
            if (data[i + j] !== searchBytes[j]) {
                found = false;
                break;
            }
        }
        if (found) {
            const startPos = i + searchBytes.length;
            const chunk = data.slice(startPos, Math.min(startPos + 2000, data.length));

            let jsonStart = 0;
            for (let k = 0; k < chunk.length; k++) {
                if (chunk[k] === 0x7b) {
                    jsonStart = k;
                    break;
                }
            }

            let jsonStr = '';
            let braceCount = 0;
            let inString = false;

            for (let k = jsonStart; k < chunk.length; k++) {
                const byte = chunk[k];
                const char = String.fromCharCode(byte);

                if (byte === 0x22 && chunk[k-1] !== 0x5c) {
                    inString = !inString;
                }

                if (!inString) {
                    if (byte === 0x7b) braceCount++;
                    else if (byte === 0x7d) {
                        braceCount--;
                        if (braceCount === 0) {
                            jsonStr += char;
                            break;
                        }
                    }
                }

                if (byte >= 0x20 || inString) {
                    jsonStr += char;
                }
            }

            try {
                const obj = JSON.parse(jsonStr);
                if (obj.version === 5 && obj.viewportWidth) {
                    records.push(obj);
                }
            } catch (e) {}
        }
    }

    if (records.length > 0) {
        // 分析档位计算
        console.log('=== 档位计算分析 ===\n');

        // 假设可能的屏幕宽度
        const possibleScreenWidths = [3840, 3440, 2560, 1920, 1680, 1440];

        records.slice(-5).forEach((record, idx) => {
            const viewportWidth = record.viewportWidth;
            const activeTier = record.activeTier;

            console.log(`记录 ${records.length - 4 + idx}:`);
            console.log(`  视口宽度: ${viewportWidth}px`);
            console.log(`  记录的档位: ${activeTier}`);

            possibleScreenWidths.forEach(sw => {
                const ratio = viewportWidth / sw;
                let calculatedTier = 'small';
                if (ratio >= 0.85) calculatedTier = 'max';
                else if (ratio >= 0.70) calculatedTier = 'wide';
                else if (ratio >= 0.55) calculatedTier = 'medium';

                const match = calculatedTier === activeTier ? '✅' : '❌';
                console.log(`    假设屏幕${sw}px: 比例=${(ratio*100).toFixed(1)}% → ${calculatedTier} ${match}`);
            });
            console.log('');
        });
    }
} else {
    console.log('找不到文件');
}
