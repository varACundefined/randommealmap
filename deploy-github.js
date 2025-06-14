const { execSync } = require('child_process');
const path = require('path');

// 确保在项目根目录下运行
const projectRoot = __dirname;

try {
    // 1. 构建项目
    console.log('Building project...');
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });

    // 2. 进入构建目录
    const distPath = path.join(projectRoot, 'dist');
    
    // 3. 初始化 git 仓库（如果需要）
    console.log('Initializing git repository in dist folder...');
    execSync('git init', { stdio: 'inherit', cwd: distPath });

    // 4. 添加所有文件
    console.log('Adding files...');
    execSync('git add -A', { stdio: 'inherit', cwd: distPath });

    // 5. 强制提交更改
    console.log('Committing changes...');
    try {
        execSync('git commit -m "deploy"', { stdio: 'inherit', cwd: distPath });
    } catch (error) {
        // 如果没有更改，继续执行
        console.log('No changes to commit, continuing...');
    }

    // 6. 强制推送到 github 的 gh-pages 分支
    console.log('Pushing to GitHub...');
    execSync('git push -f git@github.com:varacundefined/randommealmap.git master:gh-pages', { stdio: 'inherit', cwd: distPath });

    console.log('Deployment complete!');
    console.log('Your app will be available at: https://varacundefined.github.io/randommealmap/');

} catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
}
