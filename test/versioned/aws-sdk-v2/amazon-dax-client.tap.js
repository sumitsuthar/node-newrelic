/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const common = require('../aws-sdk-v3/common')
const helper = require('../../lib/agent_helper')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

// This will not resolve / allow web requests. Even with real ones, requests
// have to execute within the same VPC as the DAX configuration. When adding DAX support,
// we may be able to fake part of this via nock or similar.
const DAX_ENDPOINTS = [
  'this.is.not.real1.amazonaws.com:8111',
  'this.is.not.real2.amazonaws.com:8111'
]

tap.test('amazon-dax-client', (t) => {
  t.autoend()

  t.beforeEach(() => {
    t.context.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    const AmazonDaxClient = require('amazon-dax-client')

    const daxClient = new AmazonDaxClient({
      credentials: FAKE_CREDENTIALS,
      endpoints: DAX_ENDPOINTS,
      maxRetries: 0 // fail fast
    })
    t.context.docClient = new AWS.DynamoDB.DocumentClient({ service: daxClient })
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
  })

  t.test('should not crash when using DAX', (t) => {
    const { agent, docClient } = t.context
    helper.runInTransaction(agent, () => {
      // We don't need a successful case to repro
      const getParam = getDocItemParams('TableDoesNotExist', 'ArtistDoesNotExist')
      docClient.get(getParam, (err) => {
        t.ok(err)
        t.end()
      })
    })
  })

  t.test('should capture instance data as unknown using DAX', (t) => {
    const { agent, docClient } = t.context
    helper.runInTransaction(agent, (transaction) => {
      // We don't need a successful case to repro
      const getParam = getDocItemParams('TableDoesNotExist', 'ArtistDoesNotExist')
      docClient.get(getParam, (err) => {
        t.ok(err)

        const root = transaction.trace.root

        // Won't have the attributes cause not making web request...
        const segments = common.getMatchingSegments(t, root, common.DATASTORE_PATTERN)

        t.equal(segments.length, 1)

        const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
        t.equal(externalSegments.length, 0, 'should not have any External segments')

        const segment = segments[0]
        t.equal(segment.name, 'Datastore/operation/DynamoDB/getItem')

        const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
        t.match(
          attrs,
          {
            host: 'unknown',
            port_path_or_id: 'unknown',
            collection: 'TableDoesNotExist',
            product: 'DynamoDB'
          },
          'should have expected attributes'
        )

        t.end()
      })
    })
  })
})

function getDocItemParams(tableName, uniqueArtist) {
  return {
    Key: {
      Artist: uniqueArtist,
      SongTitle: 'Call Me Today'
    },
    TableName: tableName
  }
}
