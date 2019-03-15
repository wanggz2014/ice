import { observable, action, computed } from 'mobx';

import services from '../services';
const { settings } = services;

// 文档
// https://www.npmjs.com/package/intro.js-react
// https://introjs.com/

class Intro {
  @observable
  stepsEnabled = false;
  // stepsEnabled = true;
  @observable
  hintsEnabled = true;

  @observable
  installProject = false; // 初始化项目时，是否选择了安装依赖
  @observable
  currentHints = [];

  steps = [
    {
      element: '.intro1',
      intro: '1. 在这里进行项目的管理哦，可以创建、删除项目，同时查看已有项目是否在调试中（绿点标识）。',
      position: 'bottom',
    },
    {
      element: '.intro2',
      intro: '2. 最常用的功能区，项目开发的第一步推荐你启动调试服务。',
    },
    {
      element: '.intro3',
      intro: '3. 在这里查看运行日志，安装单个依赖，或者重装依赖。',
    },
    {
      element: '.intro4',
      intro: '4. 工作台区域，提供了更详细的项目信息，以及各类插件能力。',
      position: 'top',
    },
    {
      element: '.intro5',
      intro: '5. 最后，从这里直接唤起你的 IDE 开始 coding 吧',
    }
  ];

  hints1 = [
    {
      element: '.hint1',
      hint: 'test 1',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugShowed'
    },
    {
      element: '.hint2',
      hint: 'test 2',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugShowed'
    }
  ];
  hints2 = [
    {
      element: '.hint3',
      hint: '点击为项目安装依赖',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugFailedShowed'
    }
  ];
  hints3 = [
    {
      element: '.hint4',
      hint: '点击 url 打开浏览器查看调试服务',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugSucShowed'
    }
  ];
  hints4 = [
    {
      element: '.hint5',
      hint: '新建页面会出现在这里，可以添加区块到页面或者删除页面',
      hintPosition: 'middle-middle',
      key: 'hintNewPageItemShowed'
    },
    {
      element: '.hint6',
      hint: '打开编辑器，开发你的项目吧',
      hintPosition: 'middle-middle',
      key: 'hintNewPageItemShowed'
    }
  ]

  constructor() {
    // 初始化 intro 状态
  }

  @action
  onExit = () =>  {
    console.log('step exit')
    this.done = true; // skip 情况下
    this.stepsEnabled = false;
    settings.set('stepShowed', true);
    // step 执行完 启动 hints 提示
    if (!settings.get('hintStartDebugShowed')) {
      this.currentHints = this.hints1;
    }
  }

  @action
  onBeforeExit = () => {
    console.log('onBeforeExit')
    if (this.done) {
      return true;
    }
    return false
  }

  @action
  onComplete = () => {
    console.log('onComplete');
    this.done = true;
  }

  @action 
  onhintclose = (index) => {
    if (this.currentHints[index] && this.currentHints[index].key) {
      settings.set(this.currentHints[index].key, true);
    }
  }

  @action
  start() {
    if (!settings.get('stepShowed')) {
      this.stepsEnabled = true;
    }
  }

  @action
  startAfterCloseLogs() {
    if (!settings.get('stepShowed') && this.installProject) {
      this.stepsEnabled = true;
      this.installProject = false;
    }
  }

  @action
  startHintAfterDebugFailed() {
    if (!settings.get('hintStartDebugFailedShowed')) {
      this.currentHints = this.hints2;
    }
  }

  @action
  startHintAfterDebugSuc() {
    if (!settings.get('hintStartDebugSucShowed')) {
      this.currentHints = this.hints3;
    }
  }

  @action
  startHintNewPageItemShowed() {
    if (!settings.get('hintNewPageItemShowed')) {
      this.currentHints = this.hints4;
    }
  }
}

export default new Intro();
