const MIN_FRAME_SIZE_RPX = 120;
const WIDTH_RPX = 670;
let WIDTH_PX = 0;
let HEIGHT_PX = 0;
Component({
  properties: {
    /**     
     * 图片路径
     */
    'imgSrc': {
      type: String,
    },
    /**
     * 裁剪框 宽 / 高
     */
    'cutFrameRatio': {
      type: Number,
      value: 1
    },
    /**
     * 图片基于的显示区域高度，从顶部开始，px
     */
    'validHeight': {
      type: Number,
      value: 0,
    },
    'initShow': {
      type: Object,
    },
    /**
     * 锁定裁剪框比例
     */
    'fixRatio': {
      type: Boolean,
      value: true
    },
    /**
     * 裁剪框禁止拖动
     */
    'disable_width': {
      type: Boolean,
      value: false
    },
    'disable_height': {
      type: Boolean,
      value: false
    },

    'cut_top': {
      type: Number,
      value: null
    },
    'cut_left': {
      type: Number,
      value: null
    },
    /**
     * 图片缩放比
     */
    'scale': {
      type: Number,
      value: 1
    },
    /**
     * 图片旋转角度
     */
    'angle': {
      type: Number,
      value: 0
    },
    /**
     * 最小缩放比
     */
    'min_scale': {
      type: Number,
      value: 1
    },
    /**
     * 最大缩放比
     */
    'max_scale': {
      type: Number,
      value: 10
    },
    /**
     * 是否禁用旋转
     */
    'disable_rotate': {
      type: Boolean,
      value: true
    },
    /**
     * 是否限制移动范围(剪裁框只能在图片内)
     */
    'limit_move': {
      type: Boolean,
      value: true
    }
  },
  data: {
    el: 'image-cropper', //暂时无用
    info: wx.getSystemInfoSync(),
    CUT_START: {},
    MOVE_THROTTLE: null, //触摸移动节流settimeout
    MOVE_THROTTLE_FLAG: true, //节流标识
    TIME_BG: null, //背景变暗延时函数
    TIME_CUT_CENTER: null,
    _touch_img_relative: [{
      x: 0,
      y: 0
    }], //鼠标和图片中心的相对位置
    _flag_cut_touch: false, //是否是拖动裁剪框
    _hypotenuse_length: 0, //双指触摸时斜边长度
    _flag_img_endtouch: false, //是否结束触摸
    _flag_bright: false, //背景是否亮
    origin_x: 0.5, //图片旋转中心
    origin_y: 0.5, //图片旋转中心
    _cut_animation: false, //是否开启图片和裁剪框过渡
    _img_top: wx.getSystemInfoSync().windowHeight / 2, //图片上边距
    _img_left: wx.getSystemInfoSync().windowWidth / 2, //图片左边距
    _scale_x: 0.5, // 缩放中心
    _scale_y: 0.5, // 缩放中心
    height: 0,
    width: 0,
    watch: {
      //监听截取框宽高变化
      width(value, that) {
        if (Math.round(that.data.temp_width) === Math.round(value)) {
          return;
        }
        that.data.temp_width = value;
        if (Number.isNaN(value)) {
          that.setData({
            width: that.data.max_width,
          })
        } else if (value < that.data.min_width) {
          that.setData({
            width: that.data.min_width,
          });
        }
        //that._computeCutSize();
      },
      height(value, that) {
        if (Math.round(that.data.temp_height) === Math.round(value)) {
          return;
        }
        that.data.temp_height = value;
        if (Number.isNaN(value)) {
          that.setData({
            height: that.data.max_height
          })
        } else if (value < that.data.min_height) {
          that.setData({
            width: that.data.ratio * that.data.min_height
          });
        }
        //that._computeCutSize();
      },
      _img_left(value, that) {
        // 容错处理
        if (Math.round(that.data.temp_img_left) === Math.round(value)) {
          return;
        }
        that.data.temp_img_left = value;
        if (Number.isNaN(value)) {
          that.setData({
            _img_left: wx.getSystemInfoSync().windowWidth / 2
          })
        }
      },
      _img_top(value, that) {
        // 容错处理
        if (Math.round(that.data.temp_img_top) === Math.round(value)) {
          return;
        }
        that.data.temp_img_top = value;
        if (Number.isNaN(value)) {
          that.setData({
            _img_top: wx.getSystemInfoSync().windowHeight / 2
          })
        }
      },
      angle(value, that) {
        //停止居中裁剪框，继续修改图片位置
        that._moveStop();
        if (that.data.limit_move) {
          if (that.data.angle % 90) {
            that.setData({
              angle: Math.round(that.data.angle / 90) * 90
            });
            return;
          }
        }
      },
      _cut_animation(value, that) {
        //开启过渡300毫秒之后自动关闭
        clearTimeout(that.data._cut_animation_time);
        if (value) {
          that.data._cut_animation_time = setTimeout(() => {
            that.setData({
              _cut_animation: false
            });
          }, 300)
        }
      },
      limit_move(value, that) {
        if (value) {
          if (that.data.angle % 90) {
            that.setData({
              angle: Math.round(that.data.angle / 90) * 90
            });
          }
          that._imgMarginDetectionScale();
        }
      },
      imgSrc(value, that) {
        that.pushImg();
      },
      cut_top(value, that) {
        if (Math.round(that.data.temp_cut_top) === Math.round(value)) {
          return;
        }
        that.data.temp_cut_top = value;
        that._cutDetectionPosition();
      },
      cut_left(value, that) {
        if (Math.round(that.data.temp_cut_left) === Math.round(value)) {
          return;
        }
        that.data.temp_cut_left = value;
        that._cutDetectionPosition();
      },
      validHeight(value, that) {
        if (!value) {
          value = this.data.info.windowHeight;
        }
        that.setData({
          _img_top: value / 2
        })
        that._setCutCenter();
      },
      initShow(value, that) {
        that.setData(value);
      },
      cutFrameRatio: (value, that) => {
        let ratio = value;
        if (!value) {
          ratio = 1;
        }
        if (that.data.tempRatio === ratio) {
          return
        }
        that.data.tempRatio = ratio;

        WIDTH_PX = that.data.info.windowWidth * WIDTH_RPX / 750;
        if (ratio < WIDTH_PX / that.data.validHeight) {
          // 裁剪框宽高比 小于 有效范围，意味着更窄，此时高度到最大，计算宽度
          HEIGHT_PX = that.data.validHeight;
          WIDTH_PX = HEIGHT_PX * ratio;
        }

        HEIGHT_PX = WIDTH_PX / ratio;

        if (that.data.actionChangedScale) {
          // 如果是挪动产生的行为不进行下面操作
          that.data.actionChangedScale = false;
          return
        }

        if (HEIGHT_PX > WIDTH_PX) {
          if (that.data.img_height * that.data.scale < that.data.validHeight) {
            // 不要超过图片高度
            that.data.height = that.data.img_height * that.data.scale;
          } else {
            that.data.height = that.data.validHeight;
          }
        } else {
          that.data.height = HEIGHT_PX;
        }

        that.data.width = that.data.height * ratio

        that.setData({
          _scale_x: 0.5,
          _scale_y: 0.5
          //height: HEIGHT_PX
        })
        that.setCutCenter();
      }
    }
  },
  attached() {
    this.data.info = wx.getSystemInfoSync();
    //启用数据监听
    this._watcher();
    WIDTH_PX = this.data.info.windowWidth * WIDTH_RPX / 750;
    HEIGHT_PX = WIDTH_PX / this.data.cutFrameRatio;

    if (!this.data.validHeight) {
      this.data.validHeight = this.data.info.windowHeight;
    }

    if (HEIGHT_PX > this.data.validHeight) {
      HEIGHT_PX = this.data.validHeight;
      WIDTH_PX = HEIGHT_PX * this.data.cutFrameRatio;
    }

    this.data.height = HEIGHT_PX;
    this.data.width = WIDTH_PX;
    this.data.max_width = this.data.info.windowWidth * WIDTH_RPX / 750;
    this.data.max_height = this.data.validHeight;
    // 限定短边最小值
    if (HEIGHT_PX > WIDTH_PX) {
      this.data.min_width = MIN_FRAME_SIZE_RPX * this.data.info.windowWidth / 750;
      this.data.min_height = this.data.min_width / this.data.cutFrameRatio;
    } else {
      this.data.min_height = MIN_FRAME_SIZE_RPX * this.data.info.windowWidth / 750;
      this.data.min_width = this.data.min_height * this.data.cutFrameRatio;
    }

    this.data._img_top = this.data.validHeight / 2;

    this.data.imgSrc && (this.data.imgSrc = this.data.imgSrc);
    //设置裁剪框大小>设置图片尺寸>绘制canvas
    this._computeCutSize();
    //检查裁剪框是否在范围内
    this._cutDetectionPosition();
    //初始化完成
    this.setCutCenter();
  },

  methods: {

    /**
     * 设置图片动画
     * {
     *    x:10,//图片在原有基础上向下移动10px
     *    y:10,//图片在原有基础上向右移动10px
     *    angle:10,//图片在原有基础上旋转10deg
     *    scale:0.5,//图片在原有基础上增加0.5倍
     * }
     */
    setTransform(transform) {
      if (!transform) return;
      if (!this.data.disable_rotate) {
        this.setData({
          angle: transform.angle ? this.data.angle + transform.angle : this.data.angle
        });
      }
      var scale = this.data.scale;
      if (transform.scale) {
        scale = this.data.scale + transform.scale;
        scale = scale <= this.data.min_scale ? this.data.min_scale : scale;
        scale = scale >= this.data.max_scale ? this.data.max_scale : scale;
      }
      this.data.scale = scale;
      let cutX = this.data.cut_left;
      let cutY = this.data.cut_top;
      if (transform.cutX) {
        this.setData({
          cut_left: cutX + transform.cutX
        });
        this.data.watch.cut_left(null, this);
      }
      if (transform.cutY) {
        this.setData({
          cut_top: cutY + transform.cutY
        });
        this.data.watch.cut_top(null, this);
      }
      this.data._img_top = transform.y ? this.data._img_top + transform.y : this.data._img_top;
      this.data._img_left = transform.x ? this.data._img_left + transform.x : this.data._img_left;
      //图像边缘检测,防止截取到空白
      this._imgMarginDetectionScale();
      //停止居中裁剪框，继续修改图片位置
      this._moveDuring();
      this.setData({
        scale: this.data.scale,
        _img_top: this.data._img_top,
        _img_left: this.data._img_left
      });
      //可以居中裁剪框了
      this._moveStop(); //结束操作
    },
    /**
     * 设置剪裁框位置
     */
    setCutXY(x, y) {
      this.setData({
        cut_top: y,
        cut_left: x
      });
    },

    /**
     * 设置剪裁框和图片居中
     */
    setCutCenter() {
      let cut_top = (this.data.validHeight - HEIGHT_PX) * 0.5;
      let cut_left = (this.data.info.windowWidth - WIDTH_PX) * 0.5;
      const updateData = {}

      if (Math.round(HEIGHT_PX) >= this.data.validHeight) {
        // 上下顶格的情况，做个 padding
        const padding = 10;
        const height = HEIGHT_PX - 2 * padding;
        Object.assign(updateData, {
          height,
          width: height * WIDTH_PX / HEIGHT_PX,
          cut_top: cut_top + padding,
          cut_left,
        });
      } else {
        Object.assign(updateData, {
          height: HEIGHT_PX,
          width: WIDTH_PX,
          cut_top,
          cut_left,
        })
      }

      const ratio = WIDTH_PX / this.data.width;
      if (this.data.scale * ratio < this.data.max_scale) {
        // 图片中心点到上裁剪框四边的
        const centerToCutTop = this.data._img_top - this.data.cut_top;
        let topOffset = centerToCutTop * ratio - centerToCutTop;

        const centerToCutBottom = this.data.cut_top + this.data.height - this.data._img_top;
        let bottomOffset = centerToCutBottom * ratio - centerToCutBottom;

        if (!this.data.fixRatio) {
          // 自由裁剪下，纵坐标的移动需要加偏移量
          topOffset = topOffset + cut_top - this.data.cut_top;
          bottomOffset = this.data.cut_top - cut_top + bottomOffset;
        }

        const centerToCutLeft = this.data._img_left - this.data.cut_left;
        const leftOffset = centerToCutLeft * ratio - centerToCutLeft;

        const centerToCutRight = this.data.cut_left + this.data.width - this.data._img_left;
        const rightOffset = centerToCutRight * ratio - centerToCutRight;

        switch (this.data.CUT_START['corner']) {
          case 1:
            // 左下角
            Object.assign(updateData, {
              _img_top: this.data._img_top + topOffset,
              _img_left: this.data._img_left - rightOffset
            })
            break;
          case 2:
            // 左上角
            Object.assign(updateData, {
              _img_top: this.data._img_top - bottomOffset,
              _img_left: this.data._img_left - rightOffset
            })
            break;
          case 3:
            // 右上角
            Object.assign(updateData, {
              _img_top: this.data._img_top - bottomOffset,
              _img_left: this.data._img_left + leftOffset
            })
            break;
          case 4:
            // 右下角
            Object.assign(updateData, {
              _img_top: this.data._img_top + topOffset,
              _img_left: this.data._img_left + leftOffset
            })
            break;
          default:
            break;
        }

        this.data.CUT_START['corner'] = 0;

        Object.assign(updateData, {
          scale: this.data.scale * ratio,
        })
      }
      this.setData(updateData);
      this._imgMarginDetectionScale();
    },
    _setCutCenter() {
      let cut_top = (this.data.validHeight - this.data.height) * 0.5;
      let cut_left = (this.data.info.windowWidth - this.data.width) * 0.5;
      this.setData({
        cut_top: cut_top, //截取的框上边距
        cut_left: cut_left, //截取的框左边距
      });
    },

    /**
     * 是否锁定旋转
     */
    setDisableRotate(value) {
      this.data.disable_rotate = value;
    },
    /**
     * 是否限制移动
     */
    setLimitMove(value) {
      this.setData({
        _cut_animation: true,
        limit_move: !!value
      });
    },

    /**
     * 加载（更换）图片
     */
    pushImg(src) {
      if (src) {
        this.setData({
          imgSrc: src
        });
        //发现是手动赋值直接返回，交给watch处理
        return;
      }

      // getImageInfo接口传入 src: '' 会导致内存泄漏
      const that = this;
      if (!this.data.imgSrc) return;
      wx.getImageInfo({
        src: this.data.imgSrc,
        success: (res) => {
          const {
            height,
            width
          } = res;
          const updateData = {}
          if (width > height) {
            // 高撑满
            this.data.image_ratio = res.height / HEIGHT_PX;
            Object.assign(updateData, {
              img_height: HEIGHT_PX,
              img_width: res.width * HEIGHT_PX / res.height,
            })
          } else {
            // 框撑满
            this.data.image_ratio = res.width / WIDTH_PX;
            Object.assign(updateData, {
              img_width: WIDTH_PX,
              img_height: res.height * WIDTH_PX / res.width,
            })
          }

          //图片非本地路径需要换成本地路径
          if (this.data.imgSrc.search(/tmp/) == -1) {
            Object.assign(updateData, {
              imgSrc: res.path
            })
          }
          that.setData(updateData);
          if (this.data.limit_move) {
            //限制移动，不留空白处理
            this._imgMarginDetectionScale();
          }
        },
        fail: (err) => {
          this.setData({
            imgSrc: ''
          });
        }
      });
    },
    imageLoad(e) {
      setTimeout(() => {
        this.triggerEvent('imageload', this.data.imageObject);
      }, 1000)
    },
    /**
     * 设置图片放大缩小
     */
    setScale(scale) {
      if (!scale) return;
      this.setData({
        scale: scale
      });
    },
    /**
     * 设置图片旋转角度
     */
    setAngle(angle) {
      if (!angle) return;
      this.setData({
        _cut_animation: true,
        angle: angle
      });
      this._imgMarginDetectionScale();
    },

    /**
     * 检测剪裁框位置是否在允许的范围内(屏幕内)
     */
    _cutDetectionPosition() {
      let _cutDetectionPositionTop = () => {
          //检测上边距是否在范围内
          if (this.data.cut_top < 0) {
            this.setData({
              cut_top: 0
            });
          }
          if (this.data.cut_top > this.data.validHeight - this.data.height) {
            this.setData({
              cut_top: this.data.validHeight - this.data.height
            });
          }
        },
        _cutDetectionPositionLeft = () => {
          //检测左边距是否在范围内
          if (this.data.cut_left < 0) {
            this.setData({
              cut_left: 0
            });
          }
          if (this.data.cut_left > this.data.info.windowWidth - this.data.width) {
            this.setData({
              cut_left: this.data.info.windowWidth - this.data.width
            });
          }
        };
      //裁剪框坐标处理（如果只写一个参数则另一个默认为0，都不写默认居中）
      if (this.data.cut_top == null && this.data.cut_left == null) {
        this._setCutCenter();
      } else if (this.data.cut_top != null && this.data.cut_left != null) {
        _cutDetectionPositionTop();
        _cutDetectionPositionLeft();
      } else if (this.data.cut_top != null && this.data.cut_left == null) {
        _cutDetectionPositionTop();
        this.setData({
          cut_left: (this.data.info.windowWidth - this.data.width) / 2
        });
      } else if (this.data.cut_top == null && this.data.cut_left != null) {
        _cutDetectionPositionLeft();
        this.setData({
          cut_top: (this.data.validHeight - this.data.height) / 2
        });
      }
    },

    /**
     * 图片边缘检测-位置
     */
    _imgMarginDetectionPosition(scale) {
      if (!this.data.limit_move) return;
      let left = this.data._img_left;
      let top = this.data._img_top;
      var scale = scale || this.data.scale;
      let img_width = this.data.img_width;
      let img_height = this.data.img_height;
      if (this.data.angle / 90 % 2) {
        img_width = this.data.img_height;
        img_height = this.data.img_width;
      }
      if (img_width) {
        left = this.data.cut_left + img_width * scale / 2 >= left ? left : this.data.cut_left + img_width * scale / 2;
        left = this.data.cut_left + this.data.width - img_width * scale / 2 <= left ? left : this.data.cut_left + this.data.width - img_width * scale / 2;
      }
      if (img_height) {
        top = this.data.cut_top + img_height * scale / 2 >= top ? top : this.data.cut_top + img_height * scale / 2;
        top = this.data.cut_top + this.data.height - img_height * scale / 2 <= top ? top : this.data.cut_top + this.data.height - img_height * scale / 2;
      }
      this.setData({
        _img_left: left,
        _img_top: top,
        scale: scale
      })
    },
    /**
     * 图片边缘检测-缩放
     */
    _imgMarginDetectionScale() {
      if (!this.data.limit_move) return;
      let scale = this.data.scale;
      let img_width = this.data.img_width;
      let img_height = this.data.img_height;
      if (this.data.angle / 90 % 2) {
        img_width = this.data.img_height;
        img_height = this.data.img_width;
      }
      if (img_width * scale < this.data.width) {
        scale = this.data.width / img_width;
      }
      if (img_height * scale < this.data.height) {
        scale = Math.max(scale, this.data.height / img_height);
      }
      this._imgMarginDetectionPosition(scale);
    },
    _setData(obj) {
      let data = {};
      for (var key in obj) {
        if (this.data[key] != obj[key]) {
          data[key] = obj[key];
        }
      }
      this.setData(data);
      return data;
    },

    //改变截取框大小
    _computeCutSize() {
      if (this.data.width > this.data.info.windowWidth) {
        this.setData({
          width: this.data.info.windowWidth,
        });
      } else if (this.data.width + this.data.cut_left > this.data.info.windowWidth) {
        this.setData({
          cut_left: this.data.info.windowWidth - this.data.cut_left,
        });
      };
      if (this.data.height > this.data.info.windowHeight) {
        this.setData({
          height: this.data.info.windowHeight,
        });
      } else if (this.data.height + this.data.cut_top > this.data.info.windowHeight) {
        this.setData({
          cut_top: this.data.info.windowHeight - this.data.cut_top,
        });
      }
    },
    //开始触摸
    _start(event) {
      this.data._flag_img_endtouch = false;
      if (event.touches.length == 1) {
        //单指拖动
        this.data._touch_img_relative[0] = {
          x: (event.touches[0].clientX - this.data._img_left),
          y: (event.touches[0].clientY - this.data._img_top)
        }
      } else {
        //双指放大
        const touchedCenterX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const touchedCenterY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        const imgTopY = this.data._img_top - (this.data.img_height * this.data.scale) / 2;
        const imgLeftX = this.data._img_left - (this.data.img_width * this.data.scale) / 2;
        this.setData({
          _scale_x: (touchedCenterX - imgLeftX) / (this.data.img_width * this.data.scale),
          _scale_y: (touchedCenterY - imgTopY) / (this.data.img_height * this.data.scale),
        })

        let width = Math.abs(event.touches[0].clientX - event.touches[1].clientX);
        let height = Math.abs(event.touches[0].clientY - event.touches[1].clientY);
        this.data._touch_img_relative = [{
          x: (event.touches[0].clientX - this.data._img_left),
          y: (event.touches[0].clientY - this.data._img_top)
        }, {
          x: (event.touches[1].clientX - this.data._img_left),
          y: (event.touches[1].clientY - this.data._img_top)
        }];
        this.data._hypotenuse_length = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
      }
    },
    _move_throttle() {
      //安卓需要节流
      if (this.data.info.platform == 'android') {
        clearTimeout(this.data.MOVE_THROTTLE);
        this.data.MOVE_THROTTLE = setTimeout(() => {
          this.data.MOVE_THROTTLE_FLAG = true;
        }, 1000 / 40)
        return this.data.MOVE_THROTTLE_FLAG;
      } else {
        this.data.MOVE_THROTTLE_FLAG = true;
      }
    },
    _move(event) {
      if (this.data._flag_img_endtouch || !this.data.MOVE_THROTTLE_FLAG) return;
      this.data.MOVE_THROTTLE_FLAG = false;
      this._move_throttle();
      this._moveDuring();
      if (event.touches.length == 1) {
        //单指拖动
        let left = (event.touches[0].clientX - this.data._touch_img_relative[0].x),
          top = (event.touches[0].clientY - this.data._touch_img_relative[0].y);
        //图像边缘检测,防止截取到空白
        this.data._img_left = left;
        this.data._img_top = top;
        this._imgMarginDetectionPosition();
        this.setData({
          _img_left: this.data._img_left,
          _img_top: this.data._img_top
        });
      } else {
        //双指放大
        let width = (Math.abs(event.touches[0].clientX - event.touches[1].clientX)),
          height = (Math.abs(event.touches[0].clientY - event.touches[1].clientY)),
          hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)),
          scale = this.data.scale * (hypotenuse / this.data._hypotenuse_length),
          current_deg = 0;
        scale = scale <= this.data.min_scale ? this.data.min_scale : scale;
        scale = scale >= this.data.max_scale ? this.data.max_scale : scale;
        //图像边缘检测,防止截取到空白
        this.data.scale = scale;
        this._imgMarginDetectionScale();
        //双指旋转(如果没禁用旋转)
        let _touch_img_relative = [{
          x: (event.touches[0].clientX - this.data._img_left),
          y: (event.touches[0].clientY - this.data._img_top)
        }, {
          x: (event.touches[1].clientX - this.data._img_left),
          y: (event.touches[1].clientY - this.data._img_top)
        }];
        if (!this.data.disable_rotate) {
          let first_atan = 180 / Math.PI * Math.atan2(_touch_img_relative[0].y, _touch_img_relative[0].x);
          let first_atan_old = 180 / Math.PI * Math.atan2(this.data._touch_img_relative[0].y, this.data._touch_img_relative[0].x);
          let second_atan = 180 / Math.PI * Math.atan2(_touch_img_relative[1].y, _touch_img_relative[1].x);
          let second_atan_old = 180 / Math.PI * Math.atan2(this.data._touch_img_relative[1].y, this.data._touch_img_relative[1].x);
          //当前旋转的角度
          let first_deg = first_atan - first_atan_old,
            second_deg = second_atan - second_atan_old;
          if (first_deg != 0) {
            current_deg = first_deg;
          } else if (second_deg != 0) {
            current_deg = second_deg;
          }
        }
        this.data._touch_img_relative = _touch_img_relative;
        this.data._hypotenuse_length = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        //更新视图
        this.setData({
          angle: this.data.angle + current_deg,
          scale: this.data.scale
        });
      }
    },
    //结束操作
    _end(event) {
      this.data._flag_img_endtouch = true;
      this._moveStop();
    },

    getResult() {
      let relativeX = this.data.cut_left - (this.data._img_left - this.data.img_width * this.data.scale / 2);
      let relativeY = this.data.cut_top - (this.data._img_top - this.data.img_height * this.data.scale / 2);
      if (relativeX < 0) {
        relativeX = 0;
      }
      if (relativeY < 0) {
        relativeY = 0;
      }
      const realX = parseInt(relativeX * this.data.image_ratio / this.data.scale);
      const realY = parseInt(relativeY * this.data.image_ratio / this.data.scale);
      const realW = parseInt(this.data.width * this.data.image_ratio / this.data.scale);
      const realH = parseInt(this.data.height * this.data.image_ratio / this.data.scale);
      const imageWidth = parseInt(this.data.img_width * this.data.image_ratio);
      const imageHeight = parseInt(this.data.img_height * this.data.image_ratio);

      return {
        x: realX,
        y: realY,
        width: realW,
        height: realH,
        imageWidth,
        imageHeight,
        initData: {
          scale: this.data.scale,
          _img_top: this.data._img_top,
          _img_left: this.data._img_left,
          img_height: this.data.img_height,
          img_width: this.data.img_width
        }
      };
    },

    //裁剪框处理
    _cutTouchMove(e) {
      if (this.data._flag_cut_touch && this.data.MOVE_THROTTLE_FLAG) {
        if (this.data.fixRatio && (this.data.disable_width || this.data.disable_height)) return;
        //节流
        this.data.MOVE_THROTTLE_FLAG = false;
        this._move_throttle();
        let width = this.data.width,
          height = this.data.height,
          cut_top = this.data.cut_top,
          cut_left = this.data.cut_left,
          size_correct = () => {
            width = width <= this.data.max_width ? width >= this.data.min_width ? width : this.data.min_width : this.data.max_width;
            height = height <= this.data.max_height ? height >= this.data.min_height ? height : this.data.min_height : this.data.max_height;
          },
          size_inspect = () => {
            if ((width > this.data.max_width || width < this.data.min_width || height > this.data.max_height || height < this.data.min_height) && this.data.fixRatio) {
              size_correct();
              return false;
            } else {
              size_correct();
              return true;
            }
          };
        height = this.data.CUT_START.height + ((this.data.CUT_START.corner > 1 && this.data.CUT_START.corner < 4 ? 1 : -1) * (this.data.CUT_START.y - e.touches[0].clientY));
        switch (this.data.CUT_START.corner) {
          case 1:
            width = this.data.CUT_START.width + this.data.CUT_START.x - e.touches[0].clientX;
            if (this.data.fixRatio) {
              height = width / (this.data.width / this.data.height)
            }
            if (!size_inspect()) return;
            cut_left = this.data.CUT_START.cut_left - (width - this.data.CUT_START.width);
            break
          case 2:
            width = this.data.CUT_START.width + this.data.CUT_START.x - e.touches[0].clientX;
            if (this.data.fixRatio) {
              height = width / (this.data.width / this.data.height)
            }
            if (!size_inspect()) return;
            cut_top = this.data.CUT_START.cut_top - (height - this.data.CUT_START.height)
            cut_left = this.data.CUT_START.cut_left - (width - this.data.CUT_START.width)
            break
          case 3:
            width = this.data.CUT_START.width - this.data.CUT_START.x + e.touches[0].clientX;
            if (this.data.fixRatio) {
              height = width / (this.data.width / this.data.height)
            }
            if (!size_inspect()) return;
            cut_top = this.data.CUT_START.cut_top - (height - this.data.CUT_START.height);
            break
          case 4:
            width = this.data.CUT_START.width - this.data.CUT_START.x + e.touches[0].clientX;
            if (this.data.fixRatio) {
              height = width / (this.data.width / this.data.height)
            }
            if (!size_inspect()) return;
            break
        }
        if (!this.data.disable_width && !this.data.disable_height) {
          this.setData({
            width: width,
            cut_left: cut_left,
            height: height,
            cut_top: cut_top,
          })
        } else if (!this.data.disable_width) {
          this.setData({
            width: width,
            cut_left: cut_left
          })
        } else if (!this.data.disable_height) {
          this.setData({
            height: height,
            cut_top: cut_top
          })
        }
        this._imgMarginDetectionScale();
      }
    },
    _cutTouchStart(e) {
      let currentX = e.touches[0].clientX;
      let currentY = e.touches[0].clientY;
      let cutbox_top4 = this.data.cut_top + this.data.height - 30;
      let cutbox_bottom4 = this.data.cut_top + this.data.height + 20;
      let cutbox_left4 = this.data.cut_left + this.data.width - 30;
      let cutbox_right4 = this.data.cut_left + this.data.width + 30;

      let cutbox_top3 = this.data.cut_top - 30;
      let cutbox_bottom3 = this.data.cut_top + 30;
      let cutbox_left3 = this.data.cut_left + this.data.width - 30;
      let cutbox_right3 = this.data.cut_left + this.data.width + 30;

      let cutbox_top2 = this.data.cut_top - 30;
      let cutbox_bottom2 = this.data.cut_top + 30;
      let cutbox_left2 = this.data.cut_left - 30;
      let cutbox_right2 = this.data.cut_left + 30;

      let cutbox_top1 = this.data.cut_top + this.data.height - 30;
      let cutbox_bottom1 = this.data.cut_top + this.data.height + 30;
      let cutbox_left1 = this.data.cut_left - 30;
      let cutbox_right1 = this.data.cut_left + 30;
      const scaledImageHeight = this.data.img_height * this.data.scale;
      const scaledImageWidth = this.data.img_width * this.data.scale;
      const topHeight = this.data.cut_top - (this.data._img_top - scaledImageHeight / 2);
      const leftWidth = this.data.cut_left - (this.data._img_left - scaledImageWidth / 2);

      if (currentX > cutbox_left4 && currentX < cutbox_right4 && currentY > cutbox_top4 && currentY < cutbox_bottom4) {
        this._moveDuring();
        this.data._flag_cut_touch = true;
        this.data._flag_img_endtouch = true;
        this.data.CUT_START = {
          width: this.data.width,
          height: this.data.height,
          x: currentX,
          y: currentY,
          corner: 4
        }
        // 右下
        this.setData({
          _scale_x: leftWidth / scaledImageWidth,
          _scale_y: topHeight / scaledImageHeight
        })
      } else if (currentX > cutbox_left3 && currentX < cutbox_right3 && currentY > cutbox_top3 && currentY < cutbox_bottom3) {
        this._moveDuring();
        this.data._flag_cut_touch = true;
        this.data._flag_img_endtouch = true;
        this.data.CUT_START = {
          width: this.data.width,
          height: this.data.height,
          x: currentX,
          y: currentY,
          cut_top: this.data.cut_top,
          cut_left: this.data.cut_left,
          corner: 3
        }
        // 右上
        this.setData({
          _scale_x: leftWidth / scaledImageWidth,
          _scale_y: (topHeight + this.data.height) / scaledImageHeight
        })
      } else if (currentX > cutbox_left2 && currentX < cutbox_right2 && currentY > cutbox_top2 && currentY < cutbox_bottom2) {
        this._moveDuring();
        this.data._flag_cut_touch = true;
        this.data._flag_img_endtouch = true;
        this.data.CUT_START = {
          width: this.data.width,
          height: this.data.height,
          cut_top: this.data.cut_top,
          cut_left: this.data.cut_left,
          x: currentX,
          y: currentY,
          corner: 2
        }
        // 左上
        this.setData({
          _scale_x: (leftWidth + this.data.width) / scaledImageWidth,
          _scale_y: (topHeight + this.data.height) / scaledImageHeight
        })
      } else if (currentX > cutbox_left1 && currentX < cutbox_right1 && currentY > cutbox_top1 && currentY < cutbox_bottom1) {
        this._moveDuring();
        this.data._flag_cut_touch = true;
        this.data._flag_img_endtouch = true;
        this.data.CUT_START = {
          width: this.data.width,
          height: this.data.height,
          cut_top: this.data.cut_top,
          cut_left: this.data.cut_left,
          x: currentX,
          y: currentY,
          corner: 1
        }
        // 左下
        this.setData({
          _scale_x: (leftWidth + this.data.width) / scaledImageWidth,
          _scale_y: topHeight / scaledImageHeight
        })
      } else {
        this.data.CUT_START['corner'] = 0;
      }
    },
    _cutTouchEnd(e) {
      this._moveStop();
      if (this.data._flag_cut_touch && !this.data.fixRatio) {
        // 在长宽比非固定情况下，如果发生裁剪框拖动，则 ratio 重新计算
        this.data.actionChangedScale = true;
        this.data.cutFrameRatio = this.data.width / this.data.height;
        this.triggerEvent('ratioChanged', this.data.cutFrameRatio);
      }
      this.data._flag_cut_touch = false;
    },
    //停止移动时需要做的操作
    _moveStop() {
      //清空之前的自动居中延迟函数并添加最新的
      clearTimeout(this.data.TIME_CUT_CENTER);
      this.data.TIME_CUT_CENTER = setTimeout(() => {
        //动画启动
        if (!this.data._cut_animation) {
          this.setData({
            _cut_animation: true
          });
        }
        this.setCutCenter();
      }, 800)
      //清空之前的背景变化延迟函数并添加最新的
      clearTimeout(this.data.TIME_BG);
      this.data.TIME_BG = setTimeout(() => {
        if (this.data._flag_bright) {
          this.setData({
            _flag_bright: false
          });
        }
      }, 800)
    },
    //移动中
    _moveDuring() {
      //清空之前的自动居中延迟函数
      clearTimeout(this.data.TIME_CUT_CENTER);
      //清空之前的背景变化延迟函数
      clearTimeout(this.data.TIME_BG);
      //高亮背景
      if (!this.data._flag_bright) {
        this.setData({
          _flag_bright: true
        });
      }
    },
    //监听器
    _watcher() {
      Object.keys(this.data).forEach(v => {
        this._observe(this.data, v, this.data.watch[v]);
      })
    },
    _observe(obj, key, watchFun) {
      var val = obj[key];
      Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: true,
        set: (value) => {
          val = value;
          watchFun && watchFun(val, this);
        },
        get() {
          if (val && '_img_top|img_left||width|height|min_width|max_width|min_height|max_height|export_scale|cut_top|cut_left|canvas_top|canvas_left|img_width|img_height|scale|angle|validHeight'.indexOf(key) != -1) {
            let ret = parseFloat(parseFloat(val).toFixed(3));
            if (typeof val == "string" && val.indexOf("%") != -1) {
              ret += '%';
            }
            return ret;
          }
          return val;
        }
      })
    },
    _preventTouchMove() {}
  }
})
