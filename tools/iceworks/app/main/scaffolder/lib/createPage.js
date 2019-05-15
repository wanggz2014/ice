/**
 * 创建页面
 */
const fs = require('fs');
const path = require('path');
const kebabCase = require('kebab-case');
const mkdirp = require('mkdirp');
const upperCamelCase = require('uppercamelcase');
const pathExists = require('path-exists');
const prettier = require('prettier');
const utils = require('./utils');
const pageTemplates = require('./pageTemplates');
const { DetailError } = require('../../error-handler');
const config = require('../../config');
const appendRouteV3 = require('./appendRouteV3');
const appendRouteV4 = require('./appendRouteV4');
const appendMenuV4 = require('./appendMenuV4');
const logger = require('../../logger');
const removePage = require('../../scaffolder/lib/removePage');
const { emitProcess, emitError, emitProgress } = require('../../services/tracking');

/**
 * 新建页面功能
 * 参数有以下内容
 *
 * 新增步骤
 * 1. 生成 pages 文件, blocks tar 包文件下载
 * 2. 安装 blocks 的依赖
 * 3. pages.js 文件写入
 * 4. routesConfig.js 关系写入
 *    - 支持二级路由
 *    - 支持路由参数
 *
 * 布局生成：
 * 1. 下载 layout block
 * 2. 安装 layout 依赖
 */

module.exports = async function createPage({
  pageName,
  routePath,
  routeText,
  routeIcon, // 用于生成导航栏左侧 icon
  clientPath, // 当前项目的前端目录地址
  clientSrcPath, // 前端项目资源地址
  layout, // 用户选择的布局
  blocks = [],
  interpreter,
  preview = false, // 用来生成 preview page 做预览使用
  builtIn = false, // 如果设置为 true, 文件冲突情况下不再询问, 直接忽略
  libary = 'react', // hack 用于识别 vue 项目做特殊处理
  // excludeLayout = false,
  progressFunc,
  pageMeta,
  projectMenu
}) {
  logger
  // 初始参数
  const fileList = [];
  let layoutName = '';
  if (layout) { // 兼容没有layout的情况，比如通过打开项目引入的项目很可能没有。
    layoutName = layout.name;
  }

  routePath = routePath || pageName;

  /**
   * 1. 获取当前项目的package.json中的数据
   */
  let currentEvent = 'checkPathValid';
  emitProcess(currentEvent);

  const pkgPath = path.join(clientPath, 'package.json');
  let pkg = {};
  if (pathExists.sync(pkgPath)) {
    try {
      const packageText = fs.readFileSync(pkgPath);
      pkg = JSON.parse(packageText.toString());
    } catch (e) {
      emitError(currentEvent, {
        message: 'package.json 内存在语法错误',
        pkg: fs.readFileSync(pkgPath),
      });
      throw new DetailError('package.json 内存在语法错误', {
        message: `请检查${clientPath}目录下 package.json 的语法规范`,
      });
    }
  } else {
    emitError(currentEvent, { message: '找不到 package.json' });
    throw new DetailError('找不到 package.json', {
      message: `在${clientPath}目录下找不到 package.json 文件`,
    });
  }
  // 兼容依赖
  pkg.dependencies = pkg.dependencies || {};

  if (preview) {
    pageName = 'IceworksPreviewPage';
    routePath = 'IceworksPreviewPage';
    routeText = 'IceworksPreviewPage';
  }

  /**
    * 2. 检测目录合法，生成页面的目录路径
    */
  const projectValid = await utils.checkValidICEProject(clientPath);
  if (!projectValid) {
    utils.createInterpreter('UNSUPPORTED_DESTPATH', { clientPath }, interpreter);
    return [];
  }

  // 生成页面的目录路径
  const pageFolderName = upperCamelCase(pageName || '');
  pageName = kebabCase(pageFolderName).replace(/^-/, '');
  const pageDir = path.join(clientSrcPath, 'pages', pageFolderName);
  mkdirp.sync(pageDir);

  // 如果页面级目录(page)存在 不允许 override
  if (builtIn && fs.existsSync(pageDir) && fs.readdirSync(pageDir).length > 0) {
    const canOverride = await utils.createInterpreter(
      'DESTDIR_EXISTS_OVERRIDE',
      { dir: pageDir, clientPath },
      interpreter
    );
    if (!canOverride) {
      return [];
    }
  }

  // 3. 下载区块 
  if (Array.isArray(blocks)) {
    // className、relativePath用于ejs模板语言生成page.jsx
    blocks.forEach((block) => {
      const blockFolderName = block.alias || upperCamelCase(block.name) || block.className; // block 目录名
      // 转换了 alias 的名称
      const blockClassName = upperCamelCase(
        block.alias || block.className || block.name
      );
      block.className = blockClassName;
      // block 的相对路径,生成到页面的 components 下面
      block.relativePath = `./components/${blockFolderName}`;
    });

    // 下载区块到页面，返回区块的依赖
    let dependencies = {};
    currentEvent = 'generateBlocks';
    emitProcess(currentEvent);
    emitProgress(true);
    try {
      const deps = await utils.downloadBlocksToPage({
        clientPath,
        clientSrcPath,
        blocks,
        pageName: pageFolderName,
        progressFunc,
      });
      dependencies = deps.dependencies;
    } catch (error) {
      emitProgress(false);
      throw error;
    }
    emitProgress(false);

    // 安装 block 依赖
    currentEvent = 'installBlockDeps';
    if (Object.keys(dependencies).length > 0) {
      emitProcess(currentEvent);
      let reinstallCount = 1;
      let waitUntilNpmInstalled = await utils.createInterpreter(
        'ADD_DEPENDENCIES',
        dependencies,
        interpreter
      );

      if (!waitUntilNpmInstalled) {
        // 失败尝试一次自动重装。
        if (reinstallCount) {
          reinstallCount -= 1;
          waitUntilNpmInstalled = await utils.createInterpreter(
            'ADD_DEPENDENCIES',
            dependencies,
            interpreter
          );
        }

        const blocksName = blocks
          .map(({ source }) => `${source.npm}@${source.version}`)
          .join(' ');
        const depsName = Object.keys(dependencies)
          .map((d) => `${d}@${dependencies[d]}`)
          .join(' ');
        throw new DetailError('blocks 依赖安装失败， 请在设置中切换npm源并重试', {
          message: `无法安装以下区块： blocks: ${blocksName} dependencies: ${depsName}`,
        });
      }
    }
  }

 
  //增加一块关于page的处理
  /**
   * 业务逻辑：
   * block is page  
   *    only one can this page contain
   */
  let pageBlock=undefined;
  blocks.forEach(function(block){
    if(block.name.indexOf('page')>-1){
      if(pageBlock!=undefined){
        throw new Error('页面只能包含一个页面物料')
      }
      pageBlock=block;
    }
  })

  
  //added by wgz 根据区块类型进行代码构建
  /**
   * 业务逻辑：
   * block split to  [{layout:layout,blocks:[]}] 
   * trans {layout,blocks}-> {layout,slotNames:{name,block},slotDefault:[]}
   * result format: [{layout,slotNames:{name,block},slotDefault:[]}]
   */
  const renders=[];
  if(pageBlock==undefined){
    try{
      const layoutSplit=[];
      blocks.forEach(function(block){
        //布局区块，则增加一个分区
        if(block.name.indexOf('layout')>-1){
          const split={
            layout:block,
            blocks:[]
          }
          layoutSplit.push(split);
          return;
        }

        //业务区块，如果不存在布局则提示失败
        if(block.name.indexOf("layout")==-1&&layoutSplit.length==0){
          throw new Error('当前页面不存在布局，无法确定业务区块存放位置')
        }

        const split=layoutSplit[layoutSplit.length-1];
        split.blocks.push(block)
      })

      //进行数据格式转换
      const regExp=new RegExp('<slot\s*(name\s*=\s*"(\w+)"\s*)*>',"g");
      layoutSplit.forEach(function(split){
        const layout={
          layout:split.layout,
          slotNames:[],
          slotDefault:[]
        }

        //init slotName
        const layoutPath = path.join(
          clientSrcPath,
          'pages',
          pageFolderName,
          'components',
          split.layout.alias,
          'index.vue'
        );
        const layoutContent = fs.readFileSync(layoutPath, 'utf-8');    
        let match=regExp.exec(layoutContent);
        while (match != null) {
          //不是default slot
          if(match[2]!=undefined){
            logger.debug("slotName:",match[2]);
            layout.slotNames.push({
              name:match[2],
              block:null
              })
          }
          match = regExp.exec(layoutContent);
        }
        //put block
        split.blocks.forEach(function(block){
          //进行名称匹配
          const alias=block.alias
          for(let i=0;i<layout.slotNames.length;i++){
            if(layout.slotNames[i].name==alias){
              layout.slotNames[i].block=block;
              return;
            }
          }
          
          //无匹配，放入default
          layout.slotDefault.push(block);
        })
        renders.push(layout)
      })
    }catch(error){
      await removePage({
        clientSrcPath,
        pageFolderName
      })
      logger.error(error);
      throw error;
    }
  }

  /**
   * 4. 生成 ${pageName}/xxxx 文件
   */
  const scaffoldConfig = pkg.scaffoldConfig || {};
  const renderData = {
    // layout
    layout: (layout && layout.name) || '',
    // blocks
    blocks,
    // [{
    //   className: 'Card',
    //   relativePath: '../../components/Card'
    // }],
    // 类名 ExampleSomeThing
    className: pageFolderName,
    // 小写名 home
    pageName,
    scaffoldConfig,
    renders,
    pageBlock
  };

  currentEvent = 'generatePage';
  emitProcess(currentEvent);

  const templatePath=path.join(clientPath,"src/template");
  const done = pageTemplates(libary,templatePath).reduce((prev, template) => {
    try {
      //logger.debug("renderData:",renderData);
      const fileContent = template.compile(renderData);
      const fileName = template.fileName
        .replace(/PAGE/g, pageFolderName)
        .replace(/\.ejs$/g, '');
      const dist = path.join(pageDir, fileName);
      const fileExt = path.extname(dist);

      let parser = libary === 'vue' ? 'vue' : 'babylon';
      if (fileExt === '.scss') {
        parser = 'scss';
      }else if(fileExt === '.js'){
        parser = 'typescript'
      }

      const rendered = prettier.format(
        fileContent,
        Object.assign({}, config.prettier, { parser })
      );

      fileList.push(dist);
      fs.writeFileSync(dist, rendered, 'utf-8');
      // eslint-disable-next-line
      return prev & 0x1;
    } catch (err) {
      logger.error(err);
      // eslint-disable-next-line
      return prev & 0x0;
    }
  }, 0x1);

  /**
   * 5. 生成meta.json
   */
  if(pageBlock){
    const dist = path.join(pageDir,"components",pageBlock.alias, "meta.json");
    logger.info('createPage pageMeta:', pageMeta);
    fs.writeFileSync(dist,  JSON.stringify(pageMeta, null, 2), 'utf-8');
    logger.info('createPage pageMenu:', projectMenu);
    const menuPath=path.join(clientSrcPath,"config","menu.json")
    fs.writeFileSync(menuPath,JSON.stringify(projectMenu, null, 2), 'utf-8');
  }

  // /**
  //  * 5. 更新 routes.jsx
  //  */
  // let routeFilePath = path.join(clientSrcPath, 'router.jsx');
  // const routerConfigFilePath = path.join(clientSrcPath, 'routerConfig.js');
  // const menuConfigFilePath = path.join(clientSrcPath, 'menuConfig.js');

  // if (!fs.existsSync(routeFilePath)) {
  //   // hack 兼容 vue 物料 router
  //   routeFilePath = path.join(clientSrcPath, 'router.js');
  // }

  // /**
  //  * 6. 更新配置文件 menuConfig， routerConfig
  //  */
  // currentEvent = 'appendConfig';
  // emitProcess(currentEvent);

  // // routeText 表示 menu 的导航名
  // if (pathExists.sync(menuConfigFilePath) && routeText) {
  //   logger.debug('写入 menuConfig', {
  //     name: routeText,
  //     path: routePath,
  //     menuConfigFilePath,
  //   });
  //   await appendMenuV4({
  //     name: routeText,
  //     path: routePath,
  //     menuConfigFilePath,
  //   }).catch(logger.debug);
  // }

  // if (pathExists.sync(routerConfigFilePath)) {
  //   logger.debug('写入 routerConfig', {
  //     name: routeText,
  //     path: routePath,
  //     menuConfigFilePath,
  //   });
  //   await appendRouteV4({
  //     routePath,
  //     routeFilePath,
  //     routerConfigFilePath,
  //     pageFolderName,
  //     layoutName,
  //   }).catch(logger.debug);
  // } else {
  //   // 旧版添加模式
  //   await appendRouteV3({
  //     clientPath,
  //     routePath,
  //     routeText,
  //     routeIcon, // 用于生成导航栏左侧 icon
  //     pageName, // 用于生成导航栏左侧 icon
  //     routeFilePath,
  //     pageFolderName,
  //     layoutClassName: upperCamelCase(layoutName),
  //     preview,
  //     builtIn,
  //   }).catch(() => {});
  // }

  //fileList.push(routeFilePath);

  if (!done) {
    await utils.createInterpreter('RENDER_PAGE_FAIL', true, interpreter);
  } else {
    await utils.createInterpreter('FILE_CREATED', fileList, interpreter);
  }
  return fileList;
};
