/*
 * Project: ZilPay-wallet
 * Author: Rinat(lich666dead)
 * -----
 * Modified By: the developer formerly known as Rinat(lich666dead) at <lich666black@gmail.com>
 * -----
 * Copyright (c) 2019 ZilPay
 */
import { v4 } from 'uuid'
import { filter, take, map } from 'rxjs/operators'
import { from } from 'rxjs'

import { TypeChecker } from './lib/type'

import { getFavicon } from './utils'
import { CryptoUtils } from './crypto'
import { InstanceError, AccessError, ERROR_MSGS } from './errors'
import { Transaction } from './transaction'
import { MESSAGE_TYPES } from './config/messages'
import { Message } from './lib/messager'

const { window, Promise, Set } = global

// Private variables. //
const _paddingTransactions = new Set()
let _subject = null // Listener instance.
let _defaultAccount = null
let _isConnect = true
let _isEnable = true
let _net = 'mainnet'
// Private variables. //

function _answer(payload, uuid) {
  return from(_subject).pipe(
    // Waiting an answer by uuid.
    filter(res => res.type === MESSAGE_TYPES.signResult),
    map(res => res.payload),
    filter(res => res.uuid && res.uuid === uuid),
    map(res => {
      if (res.reject) {
        throw res.reject
      } else if (res.resolve && new TypeChecker(res.resolve).isObject) {
        return Object.assign(payload, res.resolve)
      }

      return res.resolve
    }),
    take(1)
  ).toPromise()
}

function _transaction(tx) {
  if (!(tx instanceof Transaction)) {
    return Promise.reject(new InstanceError('tx', Transaction))
  }

  const type = MESSAGE_TYPES.signTx
  const uuid = v4()
  const { payload } = tx

  // Transaction id.
  payload.uuid = uuid
  // Current tab title.
  payload.title = window.document.title
  // Url on favicon by current tab.
  payload.icon = getFavicon()

  new Message({ type, payload }).send()

  return _answer(payload, uuid)
}

function _message(message) {
  const type = MESSAGE_TYPES.signMessage
  const uuid = v4()
  const icon = getFavicon()
  const payload = {
    message,
    uuid,
    icon
  }

  new Message({ type, payload }).send()

  return _answer(payload, uuid)
    .then((res) => ({
      publicKey: res.publicKey,
      signature: res.signature,
      message: res.message
    }))
}

export default class Wallet {

  get isConnect() {
    return _isConnect
  }

  get isEnable() {
    return _isEnable
  }

  get net() {
    return _net
  }

  get defaultAccount() {
    return _defaultAccount
  }

  constructor(subjectStream) {
    _subject = subjectStream

    _subject.subscribe(msg => {
      switch (msg.type) {

      case MESSAGE_TYPES.wallet:
        _isConnect = msg.payload.data.isConnect
        _isEnable = msg.payload.data.isEnable
        _net = msg.payload.data.netwrok
        _defaultAccount = msg.payload.data.account
        break

      default:
        break
      }
    })
  }

  /**
   * Subscribe on all account change.
   */
  observableAccount() {
    if (!this.isEnable) {
      throw new AccessError(ERROR_MSGS.DISABLED)
    } else if (!this.isConnect) {
      throw new AccessError(ERROR_MSGS.CONNECT)
    }

    let lastAccount = null

    return from(_subject).pipe(
      map(msg => {
        if (lastAccount === null || !_isEnable || !_isConnect) {
          return _defaultAccount
        }

        if (msg.type === MESSAGE_TYPES.wallet) {
          return msg.payload.data.account;
        }
      }),
      filter(account => account && lastAccount !== account.base16),
      map(account => {
        lastAccount = account.base16
        return account
      })
    )
  }

  /**
   * Subscribe on all network change.
   */
  observableNetwork() {
    if (!this.isEnable) {
      throw new AccessError(ERROR_MSGS.DISABLED)
    } else if (!this.isConnect) {
      throw new AccessError(ERROR_MSGS.CONNECT)
    }

    return from(_subject).pipe(
      filter(msg => msg && msg.type === MESSAGE_TYPES.wallet),
      map(msg => msg.payload.data.netwrok)
    )
  }

  /**
   * Observable for new block was created.
   */
  observableBlock() {
    if (!this.isEnable) {
      throw new AccessError(ERROR_MSGS.DISABLED)
    } else if (!this.isConnect) {
      throw new AccessError(ERROR_MSGS.CONNECT)
    }

    return from(_subject).pipe(
      filter((msg) => msg && (msg.type === MESSAGE_TYPES.block)),
      map((msg) => msg.payload.data.block)
    )
  }

  observableTransaction(...txns) {
    if (!this.isEnable) {
      throw new AccessError(ERROR_MSGS.DISABLED)
    } else if (!this.isConnect) {
      throw new AccessError(ERROR_MSGS.CONNECT)
    }

    if (txns && txns.length !== 0) {
      this.addTransactionsQueue(...txns)
    }

    return this.observableBlock().pipe(
      filter((msg) => msg && msg.TxHashes && Array.isArray(msg.TxHashes) && msg.TxHashes.length !== 0),
      map((msg) => msg.TxHashes.filter((txns) => txns.length !== 0)),
      map((txns) => txns.reduce((acc, value) => acc.concat(value))),
      map((txns) => Array.from(new Set(txns))),
      map((txns) => txns.map((tx) => new CryptoUtils().toHex(tx))),
      map((txns) => txns.filter((hash) => _paddingTransactions.delete(hash))),
      filter((txns) => txns.length !== 0)
    )
  }

  addTransactionsQueue(...txns) {
    for (let index = 0; index < txns.length; index++) {
      const tx = new CryptoUtils().toHex(txns[index])

      _paddingTransactions.add(tx)
    }

    return Array.from(_paddingTransactions)
  }

  /**
   * Call popup for confirm Transaction.
   */
  sign(payload) {
    if (!this.isEnable) {
      return Promise.reject(new AccessError(ERROR_MSGS.DISABLED))
    } else if (!this.isConnect) {
      return Promise.reject(new AccessError(ERROR_MSGS.CONNECT))
    }

    if (new TypeChecker(payload).isString) {
      return _message(payload)
    } else if (new TypeChecker(payload).isObject) {
      return _transaction(payload)
    }

    return Promise.reject(
      new TypeError(`payload ${ERROR_MSGS.MUST_BE_OBJECT} or ${ERROR_MSGS.MUST_BE_STRING}`)
    )
  }

  /**
   * Call popup for the get access from user.
   * this method need for show user info such as your address.
   */
  async connect() {
    const type = MESSAGE_TYPES.appConnect
    const uuid = v4()
    const payload = { uuid }

    new Message({ type, payload }).send()

    const confirmPayload = await from(_subject).pipe(
      filter(msg => msg.type === MESSAGE_TYPES.resConnect),
      map(res => res.payload),
      filter(payload => payload.uuid && payload.uuid === uuid),
      take(1)
    ).toPromise()

    if (confirmPayload && confirmPayload.data.confirm) {
      _isConnect = confirmPayload.data.confirm
      _defaultAccount = confirmPayload.data.account
    }

    return confirmPayload.data.confirm
  }

}
