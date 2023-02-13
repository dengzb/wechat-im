import IIMHandler from "../interface/i-im-handler";

export default class WebSocketHandlerImp extends IIMHandler {
  
    constructor() {
        super();
        this._lockReconnect = false;
        this._connection = null;
        this._timer = null;
        this._limit = 0;
        let that = this;
        this._heartCheck = {
          timeout: 30000,
          timeoutObj: null,
          serverTimeoutObj: null,
          reset: function() {
            clearTimeout(this.timeoutObj);
            clearTimeout(this.serverTimeoutObj);
            return this;
          },
          start() {
            this.timeoutObj = setTimeout(()=> {
              that._sendMsgImp({content:{type: "ping"}});
              console.log("ping");
              this.serverTimeoutObj = setTimeout(()=> {
                that.closeConnection();
              }, this.timeout);
            }, this.timeout);
          }
        };
    }

    reconnect() {
      if (this._lockReconnect) return;
      this._lockReconnect = true;
      clearTimeout(this._timer);
      if (this._limit <12) {
        this._timer = setTimeout(() => {
          this.createConnection({});
          this._lockReconnect = false;
        }, 5000);
        this._limit = this._limit+1;
      }
    }
    

    /**
     * 创建WebSocket连接
     * 如：this.imWebSocket = new IMWebSocket();
     *    this.imWebSocket.createSocket({url: 'ws://10.4.97.87:8001'});
     * 如果你使用本地服务器来测试，那么这里的url需要用ws，而不是wss，因为用wss无法成功连接到本地服务器
     * @param options 建立连接时需要的配置信息，这里是传入的url，即你的服务端地址，端口号不是必需的。
     */
    async createConnection({options}) {
        if (!this._isLogin) {
          let response = await wx.cloud.connectContainer({
            config: {
                env: 'prod-3gfywz0q4e2479ed',
            },
            service: 'express-ws', // 替换自己的服务名
            path: '/ws'
          });
          this._connection = response.socketTask;
          this._lockReconnect = false;
          this._onSocketOpen();
          this._onSocketMessage();
          this._onSocketError();
          this._onSocketClose();
        }
    }

    async _sendMsgImp({content, success, fail}) {
        this._connection.send({
            data: JSON.stringify(content), success: () => {
                success && success({content});
            },
            fail: (res) => {
                fail && fail(res);
            }
        });
    }


    /**
     * 关闭webSocket
     */
    closeConnection() {
        this._connection.close();
        this._isLogin = false;
        this._lockReconnect = true;
    }

    _onSocketError(cb) {
      this._connection.onError((res) => {
            this._isLogin = false;
            console.log('WebSocket连接error，重试', res);
            this.reconnect();
        })
    }

    _onSocketClose(cb) {
      this._connection.onClose((res) => {
        this._isLogin = false;
        console.log('【WEBSOCKET】链接关闭！');
        this.reconnect();
      });
    }

    _onSocketOpen() {
      let that = this;
      this._connection.onOpen(function (res) {
        console.log('【WEBSOCKET】', '链接成功！');
        that._heartCheck.reset().start();
      });
    }

    /**
     * webSocket是在这里接收消息的
     * 在socket连接成功时，服务器会主动给客户端推送一条消息类型为login的信息，携带了用户的基本信息，如id，头像和昵称。
     * 在login信息接收前发送的所有消息，都会被推到msgQueue队列中，在登录成功后会自动重新发送。
     * 这里我进行了事件的分发，接收到非login类型的消息，会回调监听函数。
     * @private
     */
    _onSocketMessage() {
      let that = this;
        this._connection.onMessage((res) => {
            let msg = JSON.parse(res.data);
            if (msg.type === 'pong') {
              console.log("收到pong");
              that._heartCheck.reset().start();
              that._limit = 0;
              return;
            }
            if ('login' === msg.type) {
                this._isLogin = true;
                getApp().globalData.userInfo = msg.userInfo;
                if (this._msgQueue.length) {
                    let temp;
                    while (this._isLogin && !!(temp = this._msgQueue.shift())) {
                        this._sendMsgImp({
                            content: {...temp.content, userId: msg.userInfo.userId},
                            success: temp.resolve,
                            fail: temp.reject
                        });
                    }
                }
            } else {
                this._receiveListener && this._receiveListener(msg);
            }
        })
    }

}
