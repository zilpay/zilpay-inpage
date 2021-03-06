/*
 * Project: ZilPay-wallet
 * Author: Rinat(lich666dead)
 * -----
 * Modified By: the developer formerly known as Rinat(lich666dead) at <lich666black@gmail.com>
 * -----
 * Copyright (c) 2019 ZilPay
 */
import { v4 } from 'uuid'
import { RPCMethod } from '@zilliqa-js/core/dist/net'

import { from } from 'rxjs'
import { filter, take, map } from 'rxjs/operators'

import { TypeChecker } from './lib/type'
import { MESSAGE_TYPES } from './config/messages'
import { Message } from './lib/messager'

// Private variables. //
/**
 * Listener instance.
 */
let _subject = null

/**
 * HTTP Proxy provider.
 * this provider proxyed all http requests to content.js
 * and encrypted all data.
 */
export default class HTTPProvider {

  constructor(subjectStream) {
    this.middleware = {
      request: {
        use() {}
      },
      response: {
        use() {}
      }
    }
    _subject = subjectStream

    this.RPCMethod = RPCMethod
  }

  send(method, ...params) {
    if (this.RPCMethod.CreateTransaction === method
        && new TypeChecker(params.signature).isUndefined) {
      return { error: null, result: {} }
    }

    const type = MESSAGE_TYPES.reqProxy
    // Request id.
    const uuid = v4()

    new Message({
      type,
      payload: {
        uuid,
        data: {
          params,
          method
        }
      }
    }).send()

    // Waiting for an answer from content.js.
    return from(_subject).pipe(
      filter(res => res.type === MESSAGE_TYPES.resProxy),
      map(res => res.payload),
      filter(res => res.uuid && res.uuid === uuid),
      map(payload => {
        if (payload.data.error) {
          throw payload.data.error
        }

        delete payload.uuid

        return payload.data
      }),
      take(1)
    ).toPromise()
  }

}
