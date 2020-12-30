/*
 * Project: ZilPay-wallet
 * Author: Rinat(lich666dead)
 * -----
 * Modified By: the developer formerly known as Rinat(lich666dead) at <lich666black@gmail.com>
 * -----
 * Copyright (c) 2019 ZilPay
 */
import { Subject } from 'rxjs'
import { MESSAGE_TYPES } from './config/messages'
import { Message } from './lib/messager'
const { document } = global

export default class Handler {

  constructor() {
    // Event listener.
    this.subjectStream = new Subject()
  }

  _init() {
    document.addEventListener('message', (e) => {
      if (!e || !e.data) {
        return null
      }

      try {
        const msg = JSON.parse(e.data);

        this.subjectStream.next(msg);
      } catch (err) {
        //
      }
    }, false)
    Message.signal(MESSAGE_TYPES.init)
  }

  /**
   * When injected script was initialized
   * for wallet need some data about account and network.
   */
  initialized() {
    try {
      this._init()
    } catch (err) {
      setTimeout(() => {
        this._init()
      }, 50)
    }
  }
}
