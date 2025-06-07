const fs = require('fs');
const path = require('path');

// 读取并执行 auto-follow.js 文件
const autoFollowScript = fs.readFileSync(path.join(__dirname, 'auto-follow.js'), 'utf8');

// 运行脚本
eval(autoFollowScript);  // 注意：使用 eval 会执行代码，但要小心潜在的安全风险
