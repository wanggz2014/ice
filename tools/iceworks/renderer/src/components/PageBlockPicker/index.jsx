import { Dialog, Button, Feedback, Balloon, Form } from '@icedesign/base';
import { inject, observer } from 'mobx-react';
import { toJS } from 'mobx';
import Notification from '@icedesign/notification';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import JSONInput from 'react-json-editor-ajrm';
import locale    from 'react-json-editor-ajrm/locale/en';
import path from 'path';
import fs from 'fs';

import {
  dependenciesFormat,
  mergeDependenciesToPkg,
} from '../../lib/project-utils';
import projectScripts from '../../lib/project-scripts';
import {
  Panel as BlockPickerPanel,
  Previewer as BlockPreview,
  PreviewTitle,
} from '../BlockPicker';
import Progress from '../Progress';
import dialog from '../dialog';
import services from '../../services';
import logger from '../../lib/logger';
import './index.scss';

const { scaffolder } = services;
const FormItem = Form.Item;

// 向页面新增 block 的功能
// 包括展示现有 page 下的 blocks 以及选择新 block 的管理

@inject('pageBlockPicker', 'blocks', 'projects', 'progress')
@observer
class PageBlockPicker extends Component {
  static propTypes = {
    blocks: PropTypes.object.isRequired,
    pageBlockPicker: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.pageMeta={}
    this.projectMenu=undefined
  };

  handleMetaChange=(params)=>{
    //this.pageMeta=JSON.parse(text);
    if(params.jsObject){
      this.pageMeta=params.jsObject
    }
  };

  handleMenuChange=(params)=>{
    //this.pageMeta=JSON.parse(text);
    if(params.jsObject){
      this.projectMenu=params.jsObject
    }
  };

  /**
   * 添加区块，支持多个
   */
  handleBlocksAdd = (blockObj) => {
    const { pageBlockPicker, blocks } = this.props;
    if (!Array.isArray(blockObj)) {
      blockObj = [blockObj];
    }
    blockObj.forEach((block) =>
      blocks.addBlock(block, pageBlockPicker.existBlocks)
    );
  };

  /**
   * 关闭弹窗取消下载区块
   */
  handleClose = () => {
    const { pageBlockPicker, blocks } = this.props;
    if (!pageBlockPicker.isDownloading) {
      blocks.reset();
      pageBlockPicker.close();
    } else {
      return false;
    }
  };

  handlePageClose=()=>{
    const { pageBlockPicker } = this.props;
    pageBlockPicker.close();
  }

  handlePageOk=()=>{
    const { pageBlockPicker } = this.props;
    const existBlocks=pageBlockPicker.existBlocks;
    const blockPath=path.join(
      pageBlockPicker.blocksPath,
      existBlocks[0],
      'meta.json');
    
    fs.writeFileSync(blockPath,  JSON.stringify(this.pageMeta, null, 2), 'utf-8');
    
    const menuPath=path.join(this.props.pageBlockPicker.projectPath,'src','config','menu.json');
    fs.writeFileSync(menuPath,  JSON.stringify(this.projectMenu, null, 2), 'utf-8');

    pageBlockPicker.close();
  }


  /**
   * 兜底逻辑，将依赖信息写入到 package.json 里
   */
  writeDependencies = (blocksDependencies, clientPath) => {
    const { pageBlockPicker, progress } = this.props;
    mergeDependenciesToPkg(blocksDependencies, clientPath)
      .then(() => {
        progress.end();
        pageBlockPicker.close();
        Notification.warning({
          message:
            '区块依赖已兜底写入 package.json，可通过【重装依赖】修复，如多次失败可在设置中切换npm源再重试',
          duration: 8,
        });
      })
      .catch((e) => {
        pageBlockPicker.downloadDone();
        progress.reset();
        dialog.notice({
          title: '依赖写入 package.json 失败',
          error: e,
        });
      });
  };

  /**
   *
   * 安装区块依赖:
   *  1. 下载 tarball 包完成后对 dependencies 进行安装操作
   *  2. 如果安装失败，自动将 dependencies 与 package.json 进行合并
   */
  installBlocksDeps = (res) => {
    const { projects, progress } = this.props;
    const { currentProject = {} } = projects;
    const { clientPath } = currentProject;
    const { dependencies } = res;
    const blocksDependencies = dependenciesFormat(dependencies);

    if (blocksDependencies.length > 0) {
      progress.setStatusText('正在下载区块依赖');
      progress.setShowTerminal(true);
      progress.setShowProgress(false);

      return new Promise((resolve, reject) => {
        projectScripts.npminstall(
          currentProject,
          blocksDependencies.join(' '),
          false,
          (err) => {
            if (err) {
              this.writeDependencies(blocksDependencies, clientPath);
              const error = new Error('安装区块依赖失败');
              logger.error(error);
              reject(error);
            } else {
              logger.info('安装区块依赖成功');
              resolve();
            }
          }
        );
      });
    }
  };

  /**
   * 开始下载区块
   */
  handleOk = () => {
    const { pageBlockPicker, projects, progress } = this.props;
    const { pageName } = pageBlockPicker;
    const { currentProject = {} } = projects;
    const { clientPath, clientSrcPath } = currentProject;
    const blocks = toJS(this.props.blocks.selected);

    // 检测 block 是否存在冲突等
    if (pageBlockPicker.blockHasConflict(blocks)) {
      Feedback.toast.error(
        `区块名 ${pageBlockPicker.blockHasConflict(
          blocks
        )} 存在冲突，请修改后重试`
      );
      return false;
    }

    pageBlockPicker.downloadStart();
    progress.start(true);
    progress.setStatusText('正在请求区块数据');
    progress.setSectionCount(blocks.length);

    scaffolder.utils
      .downloadBlocksToPage({
        clientPath,
        clientSrcPath,
        blocks,
        pageName,
        progressFunc: progress.handleProgressFunc,
      })
      .then((res = {}) => {
        const hasDeps = Object.prototype.hasOwnProperty.call(
          res,
          'dependencies'
        );
        if (!hasDeps || (hasDeps && !Object.keys(res.dependencies).length)) {
          return true;
        }
        return this.installBlocksDeps(res);
      })
      .then(() => {
        progress.end();
        pageBlockPicker.close();
        if(scaffolder.utils.appendBlock(clientSrcPath,blocks,pageName)){
          Notification.success({
            message: '区块下载完成，区块自动引入页面',
            duration: 8,
          });
        }else{
          Notification.warning({
            message: '区块下载完成，区块自动引入页面异常，请手动引入',
            duration: 8,
          });
        }
      })
      .catch((error) => {
        pageBlockPicker.downloadDone();
        progress.reset();
        dialog.notice({
          title: '提示',
          error: error.stack,
        });
      });
  };

  render() {
    const existBlocks=this.props.pageBlockPicker.existBlocks;
    //核对是否为页面物料
    if(existBlocks.length>0&&existBlocks[0].toUpperCase().indexOf("PAGE">-1)){
      const blockPath=path.join(
        this.props.pageBlockPicker.blocksPath,
        existBlocks[0],
        'meta.json');
      //console.log(metaJson);
      this.pageMeta=JSON.parse(fs.readFileSync(blockPath).toString());

      const menuPath=path.join(this.props.pageBlockPicker.projectPath,'src','config','menu.json');
      this.projectMenu=JSON.parse(fs.readFileSync(menuPath).toString())

      return (
        <Dialog
          title="填写页面信息"
          visible={this.props.pageBlockPicker.visible}
          onClose={this.handlePageClose}
          onCancel={this.handlePageClose}
          footer={(
            <div>
              <Button
                size="small"
                onClick={this.handlePageClose}
              >
                取消
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={this.handlePageOk}
              >
                确定
              </Button>
            </div>
            )}
        >
          <Form
            size="small"
            direction="ver"
            style={{ width: 600,height:530, paddingTop: '30px' }}
            field={this.field}
          >
            <FormItem  required label="页面配置">
              <JSONInput
                  locale      = { locale }
                  placeholder = {this.pageMeta}
                  widht       = '500px'
                  height      = '250px'
                  onChange    = {this.handleMetaChange}
              />
            </FormItem>
            <FormItem  required label="导航配置">
              <JSONInput
                  locale      = { locale }
                  placeholder = {this.projectMenu}
                  widht       = '500px'
                  height      = '250px'
                  onChange    = {this.handleMenuChange}
              />
            </FormItem>
          </Form>
        </Dialog>
      );
    }
    return (
      <Dialog
        className="fullscreen-dialog"
        visible={this.props.pageBlockPicker.visible}
        onClose={this.handleClose}
        footer={false}
        closable={!this.props.pageBlockPicker.isDownloading}
      >
        <div className="page-block-picker">
          <div className="page-block-picker-header">
            下载区块到 {this.props.pageBlockPicker.componentsPath}
          </div>
          <div className="page-block-picker-body">
            <div className="page-block-picker-panel">
              <BlockPickerPanel handleBlocksAdd={this.handleBlocksAdd} />
            </div>
            <div className="page-block-picker-preview">
              {this.props.pageBlockPicker.existBlocks.length ? (
                <PreviewTitle
                  title="已有区块"
                  count={this.props.pageBlockPicker.existBlocks.length}
                />
              ) : null}
              {this.props.pageBlockPicker.existBlocks &&
                this.props.pageBlockPicker.existBlocks.map((blockName) => {
                  return (
                    <div className="block-item" key={blockName}>
                      {blockName}
                    </div>
                  );
                })}
              <div className="page-block-picker-added">
                <BlockPreview title="新增区块" text="请从左侧选择区块" />
              </div>
            </div>
          </div>
          <div className="page-block-picker-footer">
            <Balloon
              trigger={
                <Button
                  disabled={this.props.blocks.selected.length === 0}
                  loading={this.props.pageBlockPicker.isDownloading}
                  type="primary"
                  onClick={this.handleOk}
                >
                  {this.props.pageBlockPicker.isDownloading
                    ? '正在下载区块...'
                    : '开始下载'}
                </Button>
              }
              align="t"
              alignment="normal"
              triggerType="hover"
              style={{ width: 350, height: 85 }}
              visible={this.props.pageBlockPicker.isDownloading}
            >
              <div>
                <Progress styleOffset={[-350, 0]} />
              </div>
            </Balloon>
            <Button
              disabled={this.props.pageBlockPicker.isDownloading}
              onClick={this.handleClose}
            >
              取消
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }
}

export default PageBlockPicker;
