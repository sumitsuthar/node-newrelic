/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = seed

const users = require('./users.js')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function seed() {
  // Clear out the db first
  await prisma.user.deleteMany({})

  for (const user of users) {
    await prisma.user.upsert(user)
  }

  await prisma.$disconnect()
}

seed()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)

    await prisma.$disconnect()

    throw e
  })
