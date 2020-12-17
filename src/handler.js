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

export default class Handler {

  constructor() {
    // Event listener.
    this.subjectStream = new Subject()
  }

  /**
   * When injected script was initialized
   * for wallet need some data about account and network.
   */
  initialized() {
    const type = MESSAGE_TYPES.wallet

    Message.signal(type)
  }
}
